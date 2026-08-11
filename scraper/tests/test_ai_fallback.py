#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/tests/test_ai_fallback.py
  Tests du fallback IA Gemini → Groq → heuristiques locales

  Scénarios couverts :
    • Gemini fonctionne → provider=gemini, Groq JAMAIS appelé ;
    • Gemini échoue (exception, réponse vide, JSON invalide) → Groq prend le
      relais (provider=groq) ;
    • résultat IA inexploitable (titre vide, titre = nom de fichier, description
      trop courte) → validation → Groq ;
    • les deux fournisseurs échouent → repli heuristique propre, jamais de
      fiche mal structurée, jamais d'exception ;
    • rejet explicite IA (is_concours=false) conservé sans basculer sur Groq ;
    • clean_exam_title normalise les titres bruts / noms de fichiers.

  Usage : python -m pytest scraper/tests -q   (ou exécution directe)
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

from scraper.core.exam_parser import clean_exam_title  # noqa: E402
from scraper.core.gemini import GeminiEnricher  # noqa: E402
from scraper.core.gemini_exams import ExamGeminiEnricher  # noqa: E402
from scraper.models.content_item import ContentItem, CONTENT_CATEGORIES  # noqa: E402
from scraper.models.exam_item import ExamItem  # noqa: E402

# ---------------------------------------------------------------------------
# Outils de test
# ---------------------------------------------------------------------------

VALID_JSON = (
    '{"category": "job", "title": "Comptable senior", "organization": "MTN CI", '
    '"contract_type": "CDI", "location": "Abidjan", "deadline": null, '
    '"eligibility": "BAC+3", "description_markdown": "Le comptable senior gère '
    'la comptabilité générale de lentreprise. Il supervise une équipe de deux '
    'personnes et prépare les bilans trimestriels."}'
)

VALID_EXAM_JSON = (
    '{"is_concours": "true", "rejection_reason": null, '
    '"title": "Concours direct ENA cycle moyen", "organizer": "ENA", '
    '"category": "administratif", "exam_type": "concours_direct", '
    '"description_md": "Les inscriptions au concours direct d\\u0027entrée à '
    'l\\u0027ENA se font en ligne sur la plateforme officielle. Peuvent postuler '
    'les titulaires du BAC de nationalité ivoirienne.", '
    '"registration_start": "2026-09-01", "registration_end": "2026-09-30", '
    '"exam_date": null, "results_date": null, "age_min": null, "age_max": null, '
    '"age_reference_date": null, "nationality": "ivoirienne", '
    '"diplomas": ["BAC"], "positions_count": null, "registration_fee": null, '
    '"location": "Abidjan", "cities": [], "documents": [], '
    '"confidence": "high", "seo_description": "Concours ENA 2026 : dates et conditions."}'
)


class FakeGroq:
    """Remplace GroqClient : retourne un texte, lève une exception, ou signale
    un appel non attendu."""

    def __init__(self, result, expect_call: bool = True):
        self._result = result
        self._expect_call = expect_call
        # Toujours « activé » : si Groq est appelé à tort, complete() lève
        # (AssertionError quand result est None), le test échoue bruyamment.
        self.enabled = True
        self.calls = 0

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        self.calls += 1
        if isinstance(self._result, Exception):
            raise self._result
        if self._result is None:
            raise AssertionError("Groq ne devait PAS être appelé (Gemini a suffi)")
        return self._result


def make_content_item(title: str = "Comptable senior") -> ContentItem:
    return ContentItem(
        title=title,
        company="MTN CI",
        location="Abidjan",
        description=(
            "Le comptable senior gère la comptabilité générale de lentreprise. "
            "Il supervise une équipe de deux personnes et prépare les bilans "
            "trimestriels destinés à la direction financière."
        ),
        source_url="https://www.mtn.ci/offres/comptable",
    )


def make_exam_item(title: str = "Concours ENA 2026") -> ExamItem:
    return ExamItem(
        title=title,
        organizer="ENA",
        category="administratif",
        description_md=(
            "Les inscriptions au concours direct d'entrée à l'ENA se font en "
            "ligne du 1er septembre 2026 au 30 septembre 2026. Peuvent postuler "
            "les personnes de nationalité ivoirienne titulaires du BAC."
        ),
        source_url="https://www.ena.ci/concours/2026",
    )


def make_enricher(klass, groq_result, gemini_result=None):
    """Enricheur avec Gemini stubé + Groq factice."""
    enricher = klass(api_key="test-gemini-key")
    if gemini_result is not None:
        def _call(prompt):
            if isinstance(gemini_result, Exception):
                raise gemini_result
            return gemini_result
        enricher._call_gemini = _call  # type: ignore[method-assign]
    enricher.groq = FakeGroq(groq_result)  # type: ignore[assignment]
    return enricher


# ---------------------------------------------------------------------------
# clean_exam_title
# ---------------------------------------------------------------------------

def test_clean_title_pdf_filename():
    assert clean_exam_title("communiqué_concours_2026.pdf") == "Communiqué concours 2026"
    assert clean_exam_title("arrete_ouverture_2027.pdf") == "Arrete ouverture 2027"
    assert clean_exam_title("concours-direct-ena-2026.PDF") == "Concours-direct-ena-2026"
    assert clean_exam_title("resultats_dadmissibilite_direct.docx") == "Resultats dadmissibilite direct"


