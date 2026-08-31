#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/core/_gemini_client.py
  Client Gemini partagé : chaîne de modèles, retries, parsing JSON.

  Fournit la classe _GeminiClient dont GeminiEnricher (offres) et
  ExamGeminiEnricher (concours) héritent.  Toute la logique de communication
  avec l'API Gemini (retries 429/500/503, repli inter-modèles, extraction
  du texte, parse JSON) est centralisée ici pour éviter la duplication.
===============================================================================
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Dict, Optional

import httpx

from scraper.core.groq_client import GroqClient
from scraper.core.logger import setup_logger

# Délai minimum entre deux requêtes individuelles (secondes).
# Évite les429 cascadants quand le batch échoue et les items sont
# traités un par un.
INTER_REQUEST_DELAY = float(os.getenv("INTER_REQUEST_DELAY", "1.5"))

logger = setup_logger("gemini_client")

# ── Constantes partagées ──────────────────────────────────────────────────

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
# Modèles de repli si le modèle principal est saturé (quota/minute 429) :
# le quota est PAR MODÈLE — basculer sur un autre modèle contourne la limite.
GEMINI_MODEL_FALLBACKS = [
    m.strip()
    for m in os.getenv("GEMINI_MODEL_FALLBACKS", "gemini-3-flash-preview").split(",")
    if m.strip()
]
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


# ── Exceptions ────────────────────────────────────────────────────────────

class GeminiQuotaExhausted(Exception):
    """Levée quand toutes les tentatives sur un modèle Gemini épuisent le quota (429)."""

    def __init__(self, model: str = ""):
        self.model = model
        super().__init__(f"Gemini quota épuisé sur {model or '(inconnu)'}")


# ── Helpers ───────────────────────────────────────────────────────────────

def strip_markdown_code_fences(raw: str) -> str:
    """Retire les blocs ```json ... ``` éventuellement renvoyés par le modèle."""
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


# ── Classe de base ────────────────────────────────────────────────────────

