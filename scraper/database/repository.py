#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/database/repository.py
  Repository de stockage & synchronisation BDD (SQLite / Supabase)

  La table `job_offers` sert de dépôt UNIFIÉ de contenus :
      category = job | internship | scholarship | exam
  Tous les contenus scrapés arrivent en statut 'pending' (file de modération
  du dashboard admin), puis l'admin les édite / valide / publie / supprime.

  ⚠️ AUCUNE donnée de démonstration : `purge_demo_offers()` supprime les
  anciennes offres « démo » (seed, fallbacks) encore présentes en base.
===============================================================================
"""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any

from scraper.models.content_item import ContentItem

# Supabase (optionnel) : si `supabase` n'est pas installé ou si les clés ne
# sont pas fournies, le repository continue de fonctionner en SQLite seul.
try:
    from supabase import create_client, Client as SupabaseClient
except ImportError:  # pragma: no cover
    SupabaseClient = None  # type: ignore

# URLs des anciennes offres « démo » (seed de scripts/sqlite-setup.ts) — à purger.
_DEMO_SOURCE_URLS = {
    "https://mtn.ci/recrutement",
    "https://www.linkedin.com/jobs/view/sg-ci-chef-projet-marketing",
    "https://career.ecobank.com/cotedivoire",
    "https://mtn.ci/recrutement/developpeur-fullstack",
    "https://sg.ci/fr/carrieres/offre/chef-projet-marketing-digital",
}


def _log_warning(message: str) -> None:
    try:
        import logging

        logging.getLogger("scraper.repository").warning(message)
    except Exception:
        print(f"[repository] {message}")


class JobRepository:
    def __init__(
        self,
        db_path: Path,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
    ):
        self.db_path = db_path
        self.conn: sqlite3.Connection | None = None

        # Miroir Supabase (production) : le workflow GitHub Actions fournit
        # déjà SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en variables d'env.
        self.supabase_url = supabase_url or os.getenv("SUPABASE_URL")
        self.supabase_key = supabase_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        self.supabase: Optional[SupabaseClient] = None
        if SupabaseClient is not None and self.supabase_url and self.supabase_key:
            self.supabase = create_client(self.supabase_url, self.supabase_key)

    def __enter__(self) -> "JobRepository":
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.db_path), timeout=30)
        self.conn.row_factory = sqlite3.Row
        self._ensure_schema()
        self._migrate_schema()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            self.conn.commit()
            self.conn.close()

    # ------------------------------------------------------------------
    def _ensure_schema(self) -> None:
        assert self.conn is not None
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS job_offers (
              id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
              category        TEXT NOT NULL DEFAULT 'job' CHECK (category IN ('job','internship','scholarship','exam')),
              title           TEXT NOT NULL,
              company         TEXT NOT NULL,
              location        TEXT NOT NULL,
              contract_type   TEXT NOT NULL,
              description     TEXT NOT NULL,
              apply_link      TEXT,
              apply_email     TEXT,
              deadline        TEXT,
              source_url      TEXT,
              source_website  TEXT,
              status          TEXT NOT NULL DEFAULT 'pending',
              seo_title       TEXT,
              seo_description TEXT,
              seo_keywords    TEXT,
              slug            TEXT,
              is_verified     INTEGER NOT NULL DEFAULT 0,
              is_archived     INTEGER NOT NULL DEFAULT 0,
              is_expired      INTEGER NOT NULL DEFAULT 0,
              clicks_count    INTEGER NOT NULL DEFAULT 0,
              created_at      TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
              CONSTRAINT valid_contract_type CHECK (contract_type IN ('CDI','CDD','Stage','Prestation','Alternance','Freelance')),
              CONSTRAINT valid_status CHECK (status IN ('pending','published','rejected','archived')),
              CONSTRAINT valid_apply_method CHECK (apply_link IS NOT NULL OR apply_email IS NOT NULL),
              CONSTRAINT unique_title_company UNIQUE (title, company)
            );

            CREATE TABLE IF NOT EXISTS scraper_logs (
              id              INTEGER PRIMARY KEY AUTOINCREMENT,
              status          TEXT NOT NULL,
              offers_added    INTEGER NOT NULL DEFAULT 0,
              message         TEXT,
              started_at      TEXT NOT NULL DEFAULT (datetime('now')),
              finished_at     TEXT
            );
        """)

    def _migrate_schema(self) -> None:
        """Migrations idempotentes (bases créées par une version antérieure)."""
        assert self.conn is not None
        cols = {row["name"] for row in self.conn.execute("PRAGMA table_info(job_offers)")}
        if "category" not in cols:
            self.conn.execute(
                "ALTER TABLE job_offers ADD COLUMN category TEXT NOT NULL DEFAULT 'job'"
            )
            self.conn.commit()
            _log_warning("Colonne `category` ajoutée à job_offers (migration).")
        if "deadline" not in cols:
            self.conn.execute("ALTER TABLE job_offers ADD COLUMN deadline TEXT")
            self.conn.commit()
        if "clicks_count" not in cols:
            self.conn.execute(
                "ALTER TABLE job_offers ADD COLUMN clicks_count INTEGER NOT NULL DEFAULT 0"
            )
            self.conn.commit()

    # ------------------------------------------------------------------
    # Logs scraper
    # ------------------------------------------------------------------
    def add_scraper_log(self, status: str, offers_added: int, message: str) -> int:
        assert self.conn is not None
        cur = self.conn.cursor()
        cur.execute(
            "INSERT INTO scraper_logs (status, offers_added, message) VALUES (?, ?, ?) RETURNING id",
            (status, offers_added, message),
        )
        res = cur.fetchone()
        log_id = int(res["id"]) if res else 0
        self._supabase_insert_log(status, offers_added, message)
        return log_id

    def _supabase_insert_log(self, status: str, offers_added: int, message: str) -> None:
        if self.supabase is None:
            return
        try:
            self.supabase.table("scraper_logs").insert(
                {"status": status, "offers_added": int(offers_added), "message": message}
            ).execute()
        except Exception as exc:
            _log_warning(f"Échec de l'insertion du log Supabase : {exc}")

    def finish_scraper_log(self, log_id: int, status: str, offers_added: int, message: str) -> None:
        assert self.conn is not None
        self.conn.execute(
            "UPDATE scraper_logs SET status = ?, offers_added = ?, message = ?, finished_at = datetime('now') WHERE id = ?",
            (status, offers_added, message, log_id),
        )
        if self.supabase is not None:
            try:
                data = (
                    self.supabase.table("scraper_logs")
                    .select("id")
                    .eq("status", "running")
                    .order("started_at", desc=True)
                    .limit(1)
                    .execute()
                )
                rows = data.data or []
                if rows:
                    self.supabase.table("scraper_logs").update(
                        {
                            "status": status,
                            "offers_added": int(offers_added),
                            "message": message,
                            "finished_at": datetime.utcnow().isoformat(),
                        }
                    ).eq("id", rows[0]["id"]).execute()
            except Exception as exc:
                _log_warning(f"Échec de la finalisation du log Supabase : {exc}")

    # ------------------------------------------------------------------
    # Upsert d'un contenu (jobs, stages, bourses, concours)
    # ------------------------------------------------------------------
    def upsert(self, item: ContentItem) -> tuple[str, bool]:
        """Insère ou met à jour un contenu. Retourne (id, was_created)."""
        assert self.conn is not None
        cur = self.conn.cursor()

        cur.execute(
            "SELECT id FROM job_offers WHERE source_url = ? OR (title = ? AND company = ?) LIMIT 1",
            (item.source_url, item.title, item.company),
        )
        row = cur.fetchone()
        now = datetime.now().isoformat()

        apply_link = item.application_url or (item.source_url if not item.application_email else None)
        apply_email = item.application_email

        if row:
            job_id = row["id"]
            cur.execute(
                "SELECT status, is_expired, category FROM job_offers WHERE id = ?", (job_id,)
            )
            current = cur.fetchone()
            current_status = current["status"] if current else "pending"
            current_expired = bool(current["is_expired"]) if current else False
            current_category = current["category"] if current else "job"

            # Ne jamais re-classifier un contenu déjà modéré (publié / rejeté /
            # archivé) : la catégorie n'évolue que pour les contenus encore en
            # file 'pending'. Évite qu'un re-scrape fasse disparaître une offre
            # publiée de sa page publique (ex. /jobs) suite à un verdict IA.
            target_category = (
                item.category_sql() if current_status == "pending" else (current_category or "job")
            )

            if current_expired and item.deadline and item.deadline > datetime.now():
                target_status = "pending"
                is_expired_val = 0
            else:
                target_status = item.status if current_status in ("pending",) else current_status
                is_expired_val = 0 if not current_expired else 1

            cur.execute(
                """
                UPDATE job_offers
                SET category = ?, contract_type = ?, location = ?, description = ?, source_website = ?,
                    status = ?, seo_title = ?, seo_description = ?, seo_keywords = ?, slug = ?,
                    apply_link = ?, apply_email = ?, deadline = ?, is_expired = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    target_category,
                    item.contract_type_sql(),
                    item.location,
                    item.description,
                    item.source,
                    target_status,
                    item.seo_title,
                    item.seo_description,
                    item.seo_keywords,
                    item.slug,
                    apply_link,
                    apply_email,
                    item.deadline.isoformat() if item.deadline else None,
                    is_expired_val,
                    now,
                    job_id,
                ),
            )
            self.conn.commit()
            self._supabase_upsert(item, apply_link, apply_email, target_status, is_expired_val)
            return job_id, False

        cur.execute(
            """
            INSERT INTO job_offers (
                category, title, company, location, contract_type, description, apply_link, apply_email,
                deadline, source_url, source_website, status, seo_title, seo_description, seo_keywords,
                slug, is_verified, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            RETURNING id
            """,
            (
                item.category_sql(),
                item.title,
                item.company,
                item.location,
                item.contract_type_sql(),
                item.description,
                apply_link,
                apply_email,
                item.deadline.isoformat() if item.deadline else None,
                item.source_url,
                item.source,
                item.status,
                item.seo_title,
                item.seo_description,
                item.seo_keywords,
                item.slug,
                now,
                now,
            ),
        )
        res = cur.fetchone()
        self.conn.commit()
        if res:
            self._supabase_upsert(item, apply_link, apply_email, item.status)
            return res["id"], True
        return "", False

    def _supabase_upsert(
        self,
        item: ContentItem,
        apply_link: Any,
        apply_email: Any,
        target_status: str,
        is_expired: int = 0,
    ) -> None:
        """Miroir Supabase de `upsert` (même logique de déduplication)."""
        if self.supabase is None:
            return
        try:
            table = self.supabase.table("job_offers")

            existing: Dict[str, Any] | None = None
            if item.source_url:
                # `source_url` n'est pas unique en base : .limit(1) reproduit la
                # logique SQLite (LIMIT 1) sans risque d'erreur .maybe_single().
                resp = (
                    table.select("id,status,is_expired,category")
                    .eq("source_url", item.source_url)
                    .limit(1)
                    .execute()
                )
                rows = resp.data or []
                if rows:
                    existing = rows[0]
            if existing is None and item.title and item.company:
                resp = (
                    table.select("id,status,is_expired,category")
                    .eq("title", item.title)
                    .eq("company", item.company)
                    .limit(1)
                    .execute()
                )
                rows = resp.data or []
                if rows:
                    existing = rows[0]

            if existing and existing.get("is_expired") and item.deadline and item.deadline > datetime.now():
                target_status = "pending"
                is_expired = 0

            # Même garde que SQLite : pas de re-classification d'un contenu modéré.
            category = item.category_sql()
            if existing and str(existing.get("status", "pending")) != "pending":
                category = str(existing.get("category") or "job")

            payload = {
                "category": category,
                "title": item.title,
                "company": item.company,
                "location": item.location,
                "contract_type": item.contract_type_sql(),
                "description": item.description,
                "apply_link": apply_link,
                "apply_email": apply_email,
                "deadline": item.deadline.isoformat() if item.deadline else None,
                "source_url": item.source_url,
                "source_website": item.source,
                "status": target_status,
                "is_expired": is_expired,
                "seo_title": item.seo_title,
                "seo_description": item.seo_description,
                "seo_keywords": item.seo_keywords,
                "slug": item.slug,
            }

            if existing:
                table.update(payload).select("id").eq("id", existing["id"]).execute()
            else:
                table.insert(payload).execute()
        except Exception as exc:
            _log_warning(f"Échec de l'upsert Supabase : {exc}")

    # ------------------------------------------------------------------
    # Purge démo & expiration
    # ------------------------------------------------------------------
    def purge_demo_offers(self) -> int:
        """Supprime les anciens contenus « démo » (seed/fallbacks) de la BDD."""
        assert self.conn is not None
        placeholders = ",".join("?" for _ in _DEMO_SOURCE_URLS)
        cur = self.conn.execute(
            f"DELETE FROM job_offers WHERE source_url LIKE '%demo%' OR source_url IN ({placeholders})",
            tuple(_DEMO_SOURCE_URLS),
        )
        deleted = cur.rowcount
        self.conn.commit()
        return deleted

    def expire_overdue_offers(self) -> int:
        """Expire les offres dont la deadline est dépassée (is_expired=1 / archived)."""
        assert self.conn is not None
        now = datetime.now().isoformat()
        cur = self.conn.execute(
            "UPDATE job_offers SET is_expired = 1, status = 'archived', updated_at = ? "
            "WHERE deadline IS NOT NULL AND deadline < ? AND status IN ('pending','published')",
            (now, now),
        )
        self.conn.commit()
        count = cur.rowcount

        # Miroir Supabase (production / CI) : la base SQLite y est vide, la
        # logique doit aussi s'appliquer côté Supabase.
        if self.supabase is not None:
            try:
                resp = (
                    self.supabase.table("job_offers")
                    .update({"is_expired": True, "status": "archived", "updated_at": now})
                    .lt("deadline", now)
                    .in_("status", ["pending", "published"])
                    .select("id")
                    .execute()
                )
                count = max(count, len(resp.data or []))
            except Exception as exc:
                _log_warning(f"Échec expiration Supabase : {exc}")
        return count

    def auto_publish_pending(self, max_age_minutes: int = 21) -> int:
        """
        Validation & publication AUTOMATIQUES des contenus restés en statut
        'pending' depuis plus de `max_age_minutes` minutes.

        L'admin garde la main pendant les 21 premières minutes : s'il se
        connecte, il peut modérer normalement. S'il n'est pas disponible, les
        offres collectées sont publiées d'elles-mêmes (jamais bloquées en
        file d'attente).
        """
        assert self.conn is not None
        now = datetime.now().isoformat()
        cutoff = (datetime.now() - timedelta(minutes=max_age_minutes)).isoformat()
        cur = self.conn.execute(
            "UPDATE job_offers SET status = 'published', is_verified = 1, updated_at = ? "
            "WHERE status = 'pending' AND created_at < ?",
            (now, cutoff),
        )
        self.conn.commit()
        count = cur.rowcount

        # Miroir Supabase (production / CI) : la base SQLite y est vide, la
        # logique doit aussi s'appliquer côté Supabase.
        if self.supabase is not None:
            try:
                resp = (
                    self.supabase.table("job_offers")
                    .update({"status": "published", "is_verified": True})
                    .eq("status", "pending")
                    .lt("created_at", cutoff)
                    .select("id")
                    .execute()
                )
                count = max(count, len(resp.data or []))
            except Exception as exc:
                _log_warning(f"Échec auto-publication Supabase : {exc}")
        return count

    def purge_old_offers(self, max_age_days: int = 21) -> int:
        """
        Suppression AUTOMATIQUE des offres âgées de plus de `max_age_days`
        jours. Une offre dont la date limite (deadline) est encore dans le
        futur est conservée, même si elle a plus de 21 jours : on ne supprime
        jamais une annonce toujours active.
        """
        assert self.conn is not None
        now = datetime.now().isoformat()
        cutoff = (datetime.now() - timedelta(days=max_age_days)).isoformat()
        cur = self.conn.execute(
            "DELETE FROM job_offers "
            "WHERE created_at < ? AND (deadline IS NULL OR deadline < ?)",
            (cutoff, now),
        )
        self.conn.commit()
        count = cur.rowcount

        # Miroir Supabase (production / CI).
        if self.supabase is not None:
            try:
                resp = (
                    self.supabase.table("job_offers")
                    .delete()
                    .lt("created_at", cutoff)
                    .is_("deadline", None)
                    .select("id")
                    .execute()
                )
                count += len(resp.data or [])
                resp = (
                    self.supabase.table("job_offers")
                    .delete()
                    .lt("created_at", cutoff)
                    .lt("deadline", now)
                    .select("id")
                    .execute()
                )
                count += len(resp.data or [])
            except Exception as exc:
                _log_warning(f"Échec purge Supabase : {exc}")
        return count

    def stats(self) -> Dict[str, int]:
        assert self.conn is not None
        cur = self.conn.execute(
            "SELECT COUNT(*), SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END), "
            "SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) FROM job_offers;"
        )
        tot, pen, pub = cur.fetchone() or (0, 0, 0)
        by_category = {}
        for row in self.conn.execute(
            "SELECT category, COUNT(*) AS c FROM job_offers GROUP BY category"
        ):
            by_category[str(row["category"])] = int(row["c"])
        return {
            "total": tot or 0,
            "pending": pen or 0,
            "published": pub or 0,
            "by_category": by_category,
        }
