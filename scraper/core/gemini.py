#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/core/gemini.py
  Enrichissement IA (Gemini) : classification + réécriture des contenus scrapés

  Pour chaque contenu brut collecté, on demande à Gemini (gemini-2.0-flash,
  API REST — aucune clé = pipeline purement heuristique) de :

    1. Classifier la catégorie (job / internship / scholarship / exam)
    2. Normaliser le titre, l'organisme, le lieu, le type de contrat, la deadline
    3. Réécrire la description en Markdown propre et structuré (sans inventer)

  Robustesse : si la clé est absente, la réponse est invalide ou l'appel
  échoue, on retombe sur des heuristiques locales (utils.classify_content)
  pour ne JAMAIS faire échouer le pipeline de scraping.
===============================================================================
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Dict, Optional

import httpx

from scraper.models.content_item import (
    CONTENT_CATEGORIES,
    ContentItem,
    SQL_CONTRACT_TYPES,
    NEUTRAL_CONTRACT,
)
from scraper.core.groq_client import GroqClient
from scraper.core.logger import setup_logger
from scraper.core.utils import classify_content

logger = setup_logger("gemini")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

SYSTEM_PROMPT = (
    "Tu es un rédacteur expert du marché de l'emploi, des stages, des bourses "
    "d'études et des concours administratifs en Côte d'Ivoire.\n"
    "À partir d'un contenu brut (scrapé d'un site web), tu dois le classer et le réécrire.\n\n"
    "Règles STRICTES :\n"
    "- Ne garde QUE les informations présentes dans le texte source : n'invente JAMAIS de "
    "missions, d'exigences, de salaire, de date limite ou de coordonnées.\n"
    "- Retire tout le bruit : navigation, publicités, compteurs, listes d'autres annonces, liens sociaux.\n"
    "- Convertis les listes en puces '- ' ; conserve les emails de candidature.\n"
    "- Français correct, phrases concises, aucun commentaire méta.\n"
    "- Réponds UNIQUEMENT au format JSON valide, sans aucun texte autour.\n"
)

# Champs attendus du JSON renvoyé par le modèle.
_JSON_FIELDS = {
    "category": "job",
    "title": "",
    "organization": "",
    "contract_type": NEUTRAL_CONTRACT,
    "location": "",
    "deadline": None,          # "YYYY-MM-DD" ou null
    "eligibility": "",
    "description_markdown": "",
}


def _sanitize_category(value: Any) -> str:
    if isinstance(value, str) and value.strip().lower() in CONTENT_CATEGORIES:
        return value.strip().lower()
    return "job"


def _sanitize_contract(value: Any) -> str:
    if isinstance(value, str):
        v = value.strip().title()
        if v in SQL_CONTRACT_TYPES:
            return v
        # Traductions courantes → valeur SQL valide
        mapping = {
            "Stage": "Stage", "Alternance": "Alternance", "Freelance": "Freelance",
            "Temps Plein": "CDI", "Cdi": "CDI", "Cdd": "CDD", "Prestation": "Prestation",
            "Contrat": NEUTRAL_CONTRACT, "Concours": NEUTRAL_CONTRACT,
            "Bourse": NEUTRAL_CONTRACT, "Autre": NEUTRAL_CONTRACT,
        }
        return mapping.get(v, NEUTRAL_CONTRACT)
    return NEUTRAL_CONTRACT


def _strip_markdown_code_fences(raw: str) -> str:
    """Retire les blocs ```json ... ``` éventuellement renvoyés par le modèle."""
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


