#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/alert_digest.py
  Boucle de rétention candidat : alertes personnalisées (email / WhatsApp).

  Après chaque cycle d'auto-publication (workflow GitHub Actions
  auto-publish.yml, toutes les 15 min), ce script compare les contenus
  nouvellement publiés (job_offers + exams) aux alertes actives et envoie une
  notification GROUPÉE (un message par alerte, pas un message par offre) :
    • Email    → API REST Resend (aucun SDK requis)
    • WhatsApp → Meta Cloud API (mêmes variables que src/services/whatsappNotify.ts)

  Déduplication : table `alert_digest_log` (unique(alert_id, item_type, item_id))
  → chaque (alerte, élément) n'est notifié qu'une seule fois.
  Fréquence quotidienne : au plus 1 envoi par jour et par alerte (last_sent_at).
  Désinscription : lien unique (unsubscribe_token) dans chaque notification.

  Variables d'environnement :
    SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  → prod (sinon SQLite local)
    RESEND_API_KEY / EMAIL_FROM               → emails
    WHATSAPP_NOTIFY_ENABLED / WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID → WhatsApp
    NEXT_PUBLIC_SITE_URL                      → URL publique (liens)
    ALERT_DIGEST_LOOKBACK_HOURS               → fenêtre de nouveauté (défaut 24 h)

  Ne lève JAMAIS sur échec réseau (log uniquement) — un cycle de publication
  ne doit pas être bloqué par l'envoi d'alertes.
===============================================================================
"""

from __future__ import annotations

import html
import json
import os
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "travaillerenci.sqlite3"

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None  # type: ignore

# Supabase (optionnel) : sans clés, on reste en SQLite local (dev).
try:
    from supabase import create_client, Client as SupabaseClient
except ImportError:  # pragma: no cover
    SupabaseClient = None  # type: ignore

# -----------------------------------------------------------------------------
# Normalisation & constantes de matching
# -----------------------------------------------------------------------------

_ACCENTS = str.maketrans(
    "àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÜÛÇ",
    "aaaeeeeiioouuucAAAEEEEIIOOUUUC",
)


def norm(value: Any) -> str:
    """Minuscules + suppression des accents (matching tolérant).
    NB : œ/æ → oe/ae traités séparément (longueurs différentes pour maketrans)."""
    s = str(value or "").strip().lower()
    s = s.replace("œ", "oe").replace("æ", "ae")
    return s.translate(_ACCENTS)


DIPLOMA_LEVELS: Dict[str, int] = {
    "CEPE": 1,
    "BEPC": 2,
    "CAP/BEP": 3,
    "CAP": 3,
    "BEP": 3,
    "BAC": 4,
    "BTS/DUT": 5,
    "BTS": 5,
    "DUT": 5,
    "DEUG": 5,
    "LICENCE": 6,
    "LICENCE PRO": 6,
    "MASTER": 7,
    "INGENIEUR": 7,
    "DOCTORAT": 8,
}

# Mots-clés par secteur (slug SECTORS de src/lib/constants.ts) — matching
# « approximatif » sur le titre / l'entreprise / la description des offres.
SECTOR_KEYWORDS: Dict[str, List[str]] = {
    "it-digital": ["informatique", "developpeur", "data", "digital", "systeme", "reseau", "logiciel", "web", "mobile", "cyber", "devops", "ia", "analyste"],
    "banque-finance": ["banque", "finance", "comptable", "tresorerie", "credit", "assurance", "microfinance", "audit financier", "tresorerie"],
    "btp-immobilier": ["chantier", "genie civil", "architecte", "topographe", "immobilier", "btp", "travaux publics", "electrotechnique", "electricien batiment"],
    "industrie": ["usine", "production", "mecanique", "electricien", "maintenance industrielle", "qualite", "hse", "controle qualite"],
    "commerce-distribution": ["commercial", "vente", "distribution", "magasin", "negociant", "achat", "approvisionnement", "responsable de rayon"],
    "sante": ["infirmier", "medecin", "sante", "sage-femme", "pharmacie", "laborantin", "paramedical", "clinique", "hospitalier"],
    "education-formation": ["enseignant", "professeur", "formateur", "instituteur", "education", "pedagogie", "etablissement scolaire", "lycee"],
    "agroalimentaire": ["agroalimentaire", "agriculture", "agronome", "agro", "elevage", "peche", "plantation", "transformation"],
    "telecoms": ["telecom", "telecommunication", "fibre", "mobile money", "reseau mobile", "ingenieur telecom"],
    "transport-logistique": ["transport", "chauffeur", "logistique", "magasinier", "conducteur", "livraison", "transitaire", "entrepot"],
    "tourisme-hotellerie": ["hotellerie", "tourisme", "restaurant", "receptionniste", "cuisinier", "hotel", "gestion hoteliere"],
    "audiovisuel-medias": ["journaliste", "media", "audiovisuel", "montage", "photographe", "redaction", "presentateur"],
    "audit-conseil": ["audit", "consultant", "conseil", "strategie", "expert-comptable", "cabinets", "due diligence"],
    "juridique": ["juriste", "droit", "notaire", "avocat", "contentieux", "juridique"],
    "rh": ["ressources humaines", "recruteur", "paie", "administration du personnel", "gestion des talents", "rh"],
    "marketing-communication": ["marketing", "communication", "publicite", "community", "brand", "marque", "design graphique", "digital marketing", "evenementiel"],
}

# Correspondance secteur → catégories de concours (approximative).
SECTOR_EXAM_CATEGORIES: Dict[str, List[str]] = {
    "sante": ["sante"],
    "education-formation": ["enseignement"],
    "juridique": ["administratif"],
    "rh": ["administratif"],
    "securite": ["securite", "militaire"],
    "militaire": ["militaire"],
}

CONTENT_TYPES = ("job", "internship", "scholarship", "exam")


def parse_content_types(raw: Any) -> List[str]:
    if isinstance(raw, list):
        return [str(t) for t in raw]
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return [str(t) for t in parsed] if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return []


# -----------------------------------------------------------------------------
# Matching pur (testable sans base ni réseau)
# -----------------------------------------------------------------------------

def matches_job(job: Dict[str, Any], alert: Dict[str, Any]) -> bool:
    """Une offre (job_offers) correspond-elle aux critères de l'alerte ?"""
    types = parse_content_types(alert.get("content_types"))
    if types:
        category = str(job.get("category") or "job")
        if category not in types:
            return False

    city = (alert.get("city") or "").strip()
    if city:
        if norm(city) not in norm(job.get("location") or ""):
            return False

    diploma = (alert.get("diploma") or "").strip()
    sector = (alert.get("sector") or "").strip()
    if diploma or sector:
        hay = norm(
            " ".join(
                [
                    str(job.get("title") or ""),
                    str(job.get("company") or ""),
                    str(job.get("description") or ""),
                ]
            )
        )
        if diploma and norm(diploma) not in hay:
            return False
        if sector:
            keywords = SECTOR_KEYWORDS.get(sector) or []
            if not any(norm(kw) in hay for kw in keywords):
                return False

    return True