def test_clean_title_no_pdf_suffix():
    assert clean_exam_title("Concours direct ENA cycle moyen") == "Concours direct ENA cycle moyen"
    assert clean_exam_title("(Communiqué) — recrutement 2026") == "Communiqué - recrutement 2026"


def test_clean_title_edge_cases():
    assert clean_exam_title("") == ""
    assert clean_exam_title("   ") == ""
    assert clean_exam_title("communique resultats dadmissibilite direct") == "Communique resultats dadmissibilite direct"


# ---------------------------------------------------------------------------
# GeminiEnricher (contenus généraux : emploi, bourses, stages)
# ---------------------------------------------------------------------------

def test_gemini_ok_groq_not_called():
    item = make_content_item()
    enricher = make_enricher(GeminiEnricher, groq_result=None, gemini_result=VALID_JSON)
    enricher.enrich(item)
    assert item.title == "Comptable senior"
    assert item.category == "job"
    assert "comptabilité générale" in item.description
    assert enricher.groq.calls == 0, "Groq ne doit pas être appelé quand Gemini répond"


def test_gemini_empty_response_groq_fallback():
    item = make_content_item()
    enricher = make_enricher(
        GeminiEnricher,
        groq_result=VALID_JSON,
        gemini_result=RuntimeError("réponse IA vide"),
    )
    enricher.enrich(item)
    assert item.title == "Comptable senior"
    assert item.category == "job"
    assert enricher.groq.calls == 1, "Groq doit prendre le relais après échec Gemini"


def test_gemini_invalid_json_groq_fallback():
    item = make_content_item()
    enricher = make_enricher(
        GeminiEnricher,
        groq_result=VALID_JSON,
        gemini_result="Ceci n'est pas du JSON {",
    )
    enricher.enrich(item)
    assert item.title == "Comptable senior"
    assert enricher.groq.calls == 1


def test_gemini_unusable_title_groq_fallback():
    """Titre vide renvoyé par Gemini → validation KO → Groq."""
    bad = '{"category": "job", "title": "", "description_markdown": "Une description assez longue pour être informative."}'
    item = make_content_item()
    enricher = make_enricher(GeminiEnricher, groq_result=VALID_JSON, gemini_result=bad)
    enricher.enrich(item)
    assert item.title == "Comptable senior"
    assert enricher.groq.calls == 1


def test_both_providers_fail_heuristic_fallback():
    item = make_content_item()
    enricher = make_enricher(
        GeminiEnricher,
        groq_result=RuntimeError("Groq injoignable : 500"),
        gemini_result=RuntimeError("Gemini quota dépassé (429)"),
    )
    enricher.enrich(item)  # ne doit JAMAIS lever
    assert item.category in CONTENT_CATEGORIES
    assert item.title == "Comptable senior"


def test_groq_only_when_gemini_disabled():
    """Sans clé Gemini mais avec Groq, l'enrichissement passe par Groq."""
    item = make_content_item()
    enricher = GeminiEnricher(api_key=None)  # pas de clé Gemini
    enricher.groq = FakeGroq(VALID_JSON)  # type: ignore[assignment]
    enricher.enrich(item)
    assert item.title == "Comptable senior"
    assert item.category == "job"
    assert enricher.groq.calls == 1


# ---------------------------------------------------------------------------
# ExamGeminiEnricher (concours)
# ---------------------------------------------------------------------------

def test_exam_gemini_ok_groq_not_called():
    item = make_exam_item()
    enricher = make_enricher(ExamGeminiEnricher, groq_result=None, gemini_result=VALID_EXAM_JSON)
    enricher.enrich(item)
    assert item.title == "Concours direct ENA cycle moyen"
    assert item.exam_type == "concours_direct"
    assert item.rejected is False
    assert enricher.groq.calls == 0


def test_exam_rejection_not_retried_on_groq():
    """is_concours=false est une réponse VALIDE : le rejet est conservé et
    Groq n'est pas appelé (on ne gaspille pas un appel pour un non-sujet)."""
    rejected = '{"is_concours": "false", "rejection_reason": "Page de rubrique Communiqués, pas une annonce de concours."}'
    item = make_exam_item()
    enricher = make_enricher(ExamGeminiEnricher, groq_result=None, gemini_result=rejected)
    enricher.enrich(item)
    assert item.rejected is True
    assert enricher.groq.calls == 0


def test_exam_filename_title_validation_groq_fallback():
    """Titre = nom de fichier PDF → validation KO → Groq."""
    bad = (
        '{"is_concours": "true", "title": "communique_2e_etape_direct.pdf", '
        '"description_md": "Une longue description rédigée qui serait tout à fait informative pour un candidat."}'
    )
    item = make_exam_item()
    enricher = make_enricher(ExamGeminiEnricher, groq_result=VALID_EXAM_JSON, gemini_result=bad)
    enricher.enrich(item)
    assert item.title == "Concours direct ENA cycle moyen"
    assert enricher.groq.calls == 1


def test_exam_both_fail_heuristic_cleans_title():
    """Les deux fournisseurs échouent : repli heuristique + titre nettoyé."""
    item = make_exam_item(title="communiqué_concours_2026.pdf")
    enricher = make_enricher(
        ExamGeminiEnricher,
        groq_result=RuntimeError("Groq injoignable"),
        gemini_result=RuntimeError("Gemini injoignable"),
    )
    enricher.enrich(item)
    assert item.title == "Communiqué concours 2026"
    assert item.confidence in ("low", "medium", "high")


if __name__ == "__main__":
    import traceback

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
