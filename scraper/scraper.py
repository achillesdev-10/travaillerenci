#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/scraper.py
  Runner principal du moteur de scraping multi-sources (Côte d'Ivoire)

  PIPELINE :
      1. Collecte brute (emplois, stages, bourses, concours) — sources réelles
      2. Nettoyage & structuration des descriptions
      3. Enrichissement IA (Gemini) : classification + réécriture Markdown
         (repli heuristique si la clé GEMINI_API_KEY est absente)
      4. Validation qualité (filtre géographique pour emplois/stages)
      5. Déduplication
      6. Enregistrement en statut 'pending' → file de MODÉRATION ADMIN

  Exemples :
      python scraper/scraper.py                          # tout, 10/site
      python scraper/scraper.py --dry-run                # affichage seul
      python scraper/scraper.py --max-per-site 25
      python scraper/scraper.py --no-ai                  # sans Gemini
      python scraper/scraper.py --purge-demo             # purge données démo
===============================================================================
"""

from __future__ import annotations

import argparse
import io
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Type

# Fix console encoding for Windows
def _fix_console() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace", line_buffering=True)


_fix_console()

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "travaillerenci.sqlite3"
SCRAPER_HEALTH_JSON = DATA_DIR / "admin-scraper-health.json"

# Permet l'exécution directe `python scraper/scraper.py`
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Secrets locaux (.env.local gitignoré) : GROQ_API_KEY, GEMINI_API_KEY…
# Ne remplace JAMAIS une variable déjà présente (CI/Vercel gardent la priorité).
from scraper.core.env_loader import load_env_file

load_env_file()

from scraper.core.logger import setup_logger
from scraper.core.http_client import HttpClient
from scraper.core.duplicate_detector import DuplicateDetector
from scraper.core.cleaner import clean_item
from scraper.core.base_scraper import BaseScraper
from scraper.core.gemini import GeminiEnricher
from scraper.core.scheduler import JobScheduler
from scraper.models.content_item import ContentItem
from scraper.database.repository import JobRepository
from scraper.database.exam_repository import ExamRepository

# Scrapers actifs — sources VÉRIFIÉES en HTTP simple (les anciennes sources
# novojob / rmo / emploiivoire / jobivoire2 / emploi.ci étaient mortes ou
# bloquées, elles ont été retirées).
from scraper.scrapers.educarriere import EducarriereScraper
from scraper.scrapers.emploici import EmploiciScraper
from scraper.scrapers.boursedetude import BourseDetudeScraper

logger = setup_logger("travaillerenci_runner")

SCRAPER_REGISTRY: Dict[str, Type[BaseScraper]] = {
    "educarriere": EducarriereScraper,
    "emploici": EmploiciScraper,
    "boursedetude": BourseDetudeScraper,
}

# Sites par défaut (ordres de priorité : offres → bourses → concours).
DEFAULT_SITES = "educarriere,emploici,boursedetude"

CATEGORY_LABELS = {
    "job": "Emploi",
    "internship": "Stage",
    "scholarship": "Bourse",
    "exam": "Concours",
}


def _is_demo_source_url(url: str) -> bool:
    """Détecte les URLs d'annonces « démo » générées par les anciens fallbacks."""
    u = (url or "").lower()
    return "/demo" in u or "demo-data" in u or u.startswith("demo-") or "-demo-" in u


def _write_admin_health(
    status: str,
    offers_added: int | None = None,
    message: str | None = None,
) -> None:
    """État du scraper lu par le dashboard Next.js."""
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "status": status,
            "lastRunAt": datetime.now(datetime.UTC).isoformat().replace("+00:00", "Z"),
            "offersAdded": offers_added if offers_added is not None else None,
            "message": message,
        }
        import json

        tmp = SCRAPER_HEALTH_JSON.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(SCRAPER_HEALTH_JSON)
    except Exception as exc:
        logger.debug(f"Écriture admin-scraper-health.json impossible : {exc}")


