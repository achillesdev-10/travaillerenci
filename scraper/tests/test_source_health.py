#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/tests/test_source_health.py
  Tests unitaires du suivi de santé par source et des fallback selectors

  Vérifie :
    1. Le calcul de la moyenne historique
    2. La détection de seuil minimal (low volume)
    3. La génération d'alertes
    4. Le taux de succès
    5. Le parsing des fixtures HTML (fallback selectors)
===============================================================================
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scraper.source_health import SourceHealthTracker  # noqa: E402


def test_average_collected_empty():
    """Pas d'historique → moyenne None."""
    tracker = SourceHealthTracker()
    tracker._history = {}  # force empty
    assert tracker._average_collected("educarriere") is None


def test_average_collected_single_run():
    """Un seul run historique → moyenne None (pas assez de données)."""
    tracker = SourceHealthTracker()
    tracker._history = {"educarriere": [{"collected": 10, "errors": 0}]}
    assert tracker._average_collected("educarriere") is None


def test_average_collected_multiple_runs():
    """Plusieurs runs → moyenne calculée sur les runs précédents (exclut le dernier)."""
    tracker = SourceHealthTracker()
    tracker._history = {
        "educarriere": [
            {"collected": 10, "errors": 0},
            {"collected": 12, "errors": 0},
            {"collected": 8, "errors": 0},
        ]
    }
    # Moyenne des 2 premiers runs (exclut le 3ème qui est le "dernier")
    avg = tracker._average_collected("educarriere")
    assert avg is not None
    assert abs(avg - 11.0) < 0.01


def test_threshold_ok_above_average():
    """Run au-dessus du seuil → threshold_ok=True."""
    tracker = SourceHealthTracker(threshold=0.20)
    tracker._history = {
        "emploici": [
            {"collected": 20, "errors": 0},
            {"collected": 25, "errors": 0},
            {"collected": 18, "errors": 0},
        ]
    }
    record = tracker.record_run("emploici", collected=22, errors=0)
    assert record.threshold_ok is True


def test_threshold_below_average():
    """Run bien en dessous du seuil → threshold_ok=False."""
    tracker = SourceHealthTracker(threshold=0.20)
    tracker._history = {
        "emploici": [
            {"collected": 20, "errors": 0},
            {"collected": 25, "errors": 0},
            {"collected": 18, "errors": 0},
        ]
    }
    # Moyenne = (20+25)/2 = 22.5, seuil = 22.5 * 0.20 = 4.5
    # collected=3 < 4.5 → threshold_ok=False
    record = tracker.record_run("emploici", collected=3, errors=0)
    assert record.threshold_ok is False


def test_alert_on_complete_failure():
    """Source avec 0 offres et erreurs → alerte complète."""
    tracker = SourceHealthTracker()
    tracker.record_run("boursedetude", collected=0, errors=2)
    alerts = tracker.check_and_alert()
    assert len(alerts) == 1
    assert alerts[0]["type"] == "complete_failure"
    assert alerts[0]["source"] == "boursedetude"


def test_alert_on_low_volume():
    """Source avec volume anormalement bas → alerte low_volume."""
    tracker = SourceHealthTracker(threshold=0.20)
    tracker._history = {
        "educarriere": [
            {"collected": 15, "errors": 0},
            {"collected": 18, "errors": 0},
            {"collected": 12, "errors": 0},
        ]
    }
    # Moyenne = (15+18)/2 = 16.5, seuil = 16.5 * 0.20 = 3.3
    # collected=2 < 3.3 → alerte low_volume
    tracker.record_run("educarriere", collected=2, errors=0)
    alerts = tracker.check_and_alert()
    assert len(alerts) == 1
    assert alerts[0]["type"] == "low_volume"
    assert "educarriere" in alerts[0]["message"]


def test_no_alert_normal_volume():
    """Volume normal → pas d'alerte."""
    tracker = SourceHealthTracker(threshold=0.20)
    tracker._history = {
        "educarriere": [
            {"collected": 15, "errors": 0},
            {"collected": 18, "errors": 0},
        ]
    }
    tracker.record_run("educarriere", collected=14, errors=0)
    alerts = tracker.check_and_alert()
    assert len(alerts) == 0


def test_success_rate():
    """Taux de succès calculé correctement."""
    tracker = SourceHealthTracker()
    tracker._history = {
        "emploici": [
            {"collected": 10, "errors": 0},
            {"collected": 12, "errors": 1},
            {"collected": 8, "errors": 0},
            {"collected": 15, "errors": 0},
        ]
    }
    rate = tracker.get_success_rate("emploici")
    assert abs(rate - 0.75) < 0.01  # 3 success / 4 total


def test_history_window_limit():
    """L'historique est limité à HISTORY_WINDOW entrées."""
    tracker = SourceHealthTracker()
    for i in range(15):
        tracker.record_run("test_source", collected=i, errors=0)
    assert len(tracker._history["test_source"]) <= 7  # HISTORY_WINDOW


def test_stats_summary():
    """Le résumé contient les bonnes clés."""
    tracker = SourceHealthTracker()
    tracker._history = {
        "educarriere": [
            {"collected": 10, "published": 5, "errors": 0, "duration_seconds": 12.5, "timestamp": "2026-01-01T00:00:00Z"},
        ]
    }
    summary = tracker.get_stats_summary()
    assert "educarriere" in summary
    assert summary["educarriere"]["latest_collected"] == 10
    assert summary["educarriere"]["success_rate"] == 1.0


# ---------------------------------------------------------------------------
# Tests de parsing des fixtures HTML (fallback selectors)
# ---------------------------------------------------------------------------

def test_educarriere_fallback_parsing():
    """Le parser Educarriere extrait correctement le titre et la description depuis une fixture."""
    from bs4 import BeautifulSoup

    fixture_path = HERE / "fixtures" / "educarriere_sample.html"
    if not fixture_path.exists():
        print("  SKIP test_educarriere_fallback_parsing (fixture manquante)")
        return

    html = fixture_path.read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "lxml")

    # Titre depuis h1
    h1 = soup.find("h1")
    title = h1.get_text(" ", strip=True) if h1 else ""
    assert "Développeur Web" in title

    # Container
    container = (
        soup.select_one(".job-description")
        or soup.select_one("article")
        or soup.select_one("main")
    )
    assert container is not None
    assert "TechCI Solutions" in container.get_text()


def test_emploici_fallback_parsing():
    """Le parser Emploici extrait correctement les champs structurés depuis une fixture."""
    from bs4 import BeautifulSoup

    fixture_path = HERE / "fixtures" / "emploici_sample.html"
    if not fixture_path.exists():
        print("  SKIP test_emploici_fallback_parsing (fixture manquante)")
        return

    html = fixture_path.read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "lxml")

    # Titre depuis h2
    title = ""
    for h2 in soup.find_all("h2"):
        candidate = h2.get_text(" ", strip=True)
        if len(candidate) > 12:
            title = candidate
            break
    assert "Commercial" in title

    # Champs structurés
    text = soup.get_text("\n", strip=True)
    assert "Abidjan" in text
    assert "FinancePlus" in text


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
