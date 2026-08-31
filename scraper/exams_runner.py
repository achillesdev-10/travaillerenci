#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/exams_runner.py
  Runner du module Concours Administratifs (table `exams`)

  Pipeline :
      1. Lecture de la config centralisée scraper/config/exam_sources.json
      2. Vérification robots.txt de chaque source (sources interdites ignorées)
      3. Scraping brut (exam_sources.py)
      4. Réécriture 100% + extraction structurée via Gemini (gemini_exams.py),
         repli heuristique (exam_parser.py) si pas de clé
      4a. Filtrage qualité post-IA (relevance_issues) : pages hors-sujet
          (titres de rubrique/menu, aucune date ni condition, rejet explicite
          Gemini) écartées AVANT insertion
      4b. Contrôle anti-duplication (similarity_check.py) : si la réécriture est
          trop proche de la source (> seuil, défaut 30%), la fiche est marquée
          'low' et signalée à la modération pour réécriture manuelle.
      5. Validation + enregistrement en 'pending' → modération /admin/exams
      --cleanup-noise : repasse sur les fiches existantes et rejette les
          hors-sujet (dry-run par défaut, --apply pour écrire)
      --merge-duplicates : fusionne les doublons inter-sources détectés par
          similarité de titre (dry-run par défaut, --apply pour écrire)

  Exemples :
      python scraper/exams_runner.py
      python scraper/exams_runner.py --max-per-source 10
      python scraper/exams_runner.py --sources gucaci,ena
      python scraper/exams_runner.py --dry-run
      python scraper/exams_runner.py --no-ai
      python scraper/exams_runner.py --similarity-threshold 0.3
      python scraper/exams_runner.py --check-sources   # rapport robots.txt (docs)
      python scraper/exams_runner.py --cleanup-noise   # aperçu des fiches hors-sujet
      python scraper/exams_runner.py --cleanup-noise --apply  # les rejeter réellement
      python scraper/exams_runner.py --maintenance-only  # publication ≥ 21 min + purge 5 semaines
                                                        # (exécuté par le workflow auto-moderation)
===============================================================================
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List

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
HEALTH_JSON = DATA_DIR / "admin-exams-health.json"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Secrets locaux (.env.local gitignoré) : GROQ_API_KEY, GEMINI_API_KEY…
# Ne remplace JAMAIS une variable déjà présente (CI/Vercel gardent la priorité).
from scraper.core.env_loader import load_env_file

load_env_file()

from scraper.core.http_client import HttpClient
from scraper.core.logger import setup_logger
from scraper.core.gemini_exams import ExamGeminiEnricher
from scraper.core.robots_check import check_robots
from scraper.core.similarity_check import (
    SIMILARITY_THRESHOLD as DEFAULT_SIMILARITY_THRESHOLD,
    find_duplicate_groups,
    needs_rewrite,
    text_similarity,
)
from scraper.database.exam_repository import ExamRepository
from scraper.exam_sources import get_enabled_sources, build_scraper
from scraper.models.exam_item import (
    ExamItem,
    merge_exam_rows,
    pick_keeper,
    relevance_issues,
)

logger = setup_logger("exams_runner")


def _write_health(status: str, added: int, message: str) -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "status": status,
            "lastRunAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "examsAdded": added,
            "message": message,
        }
        tmp = HEALTH_JSON.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(HEALTH_JSON)
    except Exception as exc:
        logger.debug(f"Écriture health JSON impossible : {exc}")


def report_sources() -> int:
    """Rapport robots.txt de toutes les sources (alimente docs/CONCOURS_SOURCES.md)."""
    http_client = HttpClient()
    print("\n" + "=" * 72)
    print("RAPPORT DES SOURCES DE CONCOURS — vérification robots.txt")
    print("=" * 72)
    rows = []
    for cfg in get_enabled_sources():
        base = str(cfg.get("base_url", ""))
        robots = check_robots(http_client, base, "/")
        rows.append((cfg.get("id"), cfg.get("name"), base, robots.status, robots.note))
        print(
            f"  • {cfg.get('id'):16} [{robots.status:12}] {base}\n"
            f"      {robots.note or ''}"
        )
    http_client.close()
    print("\nRésumé :", {r[0]: r[3] for r in rows})
    return 0