def matches_exam(exam: Dict[str, Any], alert: Dict[str, Any]) -> bool:
    """Un concours (table exams) correspond-il aux critères de l'alerte ?"""
    types = parse_content_types(alert.get("content_types"))
    if types and "exam" not in types:
        return False

    city = (alert.get("city") or "").strip()
    if city:
        locations = [str(exam.get("location") or "")] + [
            str(c) for c in (exam.get("cities") or [])
        ]
        if not any(norm(city) in norm(loc) for loc in locations):
            return False

    diploma = (alert.get("diploma") or "").strip()
    if diploma:
        key = norm(diploma).upper()
        if key not in DIPLOMA_LEVELS:
            # Diplôme inconnu : on ne filtre pas (comportement permissif).
            pass
        else:
            diplomas = [norm(d).upper() for d in (exam.get("diplomas") or [])]
            min_level = exam.get("min_diploma_level")
            ok = key in diplomas or (
                min_level is not None
                and int(min_level) <= DIPLOMA_LEVELS[key]
            )
            if not ok:
                return False

    sector = (alert.get("sector") or "").strip()
    if sector:
        categories = SECTOR_EXAM_CATEGORIES.get(sector) or []
        if str(exam.get("category") or "") not in categories:
            return False

    return True


def already_sent_today(alert: Dict[str, Any], now: datetime) -> bool:
    """Fréquence quotidienne : vrai si un envoi a déjà eu lieu aujourd'hui (UTC)."""
    if alert.get("frequency") != "daily":
        return False
    last_dt = parse_utc_datetime(alert.get("last_sent_at"))
    return last_dt is not None and last_dt.date() == now.date()


# -----------------------------------------------------------------------------
# Construction des messages
# -----------------------------------------------------------------------------