def run_scraping_pipeline(
    site_names: List[str],
    max_per_site: int,
    dry_run: bool,
    demo_data: bool = False,
    use_ai: bool = True,
) -> int:
    logger.info("=" * 60)
    logger.info("🚀 Démarrage du pipeline de scraping TravaillerEnCi")
    logger.info(f"   Sites cibles : {site_names}")
    logger.info(f"   Max par site : {max_per_site}")
    logger.info(f"   Mode Dry-Run : {dry_run}")
    logger.info(f"   Données démo autorisées : {demo_data}")
    logger.info(f"   Enrichissement IA : {'OUI' if use_ai else 'non (heuristique)'}")
    logger.info("=" * 60)

    run_log_id = None
    start_msg = f"Scraping lancé : {', '.join(site_names)} (max {max_per_site}/site)"
    if not dry_run:
        _write_admin_health("running", None, start_msg)
        try:
            with JobRepository(DB_PATH) as repo:
                run_log_id = repo.add_scraper_log("running", 0, start_msg)
        except Exception as exc:
            logger.warning(f"Impossible d'écrire le log de démarrage : {exc}")

    http_client = HttpClient()
    enricher = GeminiEnricher() if use_ai else GeminiEnricher(api_key=None)
    dup_detector = DuplicateDetector()
    all_items: List[ContentItem] = []
    per_category: Dict[str, int] = {"job": 0, "internship": 0, "scholarship": 0, "exam": 0}

    for name in site_names:
        scraper_class = SCRAPER_REGISTRY.get(name)
        if not scraper_class:
            logger.error(f"❌ Scraper '{name}' inconnu. Disponibles : {list(SCRAPER_REGISTRY.keys())}")
            continue

        logger.info(f"▶ Lancement du scraper : {name}")
        try:
            scraper = scraper_class(http_client)
            raw_items = scraper.scrape(max_offers=max_per_site)
            logger.info(f"  ✓ [{name}] {len(raw_items)} contenus bruts collectés.")

            for item in raw_items:
                # 0. Garde-fou : jamais de données « démo » en production.
                if not demo_data and _is_demo_source_url(item.source_url):
                    logger.warning(f"  ⛔ Contenu de démonstration ignoré : {item.title[:50]} ({item.source_url})")
                    continue

                # 1. Nettoyage & structuration de la description.
                try:
                    clean_item(item)
                except Exception as exc:
                    logger.warning(f"  ⚠ Nettoyage impossible pour {item.title[:50]}: {exc}")

                # 2. Enrichissement IA : classification + réécriture (jamais bloquant).
                #    Sans clé Gemini, `enrich()` retombe sur les heuristiques locales
                #    pour que stages / concours ne soient jamais classés par défaut
                #    en « emploi ».
                try:
                    enricher.enrich(item)
                except Exception as exc:
                    logger.warning(f"  ⚠ Enrichissement IA impossible : {exc}")

                # 3. Validation qualité.
                ok, reason = item.is_valid()
                if not ok:
                    logger.debug(f"  🚫 Contenu rejeté ({reason}): {item.title[:50]} @ {item.company}")
                    continue
                ok, reason = item.is_valid_ivorian()
                if not ok:
                    logger.debug(f"  🚫 Contenu hors ciblage ({reason}): {item.title[:50]}")
                    continue

                # 4. Détection doublons (dans ce run).
                if dup_detector.is_duplicate(item):
                    logger.debug(f"  🔁 Doublon détecté : {item.title[:50]}")
                    continue

                # 5. Slug & SEO par défaut si absent.
                if not item.slug:
                    from slugify import slugify

                    item.slug = slugify(f"{item.title}-{item.company}", separator="-")
                if not item.seo_title:
                    item.seo_title = f"{item.title} | TravaillerEnCi"
                if not item.seo_description:
                    label = CATEGORY_LABELS.get(item.category_sql(), "Opportunité")
                    base = f"{label} : {item.title} — {item.company} ({item.location})."
                    if item.category_sql() in ("job", "internship") and item.contract_type != "CDI":
                        base += f" Contrat {item.contract_type}."
                    item.seo_description = (
                        base + " Missions, profil recherché et procédure de candidature sur TravaillerEnCi."
                    )[:180]

                per_category[item.category_sql()] = per_category.get(item.category_sql(), 0) + 1
                all_items.append(item)
        except Exception as exc:
            logger.error(f"  ❌ Erreur critique sur le scraper {name}: {exc}", exc_info=True)

    http_client.close()
    enricher.close()

    cat_summary = ", ".join(f"{CATEGORY_LABELS[k]}={v}" for k, v in per_category.items() if v)
    logger.info(f"\n📊 Bilan collecte : {len(all_items)} contenus valides uniques prêts à l'enregistrement.")
    if cat_summary:
        logger.info(f"   Répartition : {cat_summary}")

    if dry_run:
        for idx, item in enumerate(all_items, 1):
            print(
                f"  {idx}. [{item.category.upper():10}] {item.title[:60]} — {item.company[:40]} "
                f"({item.location[:30]}) [Source: {item.source}]"
            )
        return 0

    created_count = 0
    updated_count = 0
    try:
        with JobRepository(DB_PATH) as repo:
            # Purge des anciennes données « démo » avant insertion.
            purged = repo.purge_demo_offers()
            if purged:
                logger.info(f"   🗑  {purged} contenu(s) de démonstration purgé(s).")

            for item in all_items:
                _, was_created = repo.upsert(item)
                if was_created:
                    created_count += 1
                else:
                    updated_count += 1
            expired_count = repo.expire_overdue_offers()
            if expired_count:
                logger.info(f"   ⏰ Contenus expirés automatiquement : {expired_count}")

            # Publication automatique : les contenus en attente depuis plus de
            # 21 min (admin non connecté) sont validés et publiés.
            auto_published = repo.auto_publish_pending()
            if auto_published:
                logger.info(f"   ⚡ Contenus en attente validés & publiés automatiquement (≥ 21 min) : {auto_published}")

            # Suppression automatique : les offres de plus de 21 jours (deadline
            # passée ou absente) sont purgées de la base.
            purged_old = repo.purge_old_offers()
            if purged_old:
                logger.info(f"   🗑  Offres supprimées automatiquement (plus de 21 jours) : {purged_old}")

            st = repo.stats()
    except Exception as exc:
        logger.error(f"❌ Erreur d'enregistrement en BDD : {exc}", exc_info=True)
        err_msg = f"Erreur BDD : {exc}"
        if run_log_id is not None:
            try:
                with JobRepository(DB_PATH) as repo:
                    repo.finish_scraper_log(run_log_id, "error", created_count, err_msg)
            except Exception:
                pass
        _write_admin_health("error", created_count, err_msg)
        return 1

    logger.info(f"✅ Enregistrement BDD terminé !")
    logger.info(f"   Nouveaux contenus (pending) : {created_count}")
    logger.info(f"   Contenus mis à jour        : {updated_count}")
    logger.info(
        f"   Statistiques BDD : Total={st['total']}, En attente={st['pending']}, "
        f"Publiées={st['published']}, {st.get('by_category', {})}"
    )

    end_msg = (
        f"Scraping terminé : {created_count} nouveau(x) contenu(s), {updated_count} mis à jour."
        + (f" [{cat_summary}]" if cat_summary else "")
    )
    if run_log_id is not None:
        try:
            with JobRepository(DB_PATH) as repo:
                repo.finish_scraper_log(run_log_id, "success", created_count, end_msg)
        except Exception as exc:
            logger.warning(f"Impossible de finaliser le log : {exc}")
    _write_admin_health("success", created_count, end_msg)
    return 0


