#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/tests/test_exam_merge.py
  Tests de la déduplication inter-sources par TITRE (doublons de fond)

  Problème traité : deux sources collectent parfois la MÊME annonce avec des
  intitulés quasi identiques (« CONCOURS ADMINISTRATIFS 2026 » sur ENA et
  GUCACI, « Communiqu resultats d admission pro » vs « Resultats d'admission
  pro ») — la détection par URL/domaine ne suffit pas.

  Règles testées :
    - is_duplicate_title (seuil 0.88) : titres normalisés égaux ou
      sous-ensembles → doublon ; concours distincts (CEPE vs BEPC, CAFOP vs
      correcteurs CAFOP, ATE vs Auditeurs) → non ;
    - find_duplicate_groups : regroupement union-find ;
    - pick_keeper : fiche la plus riche (publiée, champs, URL de détail) ;
    - merge_exam_rows : union des documents, premier non nul, description
      la plus longue.

  Usage :  python -m pytest scraper/tests -q
           (ou) python scraper/tests/test_exam_merge.py
===============================================================================
"""

from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scraper.core.similarity_check import (  # noqa: E402
    find_duplicate_groups,
    is_duplicate_title,
)
from scraper.models.exam_item import (  # noqa: E402
    merge_exam_rows,
    pick_keeper,
)


def _row(**overrides) -> dict:
    row = {
        "id": "test-id",
        "title": "Concours test",
        "organizer": "Organisateur",
        "category": "administratif",
        "exam_type": None,
        "description_md": "Description de test suffisamment longue.",
        "registration_start": None,
        "registration_end": None,
        "exam_date": None,
        "results_date": None,
        "age_min": None,
        "age_max": None,
        "age_reference_date": None,
        "nationality": None,
        "diplomas": [],
        "positions_count": None,
        "registration_fee": None,
        "location": None,
        "cities": [],
        "documents": [],
        "source_url": "https://gucaci.ciconcours.com/concours-2026/detail",
        "source_website": "GUCACI",
        "status": "published",
        "confidence": "medium",
        "seo_title": None,
        "seo_description": None,
        "seo_keywords": None,
        "slug": None,
    }
    row.update(overrides)
    return row


# ---------------------------------------------------------------------------
# is_duplicate_title
# ---------------------------------------------------------------------------
def test_duplicate_title_equal_normalized():
    assert is_duplicate_title("CONCOURS ADMINISTRATIFS 2026", "concours administratifs 2026")
    assert is_duplicate_title("École Nationale d'Administration", "Ecole Nationale d'Administration")


def test_duplicate_title_subset():
    # « Communiqu resultats d admission pro » (MFP) vs « Resultats d'admission pro » (ENA)
    assert is_duplicate_title(
        "Communiqu resultats d admission pro", "Resultats d'admission pro"
    )


def test_distinct_titles_not_duplicates():
    # Calendrier CEPE vs BEPC (0.818) — deux concours DIFFÉRENTS.
    assert not is_duplicate_title(
        "Calendrier officiel de déroulement des épreuves écrites du CEPE Session 2026.",
        "CALENDRIER OFFICIEL DE DÉROULEMENT DES ÉPREUVES ÉCRITES DE BEPC SESSION 2026",
    )
    # Autres cas réels (0.50–0.75) : concours distincts.
    assert not is_duplicate_title("CONCOURS ADMINISTRATIFS 2026", "CONCOURS INFAS 2026")
    assert not is_duplicate_title("CONVOCATIONS CAFOP 2026", "CONVOCATIONS CORRECTEURS CAFOP IA 2026")
    assert not is_duplicate_title("Communiqué ATE session 2026", "Communiqué Auditeurs session 2026")
    assert not is_duplicate_title("Communiqué dress code 2026", "Communiqué ATE session 2026")
    assert not is_duplicate_title("COMMUNIQUE 2026", "Communique Ouverture des concours 2026 1")


def test_duplicate_title_empty():
    assert not is_duplicate_title(None, "Concours")
    assert not is_duplicate_title("", "")
    assert not is_duplicate_title("Concours", None)


# ---------------------------------------------------------------------------
# find_duplicate_groups
# ---------------------------------------------------------------------------
def test_find_duplicate_groups():
    rows = [
        _row(id="a", title="CONCOURS ADMINISTRATIFS 2026", source_url="https://ena.ci/concours"),
        _row(id="b", title="concours administratifs 2026", source_url="https://gucaci.ciconcours.com/"),
        _row(id="c", title="CONCOURS INFAS 2026"),
        _row(id="d", title="Communiqu resultats d admission pro"),
        _row(id="e", title="Resultats d'admission pro"),
    ]
    groups = find_duplicate_groups(rows)
    sizes = sorted(len(g) for g in groups)
    assert sizes == [2, 2], f"deux groupes de 2 attendus, obtenu {sizes}"


def test_find_duplicate_groups_none():
    rows = [
        _row(id="a", title="CONCOURS ADMINISTRATIFS 2026"),
        _row(id="b", title="CONCOURS INFAS 2026"),
    ]
    assert find_duplicate_groups(rows) == []


# ---------------------------------------------------------------------------
# pick_keeper
# ---------------------------------------------------------------------------
def test_pick_keeper_prefers_published_and_rich():
    group = [
        _row(id="a", status="pending", diplomas=[], documents=[], description_md="Courte."),
        _row(id="b", status="published", diplomas=["BAC"], documents=[{"name": "PDF", "url": "https://x/a.pdf"}], description_md="Description complète avec toutes les conditions."),
    ]
    assert pick_keeper(group)["id"] == "b"


def test_pick_keeper_prefers_specific_url():
    group = [
        _row(id="a", source_url="https://gucaci.ciconcours.com/"),
        _row(id="b", source_url="https://gucaci.ciconcours.com/comment-sinscrire/procedure/ena-professionnels"),
    ]
    assert pick_keeper(group)["id"] == "b"


# ---------------------------------------------------------------------------
# merge_exam_rows
# ---------------------------------------------------------------------------
def test_merge_exam_rows_unions_documents_and_fields():
    group = [
        _row(
            id="a",
            status="published",
            title="CONCOURS ADMINISTRATIFS 2026",
            documents=[{"name": "Guide", "url": "https://gucaci.ciconcours.com/uploads/guide.pdf"}],
            registration_start=None,
            registration_end=None,
            diplomas=[],
        ),
        _row(
            id="b",
            status="published",
            title="CONCOURS ADMINISTRATIFS 2026",
            documents=[
                {"name": "Guide", "url": "https://gucaci.ciconcours.com/uploads/guide.pdf"},
                {"name": "Arrêté", "url": "https://gucaci.ciconcours.com/uploads/arrete.pdf"},
            ],
            registration_start="2026-08-14T00:00:00",
            registration_end="2026-09-30T00:00:00",
            diplomas=["BAC"],
        ),
    ]
    merged = merge_exam_rows(group)
    # Le keeper (b, URL la plus spécifique) porte la fusion.
    assert merged["id"] == "b"
    assert len(merged["documents"]) == 2, "documents en union sans doublon"
    assert merged["registration_end"] == "2026-09-30T00:00:00"
    assert merged["diplomas"] == ["BAC"]


def test_merge_keeps_documents_without_url():
    # Un document sans URL (observé en prod) ne doit pas être perdu.
    group = [
        _row(id="a", documents=[{"name": "Sans lien", "url": ""}]),
        _row(id="b", documents=[{"name": "PDF officiel", "url": "https://x/a.pdf"}]),
    ]
    merged = merge_exam_rows(group)
    urls = [d.get("url") for d in merged["documents"]]
    assert "" in urls, "le document sans URL doit être conservé"
    assert "https://x/a.pdf" in urls


def test_merge_keeps_longest_description_and_fills_organizer():
    group = [
        _row(id="a", description_md="Courte.", organizer=""),
        _row(
            id="b",
            description_md="Description très longue et détaillée du concours avec toutes les informations.",
            organizer="Ministère de la Fonction Publique",
        ),
    ]
    merged = merge_exam_rows(group)
    assert "très longue" in merged["description_md"]
    assert merged["organizer"] == "Ministère de la Fonction Publique"


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