def _site_url() -> str:
    return (os.getenv("NEXT_PUBLIC_SITE_URL") or "https://travaillerenci.vercel.app").rstrip("/")


def _job_url(job: Dict[str, Any]) -> str:
    # URL canonique par ID : la route /jobs/[id] est la seule servie et indexée
    # (les anciens liens /jobs/{slug} redirigent en 301 vers celle-ci).
    return f"{_site_url()}/jobs/{job.get('id')}"


def _exam_url(exam: Dict[str, Any]) -> str:
    slug = exam.get("slug")
    return f"{_site_url()}/concours/{slug or exam.get('id')}"


def _item_lines(items: List[Dict[str, Any]], kind: str) -> List[str]:
    lines: List[str] = []
    for item in items:
        if kind == "exam":
            title = item.get("title") or "Concours"
            subtitle = str(item.get("organizer") or "")
            url = _exam_url(item)
        else:
            title = item.get("title") or "Offre"
            subtitle = f"{item.get('company') or ''} — {item.get('location') or ''}"
            url = _job_url(item)
        extra = ""
        if item.get("deadline"):
            extra = f" (limite : {item['deadline'][:10]})"
        lines.append(f"• {title}{extra} — {subtitle} : {url}")
    return lines


def build_email_html(alert: Dict[str, Any], items: List[Dict[str, Any]], kind: str) -> str:
    # ⚠️ Tout contenu interpole dans le HTML est échappé (libellés + titres
    # proviennent des utilisateurs / des sources scrapées).
    label = html.escape(str(alert.get("label") or "mes alertes"))
    unsubscribe = f"{_site_url()}/api/alerts/unsubscribe?token={alert.get('unsubscribe_token', '')}"
    kind_label = "concours" if kind == "exam" else "offres"
    lines = [html.escape(line) for line in _item_lines(items, kind)]
    list_html = "".join(f"<li style='margin:0 0 10px;'>{line}</li>" for line in lines)
    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#009639,#007a2e);padding:24px 32px;text-align:center;">
          <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">Travailler<span>En</span>Ci</p>
          <p style="margin:6px 0 0;color:#d1fae5;font-size:13px;">🔔 Nouvelles {kind_label} pour votre alerte « {label} »</p>
        </td></tr>
        <tr><td style="padding:28px 32px 12px;">
          <h1 style="margin:0 0 12px;color:#111827;font-size:18px;font-weight:700;">
            {len(items)} nouvelle{'' if len(items) == 1 else 's'} opportunité{'' if len(items) == 1 else 's'} pour vous
          </h1>
          <ul style="margin:0 0 16px;padding-left:20px;color:#4b5563;font-size:14px;line-height:1.6;">
            {list_html}
          </ul>
          <p style="margin:0 0 20px;text-align:center;">
            <a href="{_site_url()}/dashboard/candidate" style="display:inline-block;background:#009639;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:12px;">Voir mon espace</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #f3f4f6;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">
            Vous recevez cet email car vous avez créé l'alerte « {label} » sur TravaillerEnCi.
          </p>
          <p style="margin:6px 0 0;color:#9ca3af;font-size:12px;">
            <a href="{unsubscribe}" style="color:#6b7280;">Me désinscrire de cette alerte</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


WHATSAPP_MAX_LENGTH = 4000  # marge sous la limite Meta (4096 caractères)


def build_whatsapp_message(alert: Dict[str, Any], items: List[Dict[str, Any]], kind: str) -> str:
    label = str(alert.get("label") or "mes alertes")
    kind_label = "concours" if kind == "exam" else "offres"
    lines = [
        f"🔔 *Nouvelles {kind_label}* pour « {label} »",
        "",
    ]
    item_lines = _item_lines(items, kind)
    # Un lot important ne doit pas dépasser la limite de 4096 caractères :
    # on tronque avec un pied de page « …et N autres ».
    footer = ["", f"Voir tout : {_site_url()}/dashboard/candidate",
              f"Désinscription : {_site_url()}/api/alerts/unsubscribe?token={alert.get('unsubscribe_token', '')}"]
    body = "\n".join(lines + item_lines + footer)
    if len(body) <= WHATSAPP_MAX_LENGTH:
        return body
    kept: List[str] = []
    for line in item_lines:
        candidate = "\n".join(lines + kept + [line] + footer)
        if len(candidate) > WHATSAPP_MAX_LENGTH:
            break
        kept.append(line)
    hidden = len(item_lines) - len(kept)
    suffix = f"… et {hidden} autre{'s' if hidden > 1 else ''} — {_site_url()}/dashboard/candidate" if hidden > 0 else ""
    return "\n".join(lines + kept + footer[:1] + ([suffix] if suffix else []) + footer[1:])