def purge_demo_offers() -> int:
    """Supprime de la BDD les anciens contenus « démo » (source_url factice)."""
    try:
        with JobRepository(DB_PATH) as repo:
            deleted = repo.purge_demo_offers()
        logger.info(f"🗑  {deleted} contenu(s) de démonstration supprimé(s) de la BDD.")
        return 0
    except Exception as exc:
        logger.error(f"❌ Purge impossible : {exc}", exc_info=True)
        return 1


def run_maintenance() -> int:
    """
    Tâche de maintenance automatique, SANS scraping :
      • publication des contenus en attente depuis ≥ 21 minutes
      • suppression des offres âgées de plus de 21 jours
      • expiration des offres dont la deadline est dépassée
      • suppression des concours dont l'information a plus de 5 semaines

    Utilisée par le workflow GitHub Actions (exécution fréquente) pour que la
    modération automatique fonctionne même quand personne ne se connecte.
    """
    try:
        with JobRepository(DB_PATH) as repo:
            auto_published = repo.auto_publish_pending()
            purged_old = repo.purge_old_offers()
            expired = repo.expire_overdue_offers()
    except Exception as exc:
        logger.error(f"❌ Maintenance (offres) impossible : {exc}", exc_info=True)
        return 1

    exam_auto_published = 0
    exam_purged = 0
    try:
        with ExamRepository(DB_PATH) as exam_repo:
            # Publication automatique des concours en attente ≥ 21 min
            # (même règle que les offres : l'admin garde la main au début).
            exam_auto_published = exam_repo.auto_publish_pending()
            exam_purged = exam_repo.purge_old_exams()
    except Exception as exc:
        logger.error(f"❌ Maintenance (concours) impossible : {exc}", exc_info=True)
        return 1

    if auto_published:
        logger.info(f"⚡ {auto_published} contenu(s) en attente publié(s) automatiquement (≥ 21 min).")
    if purged_old:
        logger.info(f"🗑  {purged_old} offre(s) supprimée(s) automatiquement (plus de 21 jours).")
    if expired:
        logger.info(f"⏰ {expired} contenu(s) expiré(s) (deadline dépassée).")
    if exam_auto_published:
        logger.info(f"⚡ {exam_auto_published} concours en attente publié(s) automatiquement (≥ 21 min).")
    if exam_purged:
        logger.info(f"🗑  {exam_purged} concours supprimé(s) automatiquement (info > 5 semaines).")
    # Synthèse INCONDITIONNELLE (offres + concours) : les logs du workflow doivent
    # toujours montrer que la table `exams` a été traitée, même quand aucun
    # concours n'était éligible — c'est le log qui a manqué lors du diagnostic
    # du « 0 concours recensés » sur /concours.
    logger.info(
        f"📋 Maintenance terminée — Offres : {auto_published} publiée(s), {purged_old} purgée(s), "
        f"{expired} expirée(s) | Concours : {exam_auto_published} publié(s), {exam_purged} purgé(s)."
    )
    if not (auto_published or purged_old or expired or exam_auto_published or exam_purged):
        logger.info("Maintenance : rien à faire (aucun contenu éligible).")
    return 0


