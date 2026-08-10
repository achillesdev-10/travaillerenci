#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/tests/test_exam_sources.py
  Tests unitaires des helpers de collecte des sources de concours :
    • collecte des liens de fiches (HTML + PDF de communiqués)
    • création de fiches depuis les PDF de communiqués officiels (ex. ENA)

  Usage :  python scraper/tests/test_exam_sources.py
===============================================================================
"""

from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from bs4 import BeautifulSoup  # noqa: E402

from scraper.exam_sources import (  # noqa: E402
    _collect_detail_links,
    _make_pdf_item,
    _pdf_filename_title,
    load_sources_config,
)


def _ena_config() -> dict:
    return [s for s in load_sources_config()["sources"] if s["id"] == "ena"][0]


def test_pdf_filename_title_decodes():
    url = (
        "https://www.ena.ci/assets/fichiers/communiques/"
        "Communiqu%C3%A9%20ATE%20session%202026.pdf"
    )
    assert _pdf_filename_title(url) == "Communiqué ATE session 2026"


def test_pdf_filename_title_underscores_and_extension():
    assert (
        _pdf_filename_title("https://x.ci/dossier/Arrete-Ouverture-2027.pdf")
        == "Arrete Ouverture 2027"
    )


def test_make_pdf_item_ena_communique():
    cfg = _ena_config()
    item = _make_pdf_item(
        "https://www.ena.ci/assets/fichiers/communiques/Communiqu%C3%A9%20ATE%20session%202026.pdf",
        cfg,
        cfg["organizer"],
        cfg["category"],
        "ENA",
    )
    assert item is not None
    ok, reason = item.is_valid()
    assert ok, reason
    assert item.title == "Communiqué ATE session 2026"
    assert item.documents[0]["url"].endswith(".pdf")
    assert item.source_url.endswith(".pdf")


def test_make_pdf_item_ignores_non_communique():
    """Un PDF qui ne ressemble pas à un communiqué (plaquette, formulaire…) est ignoré."""
    cfg = _ena_config()
    item = _make_pdf_item(
        "https://www.ena.ci/assets/fichiers/plaquette-de-presentation.pdf",
        cfg,
        cfg["organizer"],
        cfg["category"],
        "ENA",
    )
    assert item is None


def test_collect_detail_links_accepts_pdfs_and_skips_navigation():
    html = (
        '<a href="/assets/fichiers/communiques/Arrete%20Ouverture%202027.pdf">Arrêté</a>'
        '<a href="/index.php?men=accueil">Navigation</a>'
        '<a href="/index.php?men=concours&amp;b=details">Fiche concours</a>'
    )
    links = _collect_detail_links(BeautifulSoup(html, "lxml"), "https://www.ena.ci")
    assert any("Arrete%20Ouverture%202027.pdf" in l for l in links)
    assert any("men=concours" in l for l in links)
    assert not any("men=accueil" in l for l in links)


if __name__ == "__main__":
    import traceback

    # Console Windows : forcer UTF-8 pour les symboles ✓/✗.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    tests = [
        fn for name, fn in sorted(globals().items())
        if name.startswith("test_") and callable(fn)
    ]
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