# Timeout global du run (secondes). Lecture depuis SCRAPER_MAX_DURATION_SECONDS
# (défaut 900s = 15 min). Au-delà, le traitement des éléments restants est
# arrêté proprement et tout ce qui a déjà été traité est enregistré en base.
_MAX_DURATION = int(os.getenv("SCRAPER_MAX_DURATION_SECONDS", "900"))


def run(
    source_ids: List[str],
    max_per_source: int,
    dry_run: bool,
    use_ai: bool,
    similarity_threshold: float,
) -> int:
    run_start = time.time()
    logger.info("=" * 60)
    logger.info("🚀 Pipeline Concours Administratifs (table exams)")
    logger.info(
        f"   Max par source : {max_per_source} | Dry-run : {dry_run} | IA : {use_ai} | "
        f"Seuil anti-duplication : {similarity_threshold:.0%} | "
        f"Timeout run : {_MAX_DURATION}s"
    )
    logger.info("=" * 60)

    enabled = get_enabled_sources()
    if source_ids:
        enabled = [s for s in enabled if s.get("id") in source_ids]
    if not enabled:
        logger.error("❌ Aucune source de concours activée (scraper/config/exam_sources.json).")
        return 1

    http_client = HttpClient()
    enricher = ExamGeminiEnricher() if use_ai else ExamGeminiEnricher(api_key=None)

    all_items: List[ExamItem] = []
    robots_report: List[dict] = []
    # Contrôle anti-duplication (§2.6) : fiches trop proches de la source.
    to_rewrite: List[ExamItem] = []
    # Filtrage qualité post-IA : pages hors-sujet (menus, rubriques, archives…)
    # rejetées avant insertion — non comptées dans all_items.
    rejected_noise: List[str] = []

    run_timed_out = False
    for cfg in enabled:
        source_id = cfg.get("id")
        base = str(cfg.get("base_url", ""))
        robots = check_robots(http_client, base, "/")
        robots_report.append(
            {"id": source_id, "name": cfg.get("name"), "url": base, "robots": robots.status}
        )
        if not robots.allowed:
            logger.warning(f"⛔ Source {source_id} interdite par robots.txt — ignorée.")
            continue

        try:
            scraper = build_scraper(cfg, http_client)
            raw_items = scraper.scrape(max_offers=max_per_source)
            for item_idx, item in enumerate(raw_items):
                # Timeout global : si le run dépasse la durée maximale,
                # arrêter le traitement des éléments restants proprement.
                elapsed = time.time() - run_start
                if elapsed > _MAX_DURATION:
                    run_timed_out = True
                    logger.warning(
                        f"⏰ Timeout run ({_MAX_DURATION}s dépassés) — "
                        f"arrêt du traitement après {len(all_items)} éléments traités."
                    )
                    break
                # Texte source BRUT conservé AVANT la réécriture — nécessaire
                # au contrôle anti-duplication (comparaison source ↔ réécrit).
                raw_text = item.description_md
                # Réécriture 100% + extraction structurée (repli heuristique inclus).
                # Délai inter-requête pour éviter les 429 cascadants.
                if item_idx > 0 and use_ai:
                    time.sleep(1.5)
                enricher.enrich(item)
                # Filtrage qualité post-IA : la page décrit-elle un concours
                # exploitable ? (titre de rubrique/menu, aucune date ni
                # condition, ou rejet explicite de Gemini → écartée).
                noise_reason = item.relevance_issues()
                if noise_reason:
                    rejected_noise.append(f"{item.title[:60]} — {noise_reason}")
                    logger.warning(f"  🚫 Hors-sujet ({noise_reason}) : {item.title[:60]}")
                    continue
                ok, reason = item.is_valid()
                if not ok:
                    logger.debug(f"  🚫 Rejeté ({reason}) : {item.title[:50]}")
                    continue
                # Contrôle anti-duplication : pertinent UNIQUEMENT si la
                # réécriture a réellement eu lieu. Le repli heuristique (pas de
                # clé IA / échec Gemini) ne reformule pas le texte → une
                # similarité de 1.0 triviale ne doit PAS être signalée.
                if raw_text.strip() == item.description_md.strip():
                    all_items.append(item)
                    continue
                score = text_similarity(raw_text, item.description_md)
                if needs_rewrite(raw_text, item.description_md, similarity_threshold):
                    to_rewrite.append(item)
                    item.confidence = "low"  # priorité relecture manuelle
                    logger.warning(
                        f"  ⚠️ Similarité {score:.0%} > {similarity_threshold:.0%} "
                        f"— à réécrire : {item.title[:60]}"
                    )
                all_items.append(item)
        except Exception as exc:
            logger.error(f"  ❌ Erreur source {source_id} : {exc}", exc_info=True)
        if run_timed_out:
            break

    http_client.close()
    enricher.close()

    elapsed_total = time.time() - run_start
    logger.info(
        f"\n📊 {len(all_items)} concours bruts valides prêts à l'enregistrement."
        f" (durée : {elapsed_total:.0f}s)"
    )
    if run_timed_out:
        logger.warning(
            f"⏰ Timeout : traitement interrompu après {_MAX_DURATION}s — "
            f"les {len(all_items)} éléments traités vont être enregistrés."
        )
    if rejected_noise:
        logger.warning(f"🚫 {len(rejected_noise)} page(s) hors-sujet ignorée(s) — non enregistrées.")
    if to_rewrite:
        logger.warning(
            f"⚠️ {len(to_rewrite)} fiche(s) trop proche(s) de la source "
            f"(similarité > {similarity_threshold:.0%}) — à réécrire en modération."
        )
    if dry_run:
        for idx, item in enumerate(all_items, 1):
            print(
                f"  {idx}. [{item.category.upper():14}] {item.title[:58]} — {item.organizer[:36]} "
                f"[{item.source[:24]}] (confiance {item.confidence})"
            )
        if rejected_noise:
            print("\n🚫 HORS-SUJET (ignorés, non enregistrés) :")
            for entry in rejected_noise:
                print(f"  - {entry}")
        if to_rewrite:
            print("\n⚠️ À RÉÉCRIRE (similarité élevée avec la source) :")
            for idx, item in enumerate(to_rewrite, 1):
                print(f"  - {idx}. {item.title[:70]}")
        print("\nRapport robots.txt :")
        for r in robots_report:
            print(f"   - {r['id']:16} {r['robots']}")
        return 0

    created = 0
    updated = 0
    log_id = None
    purged_old = 0
    try:
        with ExamRepository(DB_PATH) as repo:
            log_id = repo.add_log("running", 0, f"Scraping concours : {len(all_items)} candidats")
            for item in all_items:
                _, was_created = repo.upsert(item)
                if was_created:
                    created += 1
                else:
                    updated += 1
            # Les informations collectées « durent » 5 semaines : les fiches
            # plus anciennes (fin d'inscription passée ou absente) sont purgées.
            purged_old = repo.purge_old_exams()
            if purged_old:
                logger.info(f"🗑  {purged_old} concours supprimé(s) automatiquement (info > 5 semaines).")
            # Publication AUTOMATIQUE des concours restés en pending depuis ≥ 21
            # min (même règle que les offres) : le scraping d'un run précédent
            # ne doit jamais laisser /concours vide faute de modération manuelle.
            auto_published = repo.auto_publish_pending()
            if auto_published:
                logger.info(
                    f"⚡ {auto_published} concours en attente validés & publiés automatiquement (≥ 21 min)."
                )
            stats = repo.stats()
    except Exception as exc:
        logger.error(f"❌ Erreur BDD : {exc}", exc_info=True)
        _write_health("error", created, f"Erreur BDD : {exc}")
        return 1

    message = f"Concours : {created} nouveau(x), {updated} mis à jour. {stats}"
    if rejected_noise:
        message += f" 🚫 {len(rejected_noise)} page(s) hors-sujet ignorée(s)"
    if to_rewrite:
        message += f" ⚠️ {len(to_rewrite)} à réécrire (similarité > {similarity_threshold:.0%})"
    if log_id is not None:
        try:
            with ExamRepository(DB_PATH) as repo:
                repo.finish_log(log_id, "success", created, message)
        except Exception:
            pass
    _write_health("success", created, message)
    logger.info(f"✅ Terminé : {created} nouveau(x), {updated} mis à jour. {stats}")
    return 0