def parse_utc_datetime(value: Any) -> Optional[datetime]:
    """Parse un timestamp ISO/UTC (SQLite: 'YYYY-MM-DD HH:MM:SS', Supabase: ISO)."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        # SQLite datetime('now') est stocké en UTC mais sans fuseau.
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


# -----------------------------------------------------------------------------
# Envois (Resend + Meta WhatsApp) — ne lèvent jamais
# -----------------------------------------------------------------------------

def send_email(to: str, subject: str, html: str) -> bool:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        print("[alert_digest] RESEND_API_KEY absent — email non envoyé.")
        return False
    if httpx is None:
        print("[alert_digest] module `httpx` manquant.")
        return False
    try:
        res = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "from": os.getenv("EMAIL_FROM") or "TravaillerEnCi <noreply@travaillerenci.ci>",
                "to": to,
                "subject": subject,
                "html": html,
            },
            timeout=20.0,
        )
        if res.status_code >= 400:
            print(f"[alert_digest] Resend HTTP {res.status_code}: {res.text[:300]}")
            return False
        return True
    except Exception as exc:  # pragma: no cover
        print(f"[alert_digest] erreur email: {exc}")
        return False


def send_whatsapp(to: str, body: str) -> bool:
    if os.getenv("WHATSAPP_NOTIFY_ENABLED") != "1":
        return False
    token = os.getenv("WHATSAPP_TOKEN")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    if not token or not phone_number_id or httpx is None:
        print("[alert_digest] WhatsApp non configuré — message non envoyé.")
        return False
    try:
        res = httpx.post(
            f"https://graph.facebook.com/v21.0/{phone_number_id}/messages",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"body": body},
            },
            timeout=20.0,
        )
        if res.status_code >= 400:
            print(f"[alert_digest] WhatsApp HTTP {res.status_code}: {res.text[:300]}")
            return False
        return True
    except Exception as exc:  # pragma: no cover
        print(f"[alert_digest] erreur WhatsApp: {exc}")
        return False


# -----------------------------------------------------------------------------
# Accès données (Supabase ou SQLite local)
# -----------------------------------------------------------------------------

class DataStore:
    """Abstraction minimale Supabase / SQLite pour le digest."""

    def __init__(self) -> None:
        self.supabase: Optional[SupabaseClient] = None
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if SupabaseClient is not None and url and key:
            self.supabase = create_client(url, key)
        self.conn: Optional[sqlite3.Connection] = None

    def open(self) -> None:
        if self.supabase is not None:
            return
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(DB_PATH), timeout=30)
        self.conn.row_factory = sqlite3.Row
        self._ensure_sqlite_schema()

    def close(self) -> None:
        if self.conn:
            self.conn.commit()
            self.conn.close()

    def _ensure_sqlite_schema(self) -> None:
        assert self.conn is not None
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS alerts (
                id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                user_id           TEXT NOT NULL,
                label             TEXT NOT NULL,
                content_types     TEXT NOT NULL DEFAULT '[]',
                city              TEXT,
                diploma           TEXT,
                sector            TEXT,
                channels          TEXT NOT NULL DEFAULT 'email',
                frequency         TEXT NOT NULL DEFAULT 'immediate',
                active            INTEGER NOT NULL DEFAULT 1,
                unsubscribe_token TEXT NOT NULL UNIQUE,
                last_sent_at      TEXT,
                created_at        TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS alert_digest_log (
                id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                alert_id  TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
                item_type TEXT NOT NULL,
                item_id   TEXT NOT NULL,
                sent_at   TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE (alert_id, item_type, item_id)
            );
            """
        )
        # Migrations défensives (bases créées avant l'ajout de colonnes).
        cols = {
            row["name"]
            for row in self.conn.execute("PRAGMA table_info(alerts)")
        }
        for column, ddl in [
            ("last_sent_at", "ALTER TABLE alerts ADD COLUMN last_sent_at TEXT"),
            ("unsubscribe_token", "ALTER TABLE alerts ADD COLUMN unsubscribe_token TEXT"),
        ]:
            if column not in cols:
                self.conn.execute(ddl)
        self.conn.commit()

    # ------------------------------------------------------------ requêtes
    def get_active_alerts(self) -> List[Dict[str, Any]]:
        if self.supabase is not None:
            data = (
                self.supabase.table("alerts")
                .select("*")
                .eq("active", True)
                .execute()
            )
            return list(data.data or [])
        assert self.conn is not None
        rows = self.conn.execute(
            "SELECT * FROM alerts WHERE active = 1"
        ).fetchall()
        return [dict(r) for r in rows]

    def get_users(self, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """email (users) + téléphone (candidate_profiles) par user_id."""
        if not user_ids:
            return {}
        if self.supabase is not None:
            users: Dict[str, Dict[str, Any]] = {}
            u = self.supabase.table("users").select("id,email").in_("id", user_ids).execute()
            p = self.supabase.table("candidate_profiles").select("user_id,phone").in_("user_id", user_ids).execute()
            for row in u.data or []:
                users[str(row["id"])] = {"email": str(row.get("email") or ""), "phone": None}
            for row in p.data or []:
                uid = str(row["user_id"])
                if uid in users:
                    users[uid]["phone"] = row.get("phone")
            return users
        assert self.conn is not None
        users: Dict[str, Dict[str, Any]] = {}
        placeholders = ",".join("?" for _ in user_ids)
        for row in self.conn.execute(
            f"SELECT id, email FROM users WHERE id IN ({placeholders})", user_ids
        ):
            users[str(row["id"])] = {"email": row["email"], "phone": None}
        for row in self.conn.execute(
            f"SELECT user_id, phone FROM candidate_profiles WHERE user_id IN ({placeholders})", user_ids
        ):
            uid = str(row["user_id"])
            if uid in users:
                users[uid]["phone"] = row["phone"]
        return users

    def get_new_jobs(self, cutoff_iso: str) -> List[Dict[str, Any]]:
        if self.supabase is not None:
            data = (
                self.supabase.table("job_offers")
                .select("*")
                .eq("status", "published")
                .gte("created_at", cutoff_iso)
                .execute()
            )
            return list(data.data or [])
        assert self.conn is not None
        rows = self.conn.execute(
            "SELECT * FROM job_offers WHERE status = 'published' AND created_at >= ?",
            (cutoff_iso,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_new_exams(self, cutoff_iso: str) -> List[Dict[str, Any]]:
        if self.supabase is not None:
            data = (
                self.supabase.table("exams")
                .select("*")
                .eq("status", "published")
                .gte("created_at", cutoff_iso)
                .execute()
            )
            return list(data.data or [])
        assert self.conn is not None
        rows = self.conn.execute(
            "SELECT * FROM exams WHERE status = 'published' AND created_at >= ?",
            (cutoff_iso,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_sent_keys(self, alert_id: str) -> set:
        """(item_type, item_id) déjà notifiés pour cette alerte."""
        if self.supabase is not None:
            data = (
                self.supabase.table("alert_digest_log")
                .select("item_type,item_id")
                .eq("alert_id", alert_id)
                .execute()
            )
            return {(str(r["item_type"]), str(r["item_id"])) for r in (data.data or [])}
        assert self.conn is not None
        rows = self.conn.execute(
            "SELECT item_type, item_id FROM alert_digest_log WHERE alert_id = ?",
            (alert_id,),
        ).fetchall()
        return {(str(r["item_type"]), str(r["item_id"])) for r in rows}

    def log_sent(self, alert_id: str, entries: List[Dict[str, str]]) -> None:
        """Enregistre les envois (déduplication) + met à jour last_sent_at."""
        if not entries:
            return
        now_iso = datetime.now(timezone.utc).isoformat()
        if self.supabase is not None:
            payload = [
                {
                    "alert_id": alert_id,
                    "item_type": e["item_type"],
                    "item_id": e["item_id"],
                    "sent_at": now_iso,
                }
                for e in entries
            ]
            self.supabase.table("alert_digest_log").insert(payload).execute()
            self.supabase.table("alerts").update(
                {"last_sent_at": now_iso, "updated_at": now_iso}
            ).eq("id", alert_id).execute()
            return
        assert self.conn is not None
        self.conn.executemany(
            "INSERT OR IGNORE INTO alert_digest_log (alert_id, item_type, item_id, sent_at) VALUES (?, ?, ?, ?)",
            [(alert_id, e["item_type"], e["item_id"], now_iso) for e in entries],
        )
        self.conn.execute(
            "UPDATE alerts SET last_sent_at = ?, updated_at = ? WHERE id = ?",
            (now_iso, now_iso, alert_id),
        )
        self.conn.commit()

    def purge_old_logs(self) -> None:
        """Purge opportuniste des traces d'envoi > 30 jours."""
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        try:
            if self.supabase is not None:
                self.supabase.table("alert_digest_log").delete().lt("sent_at", cutoff).execute()
            elif self.conn is not None:
                self.conn.execute("DELETE FROM alert_digest_log WHERE sent_at < ?", (cutoff,))
                self.conn.commit()
        except Exception as exc:  # pragma: no cover
            print(f"[alert_digest] purge logs ignorée : {exc}")


# -----------------------------------------------------------------------------
# Orchestrateur
# -----------------------------------------------------------------------------

def _parse_lookback_hours(raw: Optional[str]) -> int:
    """Heures de la fenêtre de nouveauté — défaut 24 h.

    Robuste en CI : GitHub Actions substitue les `vars.` non configurés par une
    chaîne VIDE (la variable existe, `getenv` ne retombe pas sur le défaut).
    Une valeur vide ou non numérique retombe sur 24 h au lieu de lever.
    """
    if raw is None:
        return 24
    stripped = str(raw).strip()
    if not stripped:
        return 24
    try:
        return int(stripped)
    except ValueError:
        return 24


def run_digest() -> Dict[str, Any]:
    lookback_hours = _parse_lookback_hours(os.getenv("ALERT_DIGEST_LOOKBACK_HOURS"))
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(hours=lookback_hours)).isoformat()

    store = DataStore()
    store.open()
    try:
        alerts = store.get_active_alerts()
        if not alerts:
            print("[alert_digest] aucune alerte active — rien à faire.")
            return {"alerts_processed": 0, "sent": 0}

        user_ids = sorted({str(a.get("user_id")) for a in alerts})
        users = store.get_users(user_ids)

        jobs = store.get_new_jobs(cutoff)
        exams = store.get_new_exams(cutoff)
        print(
            f"[alert_digest] fenêtre {lookback_hours}h — {len(alerts)} alerte(s), "
            f"{len(jobs)} offre(s), {len(exams)} concours nouveau(x)."
        )

        total_sent = 0
        processed = 0
        for alert in alerts:
            alert_id = str(alert["id"])
            user = users.get(str(alert.get("user_id")))
            if not user or not user.get("email"):
                print(f"[alert_digest] alerte {alert_id} : utilisateur introuvable, ignorée.")
                continue

            if already_sent_today(alert, now):
                continue
            processed += 1

            sent_keys = store.get_sent_keys(alert_id)

            matched_jobs = [
                j
                for j in jobs
                if matches_job(j, alert) and ("job", str(j.get("id"))) not in sent_keys
            ]
            matched_exams = [
                e
                for e in exams
                if matches_exam(e, alert) and ("exam", str(e.get("id"))) not in sent_keys
            ]

            entries: List[Dict[str, str]] = [
                {"item_type": "job", "item_id": str(j["id"])} for j in matched_jobs
            ] + [
                {"item_type": "exam", "item_id": str(e["id"])} for e in matched_exams
            ]
            if not entries:
                continue

            channels = str(alert.get("channels") or "email")
            sent_any = False

            if channels in ("email", "both"):
                # Groupé : tous les éléments (emplois + concours) dans UN email.
                html = build_email_html(alert, matched_jobs + matched_exams, "offres")
                if send_email(
                    user["email"],
                    f"🔔 Nouvelles opportunités pour votre alerte « {alert.get('label', '')} » — TravaillerEnCi",
                    html,
                ):
                    sent_any = True
                    total_sent += 1

            if channels in ("whatsapp", "both"):
                phone = (user.get("phone") or "").strip()
                if not phone:
                    print(f"[alert_digest] alerte {alert_id} : WhatsApp demandé mais aucun numéro en profil.")
                else:
                    msg = build_whatsapp_message(alert, matched_jobs + matched_exams, "offres")
                    if send_whatsapp(phone, msg):
                        sent_any = True
                        total_sent += 1

            if sent_any:
                store.log_sent(alert_id, entries)
                print(f"[alert_digest] alerte « {alert.get('label')} » : {len(entries)} élément(s) notifié(s).")

        store.purge_old_logs()
        print(f"[alert_digest] terminé : {processed} alerte(s) traitées, {total_sent} notification(s) envoyée(s).")
        return {"alerts_processed": processed, "sent": total_sent}
    finally:
        store.close()


def main() -> int:
    try:
        run_digest()
        return 0
    except Exception as exc:  # pragma: no cover
        print(f"[alert_digest] erreur fatale : {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
