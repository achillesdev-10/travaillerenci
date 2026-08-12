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
from typing import Set

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
    def __init__(self):
        self.seen_hashes: Set[str] = set()
        self.seen_keys: Set[str] = set()

    def compute_hash(self, item: ContentItem) -> str:
        corpus = (
            f"{_norm(item.title)}|{_norm(item.company)}|"
            f"{_norm(item.location)}"
        )
        return hashlib.sha256(corpus.encode("utf-8")).hexdigest()

    def is_duplicate(self, item: ContentItem) -> bool:
        h = self.compute_hash(item)
        k = item.dedup_key()
        if h in self.seen_hashes or k in self.seen_keys:
            return True
        self.seen_hashes.add(h)
        self.seen_keys.add(k)
        return False
