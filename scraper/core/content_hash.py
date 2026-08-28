#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/core/content_hash.py
  Cache de hash de contenu brut pour éviter les appels Gemini inutiles.

  Avant d'appeler Gemini pour réécrire une offre, on calcule un hash du
  contenu brut (titre + description bruts de la source) et on le compare
  au hash stocké de la dernière version connue. Si identique, on saute
  l'appel Gemini et on réutilise le contenu déjà réécrit (depuis la BDD).

  Stockage : fichier JSON (data/content-hashes.json)
  Clé : hash → {source_url, cached_description, cached_title, ...}
===============================================================================
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Optional

from scraper.core.logger import setup_logger

logger = setup_logger("content_hash")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
HASH_CACHE_PATH = DATA_DIR / "content-hashes.json"


def _compute_hash(title: str, description: str) -> str:
    """Calcule un hash SHA-256 du contenu brut (titre + description normalisés)."""
    # Normalisation minimale : minuscules, espaces multiples → simple, sans ponctuation
    corpus = f"{title.strip().lower()}|{description.strip().lower()}"
    return hashlib.sha256(corpus.encode("utf-8")).hexdigest()[:32]


class ContentHashCache:
    """Cache de hash pour éviter les appels Gemini sur contenu inchangé."""

    def __init__(self, cache_path: Optional[Path] = None):
        self.cache_path = cache_path or HASH_CACHE_PATH
        self._cache: dict[str, dict] = self._load()

    def _load(self) -> dict[str, dict]:
        if not self.cache_path.exists():
            return {}
        try:
            data = json.loads(self.cache_path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (json.JSONDecodeError, OSError):
            return {}

    def save(self) -> None:
        """Sauvegarde le cache (appeler après le traitement de tous les items)."""
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            tmp = self.cache_path.with_suffix(".tmp")
            tmp.write_text(
                json.dumps(self._cache, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            tmp.replace(self.cache_path)
        except OSError as exc:
            logger.debug(f"Écriture content-hashes.json impossible : {exc}")

    def is_unchanged(self, source_url: str, raw_title: str, raw_description: str) -> bool:
        """Vérifie si le contenu brut est identique à la dernière version connue."""
        h = _compute_hash(raw_title, raw_description)
        entry = self._cache.get(source_url)
        if entry and entry.get("hash") == h:
            return True
        return False

    def store(self, source_url: str, raw_title: str, raw_description: str) -> None:
        """Stocke le hash du contenu brut pour cette URL."""
        h = _compute_hash(raw_title, raw_description)
        self._cache[source_url] = {
            "hash": h,
            "raw_title": raw_title[:200],
        }

    def remove(self, source_url: str) -> None:
        """Supprime une entrée du cache (offre supprimée)."""
        self._cache.pop(source_url, None)

    def cleanup(self, valid_urls: set[str]) -> int:
        """Supprime les entrées dont l'URL n'est plus dans la BDD."""
        before = len(self._cache)
        self._cache = {url: v for url, v in self._cache.items() if url in valid_urls}
        return before - len(self._cache)
