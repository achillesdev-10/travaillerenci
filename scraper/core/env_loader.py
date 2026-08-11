#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/core/env_loader.py
  Chargement des variables locales depuis .env.local (sans python-dotenv)

  Les secrets (GROQ_API_KEY, GEMINI_API_KEY…) sont lus depuis l'environnement
  (GitHub Actions / Vercel) ou, en développement local, depuis le fichier
  .env.local à la racine du projet (gitignoré — ne jamais y committer un secret
  ailleurs qu'en local).

  Règle : on ne fait JAMAIS écraser une variable déjà présente dans
  l'environnement (les secrets CI/Vercel ont la priorité).
===============================================================================
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional


def load_env_file(path: Optional[str] = None) -> None:
    """Charge un fichier « clé=valeur » dans os.environ si la clé est absente.

    Supporte les commentaires (#) et les valeurs entre guillemets simples ou
    doubles. Ignore silencieusement toute erreur (non bloquant)."""
    env_path = Path(path) if path else Path(__file__).resolve().parent.parent.parent / ".env.local"
    if not env_path.exists():
        return
    try:
        for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            if key and key not in os.environ:
                os.environ[key] = value
    except Exception:
        # Le chargement des env ne doit jamais faire échouer le scraper.
        pass