def run_merge_duplicates(dry_run: bool) -> int:
    """
    Fusionne les doublons INTER-SOURCES détectés par similarité de titre
    (is_duplicate_title, seuil 0.88) : le même concours collecté par deux
    sources avec des intitulés quasi identiques (ex. « CONCOURS ADMINISTRATIFS
    2026 » sur ENA et GUCACI) ne doit produire qu'UNE fiche.

    Pour chaque groupe de doublons :
      • la fiche la plus riche (publiée, champs structurés, URL de détail,
        description la plus longue) est CONSERVÉE et reçoit la fusion
        (documents en union, champs non nuls, description la plus longue) ;
      • les autres fiches passent en 'archived' (invisibles côté public,
        consultables dans /admin/exams → Archivés, réversibles).

    Par défaut simple aperçu (dry-run) — écrire avec `--apply`.
    """
    logger.info("🔀 Fusion des doublons inter-sources (similarité de titre)")
    groups: List[List[dict]] = []
    try:
        with ExamRepository(DB_PATH) as repo:
            rows = [r for r in repo.list_all() if str(r.get("status") or "") != "rejected"]
            groups = find_duplicate_groups(rows)
            if not groups:
                logger.info("Aucun doublon inter-sources détecté.")
                return 0
            for group in groups:
                keeper = pick_keeper(group)
                merged = merge_exam_rows(group)
                others = [r for r in group if str(r.get("id")) != str(keeper.get("id"))]
                titles = " | ".join(str(r.get("title") or "")[:42] for r in group)
                logger.warning(f"Doublon ({len(group)} fiches) : {titles}")
                logger.warning(
                    f"  → conserver {str(keeper.get('id'))[:8]} « {str(keeper.get('title'))[:46]} » "
                    f"({str(keeper.get('status'))}, {len(keeper.get('documents') or [])} doc(s))"
                )
                for other in others:
                    logger.warning(
                        f"  → archiver {str(other.get('id'))[:8]} « {str(other.get('title'))[:46]} » "
                        f"({str(other.get('organizer'))[:36]})"
                    )
                if not dry_run:
                    repo.update_exam(str(keeper["id"]), merged)
                    for other in others:
                        repo.set_exam_status(str(other["id"]), "archived")
    except Exception as exc:
        logger.error(f"❌ Fusion des doublons impossible : {exc}", exc_info=True)
        return 1

    action = "à fusionner" if dry_run else "fusionnées"
    logger.info(f"\n📋 {len(groups)} groupe(s) de doublons {action}.")
    if dry_run and groups:
        logger.info("Relancez avec --apply pour appliquer réellement la fusion.")
    return 0


