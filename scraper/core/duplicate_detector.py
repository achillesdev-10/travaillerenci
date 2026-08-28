#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/core/duplicate_detector.py
  Détection avancée des doublons (titre, organisme, ville, hash, similarité)
===============================================================================
"""

from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path
from typing import Optional, Set

from scraper.models.content_item import ContentItem


_ACCENTS = str.maketrans(
    "àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÜÛÇ",
    "aaaeeeeiioouuucAAAEEEEIIOOUUUC",
)


def _norm(value: str) -> str:
    """Minuscules + accents retirés (tolérant aux variantes de source)."""
    s = (value or "").strip().lower()
    s = s.replace("œ", "oe").replace("æ", "ae")
    return s.translate(_ACCENTS)


class DuplicateDetector:
    """Déduplication intra-run + inter-sources (via la BDD).

    Logique de correspondance inter-sources :
      - Même entreprise (normalisée) + même titre (normalisé, 80%+ de similarité
        par recouvrement de tokens) → doublon.
      - Même source_url → doublon.
    """

    def __init__(self, db_path: Optional[Path] = None):
        self.seen_hashes: Set[str] = set()
        self.seen_keys: Set[str] = set()
        self._db_path = db_path
        # Cache des titres existants en BDD pour la détection inter-sources
        self._db_cache: Optional[Set[str]] = None

    def compute_hash(self, item: ContentItem) -> str:
        corpus = (
            f"{_norm(item.title)}|{_norm(item.company)}|"
            f"{_norm(item.location)}"
        )
        return hashlib.sha256(corpus.encode("utf-8")).hexdigest()

    def _get_db_titles(self) -> Set[str]:
        """Charge les titres+entreprises existants en BDD (cache lazy)."""
        if self._db_cache is not None:
            return self._db_cache
        if not self._db_path or not self._db_path.exists():
            self._db_cache = set()
            return self._db_cache
        try:
            conn = sqlite3.connect(str(self._db_path), timeout=10)
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT title, company, source_url FROM job_offers WHERE status != 'archived' LIMIT 5000"
            ).fetchall()
            conn.close()
            self._db_cache = set()
            for row in rows:
                key = f"{_norm(str(row['title']))}|{_norm(str(row['company']))}"
                self._db_cache.add(key)
                if row['source_url']:
                    self._db_cache.add(f"url:{str(row['source_url']).lower()}")
        except Exception:
            self._db_cache = set()
        return self._db_cache

    def _token_overlap(self, a: str, b: str) -> float:
        """Calcule le ratio de recouvrement de tokens entre deux chaînes.
        Retourne un float entre 0.0 et 1.0."""
        tokens_a = set(a.split())
        tokens_b = set(b.split())
        if not tokens_a or not tokens_b:
            return 0.0
        intersection = tokens_a & tokens_b
        return len(intersection) / min(len(tokens_a), len(tokens_b))

    def is_duplicate(self, item: ContentItem) -> bool:
        """Vérifie si un item est un doublon (intra-run ou inter-sources)."""
        # 1. Déduplication intra-run (rapide, en mémoire)
        h = self.compute_hash(item)
        k = item.dedup_key()
        if h in self.seen_hashes or k in self.seen_keys:
            return True
        self.seen_hashes.add(h)
        self.seen_keys.add(k)

        # 2. Déduplication inter-sources (via la BDD)
        db_titles = self._get_db_titles()
        norm_title = _norm(item.title)
        norm_company = _norm(item.company)

        # Vérification rapide par clé exacte
        exact_key = f"{norm_title}|{norm_company}"
        if exact_key in db_titles:
            return True

        # Vérification par URL
        if item.source_url:
            url_key = f"url:{item.source_url.lower()}"
            if url_key in db_titles:
                return True

        # Vérification par similarité de titre (pour les cas où le titre
        # a légèrement changé entre deux sources)
        for db_key in db_titles:
            if db_key.startswith("url:"):
                continue
            parts = db_key.split("|", 1)
            if len(parts) != 2:
                continue
            db_title, db_company = parts
            # Même entreprise + titre similaire ≥ 80%
            if norm_company == db_company and self._token_overlap(norm_title, db_title) >= 0.8:
                return True

        return False
