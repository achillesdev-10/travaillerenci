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

        last_exc: Optional[Exception] = None
        for attempt in range(2):
            try:
                resp = self.session.post(GROQ_URL, headers=headers, json=payload)
                if resp.status_code == 429 and attempt == 0:
                    # Quota/minute dépassé : on laisse le quota se rétablir.
                    time.sleep(5)
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
                time.sleep(1)
        raise RuntimeError(f"Groq injoignable : {last_exc}")