def run_cleanup_noise(dry_run: bool) -> int:
    """
    Repasse sur les fiches concours DÉJÀ en base (SQLite + Supabase) et rejette
    (status='rejected') celles qui ne décrivent pas un concours exploitable :
      • titres de rubrique/menu (« Communiqués », « Actu … », « Archives… »,
        « Note aux usagers », « À l'attention de … », nom d'école seul…) ;
      • aucune information actionnable (dates OU conditions) après enrichissement.

    L'action est RÉVERSIBLE : la fiche reste visible dans /admin/exams (onglet
    Rejetés) et re-publiable en un clic. Par défaut simple aperçu (dry-run) —
    écrire avec `--apply`. Les fiches déjà rejetées ne sont pas re-signalées.
    """
    logger.info("🧹 Nettoyage des fiches concours hors-sujet")
    flagged: List[str] = []
    already = 0
    try:
        with ExamRepository(DB_PATH) as repo:
            for row in repo.list_all():
                if str(row.get("status") or "") == "rejected":
                    already += 1
                    continue
                reason = relevance_issues(
                    rejected=bool(row.get("rejected")),
                    rejection_reason=row.get("rejection_reason"),
                    title=row.get("title"),
                    row=row,
                )
                if not reason:
                    continue
                title = str(row.get("title") or "")[:70]
                flagged.append(f"{title} — {reason}")
                if dry_run:
                    logger.warning(f"  ⏭️  [dry-run] à rejeter : {title} ({reason})")
                else:
                    repo.reject_exam(str(row["id"]))
                    logger.warning(f"  🗑️  rejeté : {title} ({reason})")
    except Exception as exc:
        logger.error(f"❌ Nettoyage hors-sujet impossible : {exc}", exc_info=True)
        return 1

    action = "à rejeter" if dry_run else "rejetées"
    logger.info(
        f"\n📋 Nettoyage terminé : {len(flagged)} fiche(s) {action} "
        f"({already} déjà rejetée(s) ignorée(s))."
    )
    if dry_run and flagged:
        logger.info("Relancez avec --apply pour appliquer réellement le rejet.")
    return 0


