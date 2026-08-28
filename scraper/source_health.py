#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/source_health.py
  Suivi de santé par source : historique, seuil minimal, alertes automatiques

  Historise le nombre d'offres collectées par source lors de chaque run.
  Si une source retourne significativement moins que sa moyenne habituelle
  (< 20% de la moyenne des 7 derniers runs), le run est marqué suspect et
  une alerte est envoyée (email Resend + WhatsApp Meta Cloud API).

  Stockage : fichier JSON (data/source-health.json) + SQLite (scraper_logs)
  pour compatibilité avec le dashboard admin existant.
===============================================================================
"""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from scraper.core.logger import setup_logger

logger = setup_logger("source_health")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
HEALTH_JSON = DATA_DIR / "source-health.json"
DB_PATH = DATA_DIR / "travaillerenci.sqlite3"

# Historique conservé (runs)
HISTORY_WINDOW = 7
# Seuil minimal (fraction de la moyenne historique)
DEFAULT_THRESHOLD = 0.20


class SourceHealthRecord:
    """Statistiques d'un run pour une source donnée."""

    def __init__(
        self,
        source: str,
        collected: int,
        published: int = 0,
        errors: int = 0,
        duration_seconds: float = 0.0,
        threshold_ok: bool = True,
        timestamp: Optional[str] = None,
    ):
        self.source = source
        self.collected = collected
        self.published = published
        self.errors = errors
        self.duration_seconds = duration_seconds
        self.threshold_ok = threshold_ok
        self.timestamp = timestamp or datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "collected": self.collected,
            "published": self.published,
            "errors": self.errors,
            "duration_seconds": round(self.duration_seconds, 2),
            "threshold_ok": self.threshold_ok,
            "timestamp": self.timestamp,
        }


