#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scripts/re-enrich-exams.py
  Ré-enrichissement IA des concours DÉJÀ en base (SQLite + Supabase)

  Objectif : les fiches existantes n'ont JAMAIS été réécrites par Gemini
  (le modèle par défaut gemini-2.0-flash était retiré → 404 → repli heuristique
  silencieux). Ce script reprend chaque fiche, ré-injecte le TEXTE BRUT source
  (description_md existante, ou texte réel extrait du PDF via pypdf) dans
  Gemini avec le modèle corrigé, puis met à jour les champs enrichis.

  Réutilisation : ExamRepository (miroir SQLite + Supabase si les variables
  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sont fournies).

  Usage :
      $env:SUPABASE_URL="..." ; $env:SUPABASE_SERVICE_ROLE_KEY="..."
      $env:GEMINI_API_KEY="..."
      python scripts/re-enrich-exams.py            # aperçu (dry-run)
      python scripts/re-enrich-exams.py --apply    # écrit réellement

  Garanties :
    • Les fiches rejetées ne sont PAS re-signalées (statut inchangé).
    • PDF sans couche texte extractible (scanné) → fiche laissée telle quelle.
    • Règles de pertinence ré-appliquées : une fiche re-jugée hors-sujet par
      l'IA est rejetée (rejet réversible, visible dans /admin/exams).
===============================================================================
"""

from __future__ import annotations

import argparse
import io
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scraper.core.gemini_exams import ExamGeminiEnricher
from scraper.core.http_client import HttpClient
from scraper.database.exam_repository import ExamRepository
from scraper.exam_sources import _extract_pdf_text
from scraper.models.exam_item import ExamItem, relevance_issues


def _fix_console() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)


_fix_console()

_PDF_RE = re.compile(r"\.pdf(?:[?#].*)?$", re.I)

# Template de seo_description produit par le repli HEURISTIQUE (pas de réécriture
# IA). Si le résultat de l'enrichissement porte ce template, l'appel Gemini a
# échoué (quota, réseau…) : on NE DOIT PAS écraser la fiche existante.
def _is_heuristic_fallback(item: ExamItem) -> bool:
    expected = (
        f"Concours : {item.title} — {item.organizer}. "
        "Dates, conditions d'éligibilité et lien officiel sur TravaillerEnCi."
    )[:160]
    return (item.seo_description or "") == expected

# Champs structurés recopiés depuis l'item enrichi vers la ligne BDD.
_ENRICHED_FIELDS = (
    "title", "organizer", "category", "exam_type", "description_md",
    "registration_start", "registration_end", "exam_date", "results_date",
    "age_min", "age_max", "age_reference_date", "nationality", "diplomas",
    "positions_count", "registration_fee", "location", "cities", "documents",
    "confidence", "seo_title", "seo_description", "seo_keywords", "slug",
)


def _patch_from_item(item: ExamItem) -> dict:
    patch = {}
    for field in _ENRICHED_FIELDS:
        value = getattr(item, field, None)
        if field in ("registration_start", "registration_end", "exam_date", "results_date") and value:
            value = value.isoformat()
        patch[field] = value
    return patch


def _raw_source_text(http: HttpClient, row: dict) -> str:
    """Texte brut source à ré-injecter dans Gemini.

    Priorité : texte réel extrait du PDF (pypdf) quand le fichier est un PDF ;
    sinon la description_md existante (le texte brut collecté par le scraper).
    Retourne "" si aucun texte exploitable.
    """
    url = str(row.get("source_url") or "")
    existing = str(row.get("description_md") or "").strip()
    if _PDF_RE.search(url):
        text = _extract_pdf_text(http, url)
        if text:
            return text[:20000]
        return ""  # PDF scanné : on ne touche pas à la fiche
    if len(existing) < 60:
        return ""
    return existing[:20000]


def main() -> int:
    parser = argparse.ArgumentParser(description="Ré-enrichissement IA des concours existants")
    parser.add_argument("--apply", action="store_true", help="Écrit réellement (sinon aperçu)")
    args = parser.parse_args()

    db_path = PROJECT_ROOT / "data" / "travaillerenci.sqlite3"
    enricher = ExamGeminiEnricher()
    http = HttpClient(timeout=45)

    updated = 0
    rejected_now = 0
    skipped = 0
    errors = 0

    with ExamRepository(db_path) as repo:
        rows = [
            r for r in repo.list_all()
            if str(r.get("status") or "") in ("published", "archived")
        ]
        print(f"📋 {len(rows)} fiches à ré-enrichir (published + archived).")
        for row in rows:
            exam_id = str(row["id"])
            old_title = str(row.get("title") or "")[:70]
            raw = _raw_source_text(http, row)
            if not raw:
                skipped += 1
                print(f"  ⏭️  {exam_id[:8]} — pas de texte source (PDF scanné) : {old_title}")
                continue
            item = ExamItem(
                title=str(row.get("title") or ""),
                organizer=str(row.get("organizer") or ""),
                category=str(row.get("category") or "administratif"),
                description_md=raw,
                source=str(row.get("source_website") or ""),
                source_url=str(row.get("source_url") or ""),
                documents=row.get("documents") or [],
                status=str(row.get("status") or "published"),
                confidence=str(row.get("confidence") or "medium"),
            )
            enricher.enrich(item)
            # Pacing : respecter le quota/minute de l'API Gemini.
            time.sleep(1.5)
            # L'appel Gemini a échoué (repli heuristique) : on ne réécrit PAS la
            # fiche existante (on éviterait de détruire une bonne réécriture et
            # on n'appliquerait pas le rejet attendu). On saute simplement.
            if _is_heuristic_fallback(item):
                print(f"  ⏸️  {exam_id[:8]} — Gemini indisponible (repli heuristique), fiche intacte : {old_title}")
                errors += 1
                continue
            if item.rejected or relevance_issues(
                rejected=bool(item.rejected),
                rejection_reason=item.rejection_reason,
                title=item.title,
                item=item,
            ):
                reason = item.rejection_reason or "page re-jugée hors-sujet par l'IA"
                print(f"  🗑️  {exam_id[:8]} — à REJETER ({reason}) : {item.title[:60]}")
                if args.apply:
                    repo.reject_exam(exam_id)
                rejected_now += 1
                continue
            patch = _patch_from_item(item)
            if args.apply:
                repo.update_exam(exam_id, patch)
            updated += 1
            print(f"  ✅ {exam_id[:8]} — « {old_title} » → « {item.title[:60]} »")
            if updated <= 2:
                print(f"        SEO : {item.seo_description}")
                print(f"        Dates : {item.registration_start} → {item.registration_end}")
                print(f"        Diplômes : {item.diplomas}")
                print(f"        Description : {item.description_md[:200]}…")

    http.close()
    enricher.close()

    print(f"\n📊 Ré-enrichissement terminé : {updated} enrichie(s), "
          f"{rejected_now} à rejeter, {skipped} sans texte (PDF scanné), {errors} erreur(s).")
    if not args.apply:
        print("🔎 Mode aperçu — relancez avec --apply pour écrire réellement.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
