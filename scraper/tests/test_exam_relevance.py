#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/tests/test_exam_relevance.py
  Tests du filtrage qualité post-IA (scraper/models/exam_item.py)

  Problème traité : le scraper créait des fiches pour des TITRES DE RUBRIQUE
  / MENU (« Communiqués », « Actu DECO », « NOTE AUX USAGERS », « ARCHIVES DES
  COMMUNIQUES », « À L'ATTENTION DES DRENAET ET DES IEPP », « École Nationale
  d'Administration » seul…) au lieu de vrais concours exploitables.

  Règles testées (évaluées APRÈS l'enrichissement IA) :
    1. rejet explicite de l'IA (is_concours=false → rejected=True) ;
    2. titre de rubrique générique ;
    3. aucune information actionnable (dates OU conditions) — sauf fiches
       « communiqué PDF officiel » (texte non extractible mais document utile).

  Usage :  python -m pytest scraper/tests -q
           (ou) python scraper/tests/test_exam_relevance.py
===============================================================================
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scraper.models.exam_item import (  # noqa: E402
    ExamItem,
    generic_rubrique_reason,
    has_actionable_info,
    relevance_issues,
)


def _item(**overrides) -> ExamItem:
    """ExamItem minimal valide (titre + organisateur + description + URL)."""
    data = {
        "title": "Concours direct de recrutement d'inspecteurs des impôts — session 2026",
        "organizer": "Ministère de la Fonction Publique",
        "description_md": "Annonce officielle du concours avec dates d'inscription, "
        "diplômes requis et conditions d'éligibilité détaillées.",
        "source_url": "https://gucaci.ciconcours.com/concours-2026/detail/inspecteurs",
    }
    data.update(overrides)
    return ExamItem(**data)


# ---------------------------------------------------------------------------
# Règle 1 — rejet explicite de l'IA (is_concours=false)
# ---------------------------------------------------------------------------
def test_ai_explicit_rejection():
    item = _item(rejected=True, rejection_reason="page de rubrique sans annonce")
    assert item.relevance_issues() is not None
    assert "rubrique" in item.relevance_issues()


def test_ai_rejection_default_reason():
    item = _item(rejected=True)
    assert item.relevance_issues() is not None


def test_not_rejected_is_ok():
    item = _item(diplomas=["BAC"], registration_end="2026-10-15")
    assert item.relevance_issues() is None


# ---------------------------------------------------------------------------
# Règle 2 — titres de rubrique / menu (cas réels constatés en prod)
# ---------------------------------------------------------------------------
def test_generic_rubrique_reason_real_cases():
    for title in (
        "Communiqués",
        "Communiqué",
        "Communiqué de presse",
        "COMMUNIQUE 2026",
        "Communiqué 2026",
        "Actu DECO",
        "Actu",
        "Actualités",
        "NOTE AUX USAGERS",
        "ARCHIVES DES COMMUNIQUES",
        "Archives",
        "A L'ATTENTION DES DRENAET ET DES IEPP",
        "À l'attention des directeurs régionaux",
        "Guide d'inscription",
        "Comment s'inscrire",
        "Résultats",
        "Accueil",
        "Bienvenue",
        "Contact",
        "Recherche",
        "Recherche — concours",
        "LES ATTRIBUTIONS DE LA DIRECTION DES CONCOURS",
    ):
        assert generic_rubrique_reason(title) is not None, f"{title!r} doit être rejeté"


def test_generic_rubrique_reason_keeps_concours_titles():
    for title in (
        "CONCOURS ADMINISTRATIFS 2026",
        "Concours direct de recrutement d'inspecteurs des impôts — session 2026",
        "Communiqué relatif au concours d'entrée à l'ENA 2026",
        "Communique Ouverture des concours 2026 1",
        "Communiqué ATE session 2026",
        "Communiqué dress code 2026",
        "Concours INFAS 2026 — filières infirmiers",
        "Concours de promotion des agents de la fonction publique",
        "École Nationale d'Administration",
    ):
        assert generic_rubrique_reason(title) is None, f"{title!r} ne doit PAS être rejeté par le titre"


# ---------------------------------------------------------------------------
# Règle 3 — aucune information actionnable (dates OU conditions)
# ---------------------------------------------------------------------------
def test_no_actionable_info_is_rejected():
    # « École Nationale d'Administration » seule : aucune date ni condition.
    item = _item(title="École Nationale d'Administration", diplomas=[], cities=[])
    reason = item.relevance_issues()
    assert reason is not None
    assert "information exploitable" in reason


def test_dates_alone_are_actionable():
    item = _item(diplomas=[], registration_start="2026-09-01", registration_end="2026-10-15")
    assert item.relevance_issues() is None


def test_diplomas_alone_are_actionable():
    item = _item(diplomas=["BEPC", "BAC"], registration_start=None)
    assert item.relevance_issues() is None


def test_age_or_fee_are_actionable():
    item = _item(diplomas=[], age_min=18, age_max=35)
    assert item.relevance_issues() is None
    item2 = _item(diplomas=[], registration_fee="10 000 FCFA")
    assert item2.relevance_issues() is None


def test_pdf_communique_is_exempt_from_content_rule():
    # Fiche issue d'un PDF officiel : texte non extractible, mais le document
    # est exploitable → ne pas rejeter sur le fond (cas ENA).
    item = _item(
        title="COMMUNIQUE CONCOURS 2026",
        diplomas=[],
        documents=[{"name": "Télécharger", "url": "https://www.ena.ci/assets/fichiers/communiques/communique-concours-2026.pdf"}],
    )
    assert item.relevance_issues() is None


def test_row_based_relevance():
    # Même règle évaluable sur une ligne BDD (nettoyage --cleanup-noise).
    row = {
        "title": "NOTE AUX USAGERS",
        "status": "published",
        "description_md": "…",
        "diplomas": [],
        "cities": [],
        "documents": [],
        "registration_start": None,
        "registration_end": None,
        "exam_date": None,
        "results_date": None,
        "age_min": None,
        "age_max": None,
        "nationality": None,
        "positions_count": None,
        "registration_fee": None,
        "exam_type": None,
        "source_url": "https://www.men-deco.org/note-aux-usagers",
    }
    assert relevance_issues(rejected=False, rejection_reason=None, title=row["title"], row=row) is not None


def test_has_actionable_info():
    assert has_actionable_info(_item(diplomas=["BAC"])) is True
    assert has_actionable_info(_item(diplomas=[])) is False
    assert has_actionable_info(_item(diplomas=[], cities=["Abidjan", "Bouaké"])) is True


if __name__ == "__main__":
    import traceback

    # Console Windows : forcer UTF-8 pour les symboles ✓/✗.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    tests = [fn for name, fn in sorted(globals().items()) if name.startswith("test_") and callable(fn)]
    failures = 0
    for fn in tests:
        try:
            fn()
            print(f"  OK {fn.__name__}")
        except Exception:
            failures += 1
            print(f"  FAIL {fn.__name__}")
            traceback.print_exc()
    print(f"\n{len(tests) - failures}/{len(tests)} tests OK")
    sys.exit(1 if failures else 0)