class SourceHealthTracker:
    """Tracker de santé par source avec historique et alertes."""

    def __init__(self, threshold: float = DEFAULT_THRESHOLD):
        self.threshold = threshold
        self._history: Dict[str, List[Dict[str, Any]]] = self._load_history()
        self._current_run: Dict[str, SourceHealthRecord] = {}

    def _load_history(self) -> Dict[str, List[Dict[str, Any]]]:
        """Charge l'historique depuis le fichier JSON."""
        if not HEALTH_JSON.exists():
            return {}
        try:
            data = json.loads(HEALTH_JSON.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (json.JSONDecodeError, OSError):
            return {}

    def _save_history(self) -> None:
        """Sauvegarde l'historique dans le fichier JSON."""
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            tmp = HEALTH_JSON.with_suffix(".tmp")
            tmp.write_text(
                json.dumps(self._history, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            tmp.replace(HEALTH_JSON)
        except OSError as exc:
            logger.warning(f"Écriture source-health.json impossible : {exc}")

    def record_run(
        self,
        source: str,
        collected: int,
        published: int = 0,
        errors: int = 0,
        duration_seconds: float = 0.0,
    ) -> SourceHealthRecord:
        """Enregistre les résultats d'un run pour une source."""
        # Vérification du seuil minimal
        avg = self._average_collected(source)
        threshold_ok = True
        if avg is not None and avg > 0:
            threshold_ok = collected >= avg * self.threshold

        record = SourceHealthRecord(
            source=source,
            collected=collected,
            published=published,
            errors=errors,
            duration_seconds=duration_seconds,
            threshold_ok=threshold_ok,
        )

        # Mise à jour de l'historique
        if source not in self._history:
            self._history[source] = []
        self._history[source].append(record.to_dict())
        # Fenêtre glissante : garde les N derniers runs
        self._history[source] = self._history[source][-HISTORY_WINDOW:]

        self._current_run[source] = record
        self._save_history()

        return record

    def _average_collected(self, source: str) -> Optional[float]:
        """Moyenne du nombre d'offres collectées sur les runs historiques."""
        runs = self._history.get(source, [])
        if len(runs) < 2:
            return None
        values = [r.get("collected", 0) for r in runs[:-1]]  # exclut le run en cours
        if not values:
            return None
        return sum(values) / len(values)

    def get_success_rate(self, source: str, window: int = HISTORY_WINDOW) -> float:
        """Taux de succès (runs sans erreur / total) sur une fenêtre donnée."""
        runs = self._history.get(source, [])[-window:]
        if not runs:
            return 1.0  # pas d'historique → optimiste
        successes = sum(1 for r in runs if r.get("errors", 0) == 0)
        return successes / len(runs)

    def get_stats_summary(self) -> Dict[str, Dict[str, Any]]:
        """Résumé de santé par source pour le dashboard admin."""
        summary: Dict[str, Dict[str, Any]] = {}
        for source, runs in self._history.items():
            if not runs:
                continue
            latest = runs[-1]
            avg = self._average_collected(source)
            summary[source] = {
                "latest_collected": latest.get("collected", 0),
                "latest_published": latest.get("published", 0),
                "latest_errors": latest.get("errors", 0),
                "latest_duration": latest.get("duration_seconds", 0),
                "latest_timestamp": latest.get("timestamp", ""),
                "threshold_ok": latest.get("threshold_ok", True),
                "average_collected": round(avg, 1) if avg is not None else None,
                "success_rate": round(self.get_success_rate(source), 2),
                "runs_tracked": len(runs),
            }
        return summary

    def check_and_alert(self) -> List[Dict[str, Any]]:
        """Vérifie les seuils et retourne les alertes à envoyer."""
        alerts: List[Dict[str, Any]] = []

        for source, record in self._current_run.items():
            # Alerte si la source a échoué complètement (0 offres)
            if record.collected == 0 and record.errors > 0:
                alerts.append({
                    "source": source,
                    "type": "complete_failure",
                    "collected": 0,
                    "expected": self._average_collected(source),
                    "message": (
                        f"❌ La source {source} a échoué complètement "
                        f"({record.errors} erreur(s))."
                    ),
                })
            # Alerte si en dessous du seuil minimal
            elif not record.threshold_ok:
                avg = self._average_collected(source)
                avg_str = f"{avg:.1f}" if avg is not None else "0"
                alerts.append({
                    "source": source,
                    "type": "low_volume",
                    "collected": record.collected,
                    "expected": round(avg, 1) if avg else 0,
                    "message": (
                        f"⚠️ La source {source} a retourné {record.collected} offre(s), "
                        f"soit moins de {self.threshold * 100:.0f}% de la moyenne "
                        f"({avg_str}). Changement de structure probable."
                    ),
                })

        return alerts


def send_scraper_alerts(alerts: List[Dict[str, Any]], run_time: Optional[str] = None) -> None:
    """Envoie les alertes par email (Resend) et WhatsApp (Meta Cloud API).

    Ne lève JAMAIS — un échec d'envoi est loggé et ignoré.
    """
    if not alerts:
        return

    try:
        import httpx
    except ImportError:
        logger.warning("module httpx manquant — alertes non envoyées.")
        return

    site_url = (os.getenv("NEXT_PUBLIC_SITE_URL") or "https://travaillerenci.vercel.app").rstrip("/")
    time_label = run_time or datetime.now(timezone.utc).strftime("%H:%M UTC")

    subject = f"🚨 Alerte Scraper TravaillerEnCi — {len(alerts)} source(s) suspecte(s)"
    body_lines = [
        f"🚨 Alerte Scraper — {time_label}",
        "",
    ]
    for alert in alerts:
        body_lines.append(alert["message"])
    body_lines.append("")
    body_lines.append(f"Dashboard : {site_url}/cz7tk")
    body_text = "\n".join(body_lines)

    # --- Email (Resend) ---
    api_key = os.getenv("RESEND_API_KEY")
    if api_key:
        try:
            import html as html_mod

            html_body = (
                "<!DOCTYPE html><html><body style='font-family:Arial,sans-serif;padding:20px;'>"
                f"<h2 style='color:#dc2626;'>🚨 Alerte Scraper TravaillerEnCi</h2>"
                f"<p style='color:#6b7280;'>{time_label}</p>"
                "<ul>"
            )
            for alert in alerts:
                html_body += f"<li style='margin:8px 0;'>{html_mod.escape(alert['message'])}</li>"
            html_body += (
                f"</ul><p><a href='{site_url}/cz7tk' style='color:#059669;'>→ Dashboard Admin</a></p>"
                "</body></html>"
            )
            httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "from": os.getenv("EMAIL_FROM") or "TravaillerEnCi <noreply@travaillerenci.ci>",
                    "to": os.getenv("ADMIN_EMAIL", "achillesdev10@gmail.com"),
                    "subject": subject,
                    "html": html_body,
                },
                timeout=20.0,
            )
            logger.info(f"📧 Alerte email envoyée ({len(alerts)} source(s)).")
        except Exception as exc:
            logger.warning(f"Échec envoi email alerte : {exc}")

    # --- WhatsApp (Meta Cloud API) ---
    if os.getenv("WHATSAPP_NOTIFY_ENABLED") == "1":
        token = os.getenv("WHATSAPP_TOKEN")
        phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
        phone_to = os.getenv("ADMIN_WHATSAPP_PHONE")
        if token and phone_id and phone_to:
            try:
                httpx.post(
                    f"https://graph.facebook.com/v21.0/{phone_id}/messages",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json={
                        "messaging_product": "whatsapp",
                        "to": phone_to,
                        "type": "text",
                        "text": {"body": body_text},
                    },
                    timeout=20.0,
                )
                logger.info(f"📱 Alerte WhatsApp envoyée ({len(alerts)} source(s)).")
            except Exception as exc:
                logger.warning(f"Échec envoi WhatsApp alerte : {exc}")