class _GeminiClient:
    """Client HTTP partagé pour l'API Gemini REST.

    Gère :
      - le choix du modèle (principal + replis inter-modèles sur 429)
      - les retries avec backoff sur 429/500/503
      - le fallback automatique Gemini → Groq
      - le parse JSON robuste (fences, extraction d'objet, etc.)
      - un circuit breaker par provider (Gemini / Groq) : dès qu'une erreur
        429 (quota épuisé) est détectée, le provider est marqué indisponible
        pour le reste du run — plus aucun appel réseau IA inutile.

    Les sous-classes (GeminiEnricher, ExamGeminiEnricher) n'ont qu'à
    implémenter : `_build_prompt`, `_validate_ai_result`, `_apply_ai`,
    `_apply_heuristics` et la méthode publique `enrich`.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        *,
        log_label: str = "gemini",
        temperature: float = 0.3,
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model or GEMINI_MODEL
        self.enabled = bool(self.api_key)
        self.fallback_models = list(GEMINI_MODEL_FALLBACKS)
        self._last_working_model: Optional[str] = None
        self._temperature = temperature

        # Fallback Gemini → Groq (GROQ_API_KEY)
        self.groq = GroqClient()
        self.groq._on_quota_429 = self._on_provider_quota_exhausted  # type: ignore[attr-defined]
        self.session = httpx.Client(timeout=60, follow_redirects=True)
        # Cooldown après un429 : timestamp du dernier rate-limit reçu.
        # Permet d'ajouter un délai entre deux requêtes même en dehors des retries.
        self._last_rate_limit: float = 0.0

        # Circuit breaker : état par provider (durée du run uniquement).
        # Dès qu'un provider renvoie 429 (quota épuisé), il est marqué
        # indisponible — les appels suivants basculent directement sur
        # le repli heuristique sans aucun appel réseau IA inutile.
        self._providers_unavailable: dict[str, float] = {}  # provider → timestamp

        if self.enabled or self.groq.enabled:
            providers = "Gemini + repli Groq" if (self.enabled and self.groq.enabled) else (
                "Gemini" if self.enabled else "Groq (Gemini absent)"
            )
            logger.info(f"🤖 Enrichissement IA activé ({providers})")
        else:
            logger.warning(f"⚠️ GEMINI_API_KEY et GROQ_API_KEY absentes — enrichissement {log_label} désactivé.")

    def close(self) -> None:
        try:
            self.session.close()
            self.groq.close()
        except Exception:
            pass

    # ── Circuit breaker ────────────────────────────────────────────────────

    def _on_provider_quota_exhausted(self, provider: str) -> None:
        """Callback appelé quand un provider signale un quota 429 épuisé.

        Marque le provider indisponible pour le reste du run. Utilisé
        par le callback GroqClient._on_quota_429 et par call_gemini.
        """
        if provider not in self._providers_unavailable:
            self._providers_unavailable[provider] = time.time()
            logger.warning(
                f"🚫 Circuit breaker : provider '{provider}' marqué indisponible "
                f"(quota 429 épuisé) — plus aucun appel réseau IA sur ce provider "
                f"pour le reste du run."
            )

    def _is_provider_available(self, provider: str) -> bool:
        """Vérifie si un provider n'a pas été marqué indisponible."""
        return provider not in self._providers_unavailable

    # ── Appel Gemini avec chaîne de repli ─────────────────────────────────

    def call_gemini(self, prompt: str, *, system_prompt: str = "") -> str:
        # Circuit breaker : si Gemini a déjà été marqué indisponible
        # (quota 429 épuisé sur un appel précédent), ne pas réessayer.
        if not self._is_provider_available("gemini"):
            raise GeminiQuotaExhausted(self.model)

        """Envoie un prompt à Gemini avec repli automatique inter-modèles.

        Si le modèle principal est saturé (429), essaie les modèles de repli
        dans l'ordre. Le dernier modèle ayant fonctionné est réessayé en
        premier pour la session (évite les attentes 20s répétées).
        """
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["x-goog-api-key"] = self.api_key

        # Construire le prompt complet si un system_prompt est fourni
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

        payload = {
            "contents": [{"parts": [{"text": full_prompt}]}],
            "generationConfig": {
                "temperature": self._temperature,
                "maxOutputTokens": 4096,
                "responseMimeType": "application/json",
            },
        }

        # Respecter le cooldown après un rate-limit (429).
        # Évite de déclencher immédiatement un autre 429 juste après
        # avoir reçu le premier.
        elapsed = time.time() - self._last_rate_limit
        if elapsed < INTER_REQUEST_DELAY and self._last_rate_limit > 0:
            remaining = INTER_REQUEST_DELAY - elapsed
            if remaining > 0.1:
                logger.debug(f"⏳ Rate-limit cooldown : attente {remaining:.1f}s")
                time.sleep(remaining)

        # Chaîne de repli : modèle principal puis replis
        if self._last_working_model:
            models = [self._last_working_model] + [
                m for m in ([self.model] + self.fallback_models)
                if m != self._last_working_model
            ]
        else:
            models = [self.model] + [m for m in self.fallback_models if m != self.model]

        last_exc: Optional[Exception] = None
        for model in models:
            url = GEMINI_URL.format(model=model)
            try:
                text = self._post_gemini(url, headers, payload)
                self._last_working_model = model
                if model != self.model:
                    logger.warning(f"↪️ Bascule sur le modèle de repli {model} (quota du modèle principal atteint).")
                return text
            except GeminiQuotaExhausted:
                last_exc = last_exc or GeminiQuotaExhausted(model)
                continue
            except Exception as exc:
                last_exc = exc
                break

        # Tous les modèles ont échoué — si c'est un quota 429,
        # marquer Gemini indisponible pour le reste du run.
        if isinstance(last_exc, GeminiQuotaExhausted):
            self._on_provider_quota_exhausted("gemini")
        raise RuntimeError(f"Gemini injoignable : {last_exc}")

    def _post_gemini(self, url: str, headers: dict, payload: dict) -> str:
        """POST vers un modèle, avec retries sur 429/500/503 (quota/minute).

        Stratégie de backoff :
          • 429 (quota épuisé / rate-limit) : 1 seule tentative de retry
            avec délai court (3s) — un quota épuisé ne se régénère pas
            en quelques secondes, donc les retries multiples sont inutiles.
            Le circuit breaker marque ensuite le provider indisponible.
          • 503 (service indisponible temporaire) : backoff exponentiel
            2→4→8→16s (jusqu'à 4 tentatives) — retenter a du sens ici.
          • 500 (erreur serveur) : 3s fixes (jusqu'à 4 tentatives)

        Retourne None si toutes les tentatives sur 429 échouent
        (le modèle appelant passera au modèle de repli).
        """
        last_exc: Optional[Exception] = None
        saw_quota = False
        for attempt in range(4):
            try:
                resp = self.session.post(url, headers=headers, json=payload)
                if resp.status_code == 429:
                    saw_quota = True
                    # Un quota épuisé ne se régénère pas à court terme :
                    # 1 seule tentative de retry avec délai court, pas de
                    # backoff exponentiel qui gaspille du temps (5→40s).
                    if attempt == 0:
                        wait = 3
                        self._last_rate_limit = time.time() + wait
                        logger.warning(
                            f"⚠️ Gemini 429 (tentative 1/2) — attente {wait}s avant dernière tentative."
                        )
                        time.sleep(wait)
                        continue
                    # Deuxième tentative échouée → abandon immédiat
                    logger.warning("⚠️ Gemini 429 persistant — quota épuisé, abandon.")
                    return None  # type: ignore[return-value]
                if resp.status_code == 503:
                    # Indisponibilité temporaire : backoff exponentiel
                    wait = min(2 * (2 ** attempt), 16)
                    logger.warning(
                        f"⚠️ Gemini 503 (tentative {attempt + 1}/4) — attente {wait}s."
                    )
                    time.sleep(wait)
                    continue
                if resp.status_code == 500:
                    wait = 3
                    logger.warning(
                        f"⚠️ Gemini 500 (tentative {attempt + 1}/4) — attente {wait}s."
                    )
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                data = resp.json()
                text = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                if not text:
                    raise ValueError("réponse IA vide")
                return text
            except GeminiQuotaExhausted:
                raise
            except Exception as exc:  # noqa: BLE001
                if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
                    if exc.response.status_code == 429:
                        raise GeminiQuotaExhausted() from exc
                last_exc = exc
                time.sleep(1)
        if saw_quota:
            raise GeminiQuotaExhausted()
        raise RuntimeError(f"Gemini injoignable : {last_exc}")

    # ── Parse JSON robuste ────────────────────────────────────────────────

    def parse_json(self, raw: str) -> Dict[str, Any]:
        """Parse la réponse JSON du modèle avec replis.

        Gère : fences markdown, listes à élément unique, extraction du
        premier objet {…} équilibré. Lève ValueError si aucun objet valide.
        """
        text = strip_markdown_code_fences(raw)
        parsed = None
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            pass
        # Listes à élément unique → extraire l'objet
        if isinstance(parsed, list) and len(parsed) == 1:
            parsed = parsed[0]
        if isinstance(parsed, dict):
            return parsed
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            try:
                obj = json.loads(text[start : end + 1])
                if isinstance(obj, dict):
                    return obj
            except json.JSONDecodeError:
                pass
        raise ValueError("JSON IA illisible (attendu un objet, reçu un tableau ou du texte)")

    # ── Fallback Gemini → Groq ────────────────────────────────────────────

    def call_with_fallback(self, prompt: str, *, system_prompt: str = "") -> str:
        """Essaie Gemini, puis Groq, puis lève si les deux échouent."""
        last_exc: Optional[Exception] = None

        # 1) Gemini
        if self.enabled and self._is_provider_available("gemini"):
            try:
                return self.call_gemini(prompt, system_prompt=system_prompt)
            except Exception as exc:
                last_exc = exc
                # Si le msg contient "429" ou "quota", marquer indisponible
                if "429" in str(exc) or "quota" in str(exc).lower():
                    self._on_provider_quota_exhausted("gemini")
                logger.warning(f"⚠️ Échec Gemini : {exc} — tentative Groq…")
        elif self.enabled and not self._is_provider_available("gemini"):
            logger.debug("⏭️ Gemini indisponible (circuit breaker) — tentative Groq…")

        # 2) Groq — léger délai avant d'appeler Groq pour laisser
        #    le quota Gemini se rétablir et ne pas cumuler les 429.
        if self.groq.enabled and self._is_provider_available("groq"):
            time.sleep(1)
            try:
                return self.groq.complete(system_prompt or prompt, prompt)
            except Exception as exc:
                last_exc = exc
                if "429" in str(exc) or "quota" in str(exc).lower():
                    self._on_provider_quota_exhausted("groq")
                logger.warning(f"⚠️ Échec Groq : {exc}")
        elif self.groq.enabled and not self._is_provider_available("groq"):
            logger.debug("⏭️ Groq indisponible (circuit breaker)")

        raise RuntimeError(f"Aucun provider IA disponible : {last_exc}")
