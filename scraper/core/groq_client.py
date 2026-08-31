#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/core/groq_client.py
  Client minimal Groq (API OpenAI-compatible) — FALLBACK IA

  Architecture de repli : Gemini d'abord (scraper/core/gemini*.py), puis Groq
  si Gemini échoue (timeout, rate limit, quota, erreur API, réponse vide ou
  JSON invalide), puis heuristiques locales en dernier recours.

  Clé lue depuis GROQ_API_KEY (variable d'environnement — jamais en dur dans
  le code, jamais commitée). À définir dans .env.local (développement) et dans
  les secrets GitHub Actions / Vercel (production).

  L'API Groq est compatible OpenAI : POST https://api.groq.com/openai/v1/chat/completions
  avec Authorization: Bearer <clé>. Retourne choices[0].message.content.
===============================================================================
"""

from __future__ import annotations

import os
import time
from typing import Optional

import httpx

from scraper.core.logger import setup_logger

logger = setup_logger("groq")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b"


class GroqClient:
    """Appelle Groq en chat completions. Ne contient AUCUNE logique métier :
    les appels (gemini.py, gemini_exams.py) s'occupent du parsing JSON et de
    la validation, comme pour Gemini."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        # Lecture de l'environnement À L'INSTANTIATION (jamais à l'import) :
        # le modèle est alors correct même si .env.local est chargé après
        # l'import du module (voir env_loader.py).
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.model = model or os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL)
        self.enabled = bool(self.api_key)
        self.session = httpx.Client(timeout=60, follow_redirects=True)
        # Circuit breaker : callback optionnel appelé quand un429 quota
        # est détecté. Le parent (_GeminiClient) utilise ce callback
        # pour marquer Groq indisponible pour le reste du run.
        self._on_quota_429: Optional[object] = None  # callable(provider_name: str) | None

    def close(self) -> None:
        try:
            self.session.close()
        except Exception:
            pass

    def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 4096,
    ) -> str:
        """Envoie la requête et retourne le texte brut de la réponse.

        Stratégie de retry : 4 tentatives avec backoff exponentiel.
        • 429 (rate-limit) : 5→10→20→40s
        • 413 (Payload Too Large) : pas de retry, échec immédiat
        • 5xx (erreur serveur) : 2→4→8s
        Lève une exception si la clé est absente, si l'API répond une erreur
        (429/5xx… après retry), un timeout ou une réponse vide — l'appelant
        décidera de la suite (repli / heuristique)."""
        if not self.enabled:
            raise RuntimeError("GROQ_API_KEY absente — fallback Groq indisponible")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        max_attempts = 4
        last_exc: Optional[Exception] = None
        saw_quota = False
        for attempt in range(max_attempts):
            try:
                resp = self.session.post(GROQ_URL, headers=headers, json=payload)
                if resp.status_code == 413:
                    # Payload trop lourd → pas de sens de retry
                    raise RuntimeError("Groq : payload trop volumineux (413)")
                if resp.status_code == 429:
                    saw_quota = True
                    # Circuit breaker : un quota épuisé ne se régénère pas
                    # en quelques secondes — signaler immédiatement au parent
                    # pour marquer Groq indisponible.
                    if self._on_quota_429 is not None:
                        try:
                            self._on_quota_429("groq")  # type: ignore[misc]
                        except Exception:
                            pass
                    # Retour immédiat : pas de backoff sur un quota épuisé
                    raise RuntimeError("Groq : quota 429 épuisé")
                if resp.status_code >= 500:
                    wait = min(2 * (2 ** attempt), 16)
                    logger.warning(
                        f"⚠️ Groq {resp.status_code} (tentative {attempt + 1}/{max_attempts}) — "
                        f"attente {wait}s avant nouvelle tentative."
                    )
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                data = resp.json()
                content = (
                    data.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                )
                if not content:
                    raise ValueError("réponse Groq vide")
                return content
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if isinstance(exc, RuntimeError) and ("413" in str(exc) or "429" in str(exc)):
                    raise
                time.sleep(1)
        raise RuntimeError(f"Groq injoignable : {last_exc}")
