#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tests unitaires du module alert_digest (matching + fréquence quotidienne).

Exécution :
    python scraper/tests/test_alert_digest.py
"""

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from alert_digest import (
    _parse_lookback_hours,
    already_sent_today,
    matches_exam,
    matches_job,
    norm,
    parse_content_types,
)

JOB = {
    "id": "job-1",
    "category": "job",
    "title": "Développeur Full Stack React / Node.js",
    "company": "MTN Côte d'Ivoire",
    "location": "Abidjan - Plateau",
    "description": "Rejoignez l'équipe digitale. Compétences : React, Node.js, API.",
}

INTERNSHIP = {
    "id": "job-2",
    "category": "internship",
    "title": "Stagiaire Data Analyst",
    "company": "Ecobank CI",
    "location": "Abidjan - Cocody",
    "description": "Stage BI & Data, Bac+4/5.",
}

EXAM = {
    "id": "exam-1",
    "category": "enseignement",
    "title": "Concours direct CAFOP cycle B",
    "organizer": "CAFOP/DECO",
    "location": "Abidjan",
    "cities": ["Abidjan", "Bouaké"],
    "diplomas": ["BEPC", "BAC"],
    "min_diploma_level": 2,
}


class TestNorm(unittest.TestCase):
    def test_accents_and_case(self):
        self.assertEqual(norm("Bouaké"), "bouake")
        self.assertEqual(norm("École Nationale"), "ecole nationale")


class TestParseContentTypes(unittest.TestCase):
    def test_list(self):
        self.assertEqual(parse_content_types(["job", "exam"]), ["job", "exam"])

    def test_json_string(self):
        self.assertEqual(parse_content_types('["job","scholarship"]'), ["job", "scholarship"])

    def test_invalid(self):
        self.assertEqual(parse_content_types(None), [])
        self.assertEqual(parse_content_types("pas-json"), [])


class TestMatchesJob(unittest.TestCase):
    def test_content_types_filters(self):
        self.assertTrue(matches_job(JOB, {"content_types": ["job"]}))
        self.assertFalse(matches_job(JOB, {"content_types": ["internship"]}))
        self.assertTrue(matches_job(INTERNSHIP, {"content_types": ["internship"]}))
        # Vide = tous les contenus.
        self.assertTrue(matches_job(JOB, {"content_types": []}))

    def test_city(self):
        self.assertTrue(matches_job(JOB, {"city": "Abidjan"}))
        self.assertTrue(matches_job(JOB, {"city": "Plateau"}))
        self.assertFalse(matches_job(JOB, {"city": "Bouaké"}))

    def test_diploma_keyword(self):
        self.assertTrue(matches_job(JOB, {"diploma": "Node.js"}))
        self.assertFalse(matches_job(JOB, {"diploma": "Master"}))
        self.assertTrue(matches_job(INTERNSHIP, {"diploma": "Bac+4"}))

    def test_sector(self):
        self.assertTrue(matches_job(JOB, {"sector": "it-digital"}))
        self.assertFalse(matches_job(JOB, {"sector": "sante"}))
        self.assertFalse(matches_job(JOB, {"sector": "juridique"}))

    def test_combined(self):
        alert = {"content_types": ["job"], "city": "Abidjan", "sector": "it-digital"}
        self.assertTrue(matches_job(JOB, alert))
        alert2 = {"content_types": ["job"], "city": "Korhogo", "sector": "it-digital"}
        self.assertFalse(matches_job(JOB, alert2))


class TestMatchesExam(unittest.TestCase):
    def test_content_types(self):
        self.assertTrue(matches_exam(EXAM, {"content_types": ["exam"]}))
        self.assertTrue(matches_exam(EXAM, {"content_types": []}))
        self.assertFalse(matches_exam(EXAM, {"content_types": ["job"]}))

    def test_city(self):
        self.assertTrue(matches_exam(EXAM, {"city": "Abidjan"}))
        self.assertTrue(matches_exam(EXAM, {"city": "Bouaké"}))
        self.assertFalse(matches_exam(EXAM, {"city": "San-Pédro"}))

    def test_diploma_in_list(self):
        self.assertTrue(matches_exam(EXAM, {"diploma": "BAC"}))
        self.assertTrue(matches_exam(EXAM, {"diploma": "BEPC"}))

    def test_diploma_by_level(self):
        # CEPE (niveau 1) ≤ min_diploma_level 2 → pas éligible.
        self.assertFalse(matches_exam(EXAM, {"diploma": "CEPE"}))
        # Licence (6) ≥ 2 → éligible même si absente de la liste (niveau ≥ min).
        self.assertTrue(matches_exam(EXAM, {"diploma": "Licence"}))

    def test_diploma_unknown_is_permissive(self):
        self.assertTrue(matches_exam(EXAM, {"diploma": "Doctorat Inconnu"}))

    def test_sector(self):
        self.assertTrue(matches_exam(EXAM, {"sector": "education-formation"}))
        self.assertFalse(matches_exam(EXAM, {"sector": "sante"}))
        self.assertFalse(matches_exam(EXAM, {"sector": "it-digital"}))


class TestParseLookbackHours(unittest.TestCase):
    """Régression CI : GitHub substitue les `vars.` non configurés par une
    chaîne vide — `int("")` levait ValueError et faisait échouer l'étape
    « Notifications alertes candidat » du workflow auto-publish."""

    def test_absent_returns_default(self):
        self.assertEqual(_parse_lookback_hours(None), 24)

    def test_empty_string_returns_default(self):
        self.assertEqual(_parse_lookback_hours(""), 24)
        self.assertEqual(_parse_lookback_hours("   "), 24)

    def test_non_numeric_returns_default(self):
        self.assertEqual(_parse_lookback_hours("abc"), 24)

    def test_valid_value(self):
        self.assertEqual(_parse_lookback_hours("48"), 48)
        self.assertEqual(_parse_lookback_hours(" 6 "), 6)


class TestAlreadySentToday(unittest.TestCase):
    def test_daily_sent_today_skips(self):
        alert = {
            "frequency": "daily",
            "last_sent_at": datetime.now(timezone.utc).isoformat(),
        }
        self.assertTrue(already_sent_today(alert, datetime.now(timezone.utc)))

    def test_daily_sent_yesterday_sends(self):
        alert = {
            "frequency": "daily",
            "last_sent_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        }
        self.assertFalse(already_sent_today(alert, datetime.now(timezone.utc)))

    def test_immediate_never_skips(self):
        alert = {
            "frequency": "immediate",
            "last_sent_at": datetime.now(timezone.utc).isoformat(),
        }
        self.assertFalse(already_sent_today(alert, datetime.now(timezone.utc)))

    def test_no_last_sent(self):
        self.assertFalse(already_sent_today({"frequency": "daily", "last_sent_at": None}, datetime.now(timezone.utc)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