def run_maintenance() -> int:
    """
    Tâche de maintenance automatique du module concours, SANS scraping :
      • publication des concours en attente depuis ≥ 21 minutes
      • suppression des concours dont l'information a plus de 5 semaines
        (sauf si les inscriptions sont encore ouvertes)

    Utilisée par le workflow GitHub Actions `auto-moderation` (exécution toutes
    les 15 minutes) pour que la modération automatique des concours fonctionne
    même quand personne ne se connecte à /admin/exams. Réutilise les fonctions
    testées de ExamRepository (scraper/tests/test_repository_maintenance.py :
    `test_auto_publish_after_21_minutes`, `test_purge_old_exams_after_5_weeks`).
    Les opérations SQLite sont TOUJOURS exécutées, puis répliquées sur Supabase
    (production) quand SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY sont fournies.
    """
    exam_auto_published = 0
    exam_purged = 0
    try:
        with ExamRepository(DB_PATH) as repo:
            # Publication automatique des concours en attente ≥ 21 min (même
            # règle que les offres : l'admin garde la main au début).
            exam_auto_published = repo.auto_publish_pending()
            exam_purged = repo.purge_old_exams()
    except Exception as exc:
        logger.error(f"❌ Maintenance (concours) impossible : {exc}", exc_info=True)
        return 1

    if exam_auto_published:
        logger.info(f"⚡ {exam_auto_published} concours en attente publié(s) automatiquement (≥ 21 min).")
    if exam_purged:
        logger.info(f"🗑  {exam_purged} concours supprimé(s) automatiquement (info > 5 semaines).")
    # Ligne de synthèse INCONDITIONNELLE : les logs du workflow doivent toujours
    # montrer que le traitement de la table `exams` a bien été exécuté, même
    # quand aucun concours n'était éligible (diagnostic du « 0 concours »).
    logger.info(
        f"📋 Maintenance concours terminée : {exam_auto_published} publié(s) automatiquement, "
        f"{exam_purged} purgé(s)."
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="TravaillerEnCi — module Concours (table exams)")
    parser.add_argument("--sources", type=str, default="", help="Ids de sources séparés par des virgules (défaut : toutes)")
    parser.add_argument("--max-per-source", type=int, default=10, help="Max de concours par source")
    parser.add_argument("--dry-run", action="store_true", help="Afficher sans enregistrer")
    parser.add_argument("--no-ai", action="store_true", help="Extraction heuristique uniquement")
    parser.add_argument(
        "--similarity-threshold",
        type=float,
        default=DEFAULT_SIMILARITY_THRESHOLD,
        # « %% » : échappement printf exigé par argparse dans les chaînes d'aide.
        help=f"Seuil anti-duplication source↔réécriture (défaut : {DEFAULT_SIMILARITY_THRESHOLD * 100:.0f} %%)",
    )
    parser.add_argument(
        "--maintenance-only",
        action="store_true",
        help="Sans scraping : publie les concours en attente (≥ 21 min), purge les fiches de plus de 5 semaines, puis quitte",
    )
    parser.add_argument(
        "--cleanup-noise",
        action="store_true",
        help="Repasse sur les fiches existantes (SQLite + Supabase) et rejette celles qui ne sont pas des concours exploitables. Aperçu par défaut ; --apply pour écrire",
    )
    parser.add_argument(
        "--merge-duplicates",
        action="store_true",
        help="Fusionne les doublons inter-sources (similarité de titre ≥ 0.88). Aperçu par défaut ; --apply pour écrire",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Applique réellement le nettoyage --cleanup-noise / la fusion --merge-duplicates (sans lui, simple aperçu)",
    )
    parser.add_argument("--check-sources", action="store_true", help="Rapport robots.txt des sources puis quitter")
    args = parser.parse_args()

    if args.maintenance_only:
        return run_maintenance()

    if args.cleanup_noise:
        return run_cleanup_noise(not args.apply)

    if args.merge_duplicates:
        return run_merge_duplicates(not args.apply)

    if args.check_sources:
        return report_sources()

    source_ids = [s.strip() for s in args.sources.split(",") if s.strip()]
    use_ai = not args.no_ai
    return run(
        source_ids,
        args.max_per_source,
        args.dry_run,
        use_ai,
        args.similarity_threshold,
    )


if __name__ == "__main__":
    sys.exit(main())