class GeminiEnricher:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model or GEMINI_MODEL
        self.enabled = bool(self.api_key)
        # Fallback Gemini → Groq (GROQ_API_KEY) : utilisé si Gemini échoue
        # (quota, timeout, erreur API, réponse vide ou JSON invalide).
        self.groq = GroqClient()
        self.session = httpx.Client(timeout=60, follow_redirects=True)
        if self.enabled or self.groq.enabled:
            providers = "Gemini + repli Groq" if (self.enabled and self.groq.enabled) else (
                "Gemini" if self.enabled else "Groq (Gemini absent)"
            )
            logger.info(f"🤖 Enrichissement IA activé ({providers})")
        else:
            logger.warning("⚠️ GEMINI_API_KEY et GROQ_API_KEY absentes — classification & réécriture heuristiques.")

    def close(self) -> None:
        try:
            self.session.close()
            self.groq.close()
        except Exception:
            pass

    # ------------------------------------------------------------------
    def enrich(self, item: ContentItem) -> ContentItem:
        """Classifie + réécrit un item. Ne lève JAMAIS : fallback heuristique.

        Ordre : Gemini → (échec : timeout, quota, erreur, vide, JSON invalide,
        résultat inexploitable) → Groq → (échec) → heuristiques locales.
        Les logs précisent le fournisseur (provider=gemini / provider=groq)
        et la raison du repli.
        """
        prompt = self._build_prompt(item)

        # --- 1) Gemini (fournisseur principal) ---
        if self.enabled:
            try:
                raw = self._call_gemini(prompt)
                parsed = self._parse_json(raw)
                self._validate_ai_result(parsed, item)
                self._apply_ai(item, parsed)
                logger.info(f"✅ Réécriture IA OK : « {item.title[:50]} » (provider=gemini)")
                return item
            except Exception as exc:
                logger.warning(
                    f"⚠️ Échec Gemini pour « {item.title[:50]} » (provider=gemini, raison : {exc}) — tentative Groq…"
                )

        # --- 2) Groq (repli automatique) ---
        if self.groq.enabled:
            try:
                raw = self.groq.complete(SYSTEM_PROMPT, prompt)
                parsed = self._parse_json(raw)
                self._validate_ai_result(parsed, item)
                self._apply_ai(item, parsed)
                reason = "repli après échec Gemini" if self.enabled else "Gemini indisponible (non configuré)"
                logger.warning(
                    f"↪️ Réécriture via Groq : « {item.title[:50]} » (provider=groq, {reason})"
                )
                return item
            except Exception as exc:
                logger.warning(
                    f"⚠️ Échec Groq pour « {item.title[:50]} » (provider=groq, raison : {exc})"
                )

        # --- 3) Heuristiques locales (dernier filet) ---
        logger.warning(
            f"⚠️ IA indisponible pour « {item.title[:50]} » (gemini={'oui' if self.enabled else 'non'}, "
            f"groq={'oui' if self.groq.enabled else 'non'}) — repli heuristique."
        )
        return self._apply_heuristics(item)

    # ------------------------------------------------------------------
    def _build_prompt(self, item: ContentItem) -> str:
        return (
            f"{SYSTEM_PROMPT}\n"
            "Schéma JSON attendu :\n"
            '{\n'
            '  "category": "job | internship | scholarship | exam",\n'
            '  "title": "titre normalisé (court, sans nom du site)",\n'
            '  "organization": "nom de l\'entreprise / organisme / bailleur de bourse",\n'
            '  "contract_type": "CDI | CDD | Stage | Prestation | Alternance | Freelance | autre",\n'
            '  "location": "ville / pays",\n'
            '  "deadline": "date limite au format YYYY-MM-DD ou null",\n'
            '  "eligibility": "critères d\'éligibilité en une phrase ou null",\n'
            '  "description_markdown": "description réécrite en Markdown structuré"\n'
            '}\n\n'
            "--- Contenu brut ---\n"
            f"Titre brut : {item.title}\n"
            f"Source : {item.source_url}\n\n"
            f"{item.description[:9000]}\n\n"
            "--- JSON ---"
        )

    def _call_gemini(self, prompt: str) -> str:
        url = GEMINI_URL.format(model=self.model)
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["x-goog-api-key"] = self.api_key
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 4096,
                "responseMimeType": "application/json",
            },
        }

        last_exc: Optional[Exception] = None
        for attempt in range(2):
            try:
                resp = self.session.post(url, headers=headers, json=payload)
                if resp.status_code in (429, 500, 503) and attempt == 0:
                    time.sleep(2)
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
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                time.sleep(1)
        raise RuntimeError(f"Gemini injoignable : {last_exc}")

    def _parse_json(self, raw: str) -> Dict[str, Any]:
        text = _strip_markdown_code_fences(raw)
        # Certains modèles renvoient un JSON fiable mais avec des retours à la
        # ligne intérieurs aux chaînes : on tente d'abord un parse strict.
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        # Repli : extraire le premier objet {...} équilibré.
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
        raise ValueError("JSON IA illisible")

    # ------------------------------------------------------------------
    def _validate_ai_result(self, parsed: Dict[str, Any], item: ContentItem) -> None:
        """Valide une réponse IA AVANT application. Lève ValueError si le
        résultat est inexploitable (l'appelant bascule alors sur Groq puis
        sur l'heuristique)."""
        title = str(parsed.get("title") or "").strip()
        description = str(parsed.get("description_markdown") or "").strip()
        if not title:
            raise ValueError("titre vide renvoyé par l'IA")
        if re.match(r"^https?://", title, re.I):
            raise ValueError("titre = URL brute")
        if len(description) < 40:
            raise ValueError("description vide ou trop courte (non informative)")
        if re.match(r"^https?://\S+$", description, re.I):
            raise ValueError("description = lien brut, non rédigée")

    # ------------------------------------------------------------------
    def _apply_ai(self, item: ContentItem, parsed: Dict[str, Any]) -> None:
        category = _sanitize_category(parsed.get("category"))
        title = str(parsed.get("title") or item.title).strip()
        organization = str(parsed.get("organization") or item.company).strip()
        location = str(parsed.get("location") or item.location).strip() or "Abidjan"
        contract = _sanitize_contract(parsed.get("contract_type"))
        description = str(parsed.get("description_markdown") or item.description).strip()

        item.category = category
        item.title = title[:200]
        item.company = organization[:120] or item.company
        item.location = location[:120]
        item.contract_type = contract
        item.description = description[:12000]

        deadline = parsed.get("deadline")
        if deadline and isinstance(deadline, str):
            from datetime import datetime as _dt

            try:
                item.deadline = _dt.fromisoformat(deadline[:10])
            except ValueError:
                pass

    def _apply_heuristics(self, item: ContentItem) -> ContentItem:
        """Classification & normalisation sans IA."""
        item.category = classify_content(item.title, item.description)
        if item.category == "internship":
            item.contract_type = "Stage"
        elif item.category == "scholarship":
            item.contract_type = NEUTRAL_CONTRACT
        elif item.category == "exam":
            item.contract_type = NEUTRAL_CONTRACT
        item.contract_type = item.contract_type_sql()
        return item