def main():
    parser = argparse.ArgumentParser(description="TravaillerEnCi Scraper Engine - Côte d'Ivoire")
    parser.add_argument(
        "--sites",
        type=str,
        default=DEFAULT_SITES,
        help=f"Liste des scrapers séparés par des virgules (défaut: {DEFAULT_SITES} ou 'all')",
    )
    parser.add_argument("--max-per-site", type=int, default=10, help="Nombre max de contenus par site")
    parser.add_argument("--dry-run", action="store_true", help="Afficher sans sauvegarder en BDD")
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Autoriser les contenus de démonstration (uniquement pour les tests)",
    )
    parser.add_argument(
        "--no-ai",
        action="store_true",
        help="Désactiver l'enrichissement IA (classification heuristique)",
    )
    parser.add_argument(
        "--purge-demo",
        action="store_true",
        help="Supprimer les anciens contenus « démo » déjà enregistrés en BDD puis quitter",
    )
    parser.add_argument(
        "--maintenance-only",
        action="store_true",
        help="Sans scraping : publie les contenus en attente (≥ 21 min), supprime les offres de plus de 21 jours, expire les deadlines dépassées, puis quitte",
    )
    parser.add_argument("--schedule", type=str, choices=["hourly", "6h", "daily"], help="Lancer via le scheduler")
    args = parser.parse_args()

    if args.purge_demo:
        sys.exit(purge_demo_offers())

    if args.maintenance_only:
        sys.exit(run_maintenance())

    sites = [s.strip().lower() for s in args.sites.split(",") if s.strip()]
    if "all" in sites:
        sites = list(SCRAPER_REGISTRY.keys())

    demo_data = args.demo or os.getenv("TRAVAILLERENCI_DEMO_DATA") == "1"
    use_ai = not args.no_ai and os.getenv("TRAVAILLERENCI_NO_AI") != "1"
    target_func = lambda: run_scraping_pipeline(
        sites, args.max_per_site, args.dry_run, demo_data, use_ai
    )

    if args.schedule:
        scheduler = JobScheduler(target_func)
        if args.schedule == "hourly":
            scheduler.schedule_hourly()
        elif args.schedule == "6h":
            scheduler.schedule_every_6_hours()
        elif args.schedule == "daily":
            scheduler.schedule_daily()
        scheduler.start()
    else:
        sys.exit(target_func())


if __name__ == "__main__":
    main()
