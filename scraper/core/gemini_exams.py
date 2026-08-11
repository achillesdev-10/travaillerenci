#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/core/gemini_exams.py
  Enrichissement IA (Gemini) des communiqués de concours administratifs

  Pour chaque communiqué officiel, on demande à Gemini (gemini-2.0-flash) :
    1. une REFORMULATION Markdown à 100% (jamais de copier-coller, même depuis
       une source officielle) — fidèle aux faits, sans invention ;
    2. une extraction STRUCTURÉE des champs du schéma `exams` ;
    3. une valeur `null` EXPLICITE quand une information n'est pas présente
       (jamais de valeur inventée) ;
    4. un niveau de `confidence` (low/medium/high) pour prioriser la relecture
       manuelle en modération.

  Le prompt est calibré sur les 4 structures rédactionnelles types des
  communiqués ivoiriens (voir docs/CONCOURS_SOURCES.md, exemples 1 à 4).

  Robustesse : en l'absence de clé GEMINI_API_KEY ou si la réponse est
  invalide, on retombe sur le parseur heuristique local (exam_parser.py) pour
  ne JAMAIS faire échouer le pipeline.
===============================================================================
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Dict, Optional

import httpx

from scraper.models.exam_item import ExamItem, normalize_diplomas
from scraper.core.exam_parser import confidence_from_gaps, parse_communique
from scraper.core.logger import setup_logger

logger = setup_logger("gemini_exams")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

SYSTEM_PROMPT = """\
Tu es un rédacteur expert des concours administratifs en Côte d'Ivoire \
(ENA, INFAS, CAFOP, gendarmerie, fonction publique…). À partir d'un communiqué \
officiel brut, tu dois le réécrire et en extraire les champs structurés.

RÈGLE DE PERTINENCE — AVANT TOUTE EXTRACTION :
- Décide d'abord si la page décrit un CONCOURS CONCRET ET ACTIONNABLE : une
  annonce officielle (ouverture / inscriptions / épreuves / résultats liés à un
  concours précis) avec des informations exploitables pour un candidat
  (dates, diplômes, âge, nationalité, frais, nombre de postes, documents).
- REJETTE (is_concours=false) les pages qui ne sont PAS une telle annonce :
  titres de MENU ou de RUBRIQUE (« Communiqués », « Actualités », « Actu … »,
  « Archives (des communiqués) », « Note aux usagers », « À l'attention de … »,
  « Guide d'inscription », « Comment s'inscrire », « Résultats » seul…),
  pages d'accueil de section, pages institutionnelles génériques (nom de
  l'école seul, sans annonce), pages d'erreur, ou tout contenu sans rapport
  avec une annonce de concours précise.
- Un « communiqué » SANS annonce précise n'est pas un concours : une page qui
  ne mentionne ni dates, ni diplômes, ni conditions d'éligibilité est un
  contenu inexploitable pour le candidat. Rejette-la (is_concours=false), même
  si le titre contient le mot « communiqué » ou le nom d'une école.
- Si is_concours=false : remplis is_concours=false, rejection_reason avec une
  phrase courte justifiant le rejet, et null pour TOUS les autres champs.

RÈGLES STRICTES (quand is_concours=true) :
- REFORMULATION À 100% : réécris le communiqué dans tes propres mots, en Markdown \
structuré. JAMAIS de copier-coller, même depuis une source officielle.
- CONCISION : la description doit tenir en 2 à 4 paragraphes courts, \
compréhensible en un coup d'œil (quoi, quand, pour qui, comment). Si la source \
est plus longue, SYNTHÉTISE. Une description qui recopie la source mot pour mot \
est un échec : reformule.
- DATES CLÉS UNIQUEMENT : ne renseigne registration_start, registration_end, \
exam_date ou results_date qu'avec des dates de PHASES DU CONCOURS (ouverture / \
fermeture des inscriptions, épreuves, résultats). La date de publication ou de \
mise à jour de la page n'est JAMAIS une date clé : mets null.
- Ne garde QUE les informations présentes dans le communiqué : n'invente JAMAIS \
de date, d'âge, de diplôme, de montant, de site ou de coordonnées.
- Si une information n'est PAS présente dans le communiqué, mets null (jamais une \
valeur inventée).
- Retire tout le bruit : navigation, publicités, pieds de page, autres annonces.
- Convertis les listes en puces « - ». Français correct, phrases concises.
- Réponds UNIQUEMENT au format JSON valide, sans aucun texte autour.
"""

# Les 4 structures types servent de calibration au modèle.
_COMMUNIQUE_EXAMPLES = """\
STRUCTURES TYPES DES COMMUNIQUÉS IVOIRIENS (pour repérer les champs) :
1) Administratif : « [N] concours administratifs sont ouverts dont [x] concours de \
recrutement nouveau et [y] concours de promotion. Les inscriptions en ligne \
débuteront le [date début] pour prendre fin le [date fin]. Pour les concours \
donnant accès aux emplois de grades D1 à A3, l'âge maximum est de [x] ans et pour \
les concours donnant accès au grade A4, l'âge maximum est de [y] ans. »
   → catégorie=administratif, exam_type=recrutement_nouveau OU promotion.

2) ENA : « Les inscriptions [...] se font du [date début] au [date fin]. Peuvent \
faire acte de candidature les personnes de nationalité ivoirienne âgées de [min] \
ans au moins et de [max] ans au plus au 31 décembre [année], et titulaires d'un \
[diplôme requis]. Les inscriptions se font en ligne sur les sites [urls]. Les \
frais d'inscription sont fixés à [montant] Fcfa. »
   → champs : registration_start, registration_end, age_min, age_max, \
age_reference_date (« au 31 décembre N »), nationality, diplomas, \
registration_fee, et les URLs dans description_md.

3) Militaire/gendarmerie : « Les inscriptions [...] se dérouleront du [date début] \
au [date fin], exclusivement en ligne sur la plateforme [url]. Ce concours \
s'adresse aux [jeunes ivoiriens] âgés de [min] à [max] ans au 31 décembre [année] \
et titulaires du [diplôme] ou d'un diplôme équivalent. Les épreuves [...] sont \
prévues pour le [date épreuve]. La visite médicale se fera du [date] au [date]. »
   → catégorie=militaire OU securite, exam_date = date des épreuves, et la \
visite médicale est DÉCRITE dans description_md (pas de champ dédié).

4) INFAS/santé : « Les candidats pourront effectuer leur préinscription en ligne \
à partir du [date] jusqu'au [date] sur le site officiel [url]. La phase \
d'inscription se déroulera du [date] au [date]. Des inscriptions délocalisées \
sont prévues du [date] au [date] dans plusieurs villes : [liste]. [x] filières \
de formation sont accessibles aux titulaires du [diplôme A], du [diplôme B] ou \
du [diplôme C] selon les spécialités. »
   → catégorie=sante. IMPORTANT : si plusieurs filières avec diplômes différents, \
prévois UNE entrée par filière (titre + diplomas de la filière) — le prompt \
appelant traitera chaque filière séparément.
"""

_SCHEMA = """\
SCHÉMA JSON ATTENDU (toutes les clés sont obligatoires, valeurs null si absentes) :
{
  "is_concours": "true | false — la page décrit-elle une annonce de concours concrète et actionnable ? (voir RÈGLE DE PERTINENCE)",
  "rejection_reason": "phrase courte si is_concours=false, sinon null",
  "title": "intitulé normalisé du concours (court, sans le nom du site)",
  "organizer": "organisateur (ministère / institut / école)",
  "category": "administratif | sante | enseignement | securite | militaire | autre",
  "exam_type": "recrutement_nouveau | promotion | concours_direct | concours_professionnel | entree_ecole | examen | null",
  "description_md": "description réécrite à 100% en Markdown structuré (voir règles)",
  "registration_start": "YYYY-MM-DD ou null",
  "registration_end": "YYYY-MM-DD ou null",
  "exam_date": "YYYY-MM-DD ou null",
  "results_date": "YYYY-MM-DD ou null",
  "age_min": "entier ou null",
  "age_max": "entier ou null",
  "age_reference_date": "texte type 'au 31 décembre 2026' ou null",
  "nationality": "texte ou null",
  "diplomas": ["CEPE", "BEPC", "BAC", "LICENCE", "MASTER", ...] (liste, vide si absent),
  "positions_count": "entier ou null",
  "registration_fee": "texte type '10 000 FCFA' ou null",
  "location": "ville ou null",
  "cities": ["ville1", "ville2"] (liste, vide si absent),
  "documents": [{"name": "intitulé du document", "url": "lien PDF"}],
  "confidence": "low | medium | high (fiabilité de l'extraction)",
  "seo_description": "description 155 caractères max pour Google/WhatsApp"
}
"""


def _strip_markdown_code_fences(raw: str) -> str:
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


class ExamGeminiEnricher:
    """Enrichit un ExamItem brut via Gemini (repli heuristique garanti)."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model or GEMINI_MODEL
        self.enabled = bool(self.api_key)
        self.session = httpx.Client(timeout=60, follow_redirects=True)
        if self.enabled:
            logger.info(f"🤖 Enrichissement concours IA activé (modèle {self.model})")
        else:
            logger.warning("⚠️ GEMINI_API_KEY absente — extraction heuristique des concours.")

    def close(self) -> None:
        try:
            self.session.close()
        except Exception:
            pass

    # ------------------------------------------------------------------
    def enrich(self, item: ExamItem) -> ExamItem:
        """Réécrit + extrait les champs. Ne lève JAMAIS : fallback heuristique."""
        if not self.enabled:
            return self._apply_heuristics(item)
        try:
            raw = self._call_gemini(self._build_prompt(item))
            parsed = self._parse_json(raw)
            self._apply_ai(item, parsed)
        except Exception as exc:
            logger.debug(f"Fallback heuristique pour « {item.title[:50]} » : {exc}")
            self._apply_heuristics(item)
        return item

    # ------------------------------------------------------------------
    def _build_prompt(self, item: ExamItem) -> str:
        return (
            f"{SYSTEM_PROMPT}\n\n"
            f"{_COMMUNIQUE_EXAMPLES}\n\n"
            f"{_SCHEMA}\n\n"
            "--- Communiqué brut à traiter ---\n"
            f"Source : {item.source_url}\n"
            f"Organisateur connu (à conserver si cohérent) : {item.organizer}\n\n"
            f"{item.description_md[:9000]}\n\n"
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
                "temperature": 0.2,
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
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
        raise ValueError("JSON IA illisible")

    # ------------------------------------------------------------------
    def _apply_ai(self, item: ExamItem, parsed: Dict[str, Any]) -> None:
        # Rejet explicite : la page ne décrit pas un concours exploitable
        # (menu, rubrique, accueil de section…). On marque la fiche et on ne
        # touche à aucun autre champ — le runner l'écartera.
        is_concours = parsed.get("is_concours")
        if isinstance(is_concours, str):
            is_concours = is_concours.strip().lower() in ("true", "1", "oui", "yes")
        if is_concours is False:
            item.rejected = True
            item.rejection_reason = (
                str(parsed.get("rejection_reason") or "page jugée hors-sujet par l'IA")[:200]
            )
            return

        def _date(value: Any):
            if not value or not isinstance(value, str):
                return None
            try:
                return datetime.fromisoformat(value[:10])
            except ValueError:
                return None

        from datetime import datetime

        title = str(parsed.get("title") or item.title).strip()
        organizer = str(parsed.get("organizer") or item.organizer).strip()
        description = str(parsed.get("description_md") or item.description_md).strip()

        diplomas = parsed.get("diplomas")
        if isinstance(diplomas, str):
            diplomas = [d.strip().upper() for d in diplomas.split(",") if d.strip()]
        elif isinstance(diplomas, list):
            diplomas = [str(d).strip().upper() for d in diplomas if str(d).strip()]
        else:
            diplomas = item.diplomas
        # Normalisation vers les valeurs canoniques du filtre front (BAC+3 → BAC…).
        diplomas = normalize_diplomas(diplomas)

        cities = parsed.get("cities")
        if isinstance(cities, str):
            cities = [c.strip() for c in cities.split(",") if c.strip()]
        elif not isinstance(cities, list):
            cities = item.cities

        documents = parsed.get("documents")
        if not isinstance(documents, list):
            documents = item.documents
        documents = [
            d for d in documents
            if isinstance(d, dict) and d.get("name") and d.get("url")
        ]

        confidence = str(parsed.get("confidence") or "medium").lower()
        if confidence not in ("low", "medium", "high"):
            confidence = "medium"

        item.title = title[:200]
        item.organizer = organizer[:160] or item.organizer
        item.description_md = description[:20000]
        item.category = str(parsed.get("category") or item.category).lower()
        item.exam_type = parsed.get("exam_type") or None
        item.registration_start = _date(parsed.get("registration_start"))
        item.registration_end = _date(parsed.get("registration_end"))
        item.exam_date = _date(parsed.get("exam_date"))
        item.results_date = _date(parsed.get("results_date"))
        item.age_min = parsed.get("age_min") if isinstance(parsed.get("age_min"), int) else None
        item.age_max = parsed.get("age_max") if isinstance(parsed.get("age_max"), int) else None
        item.age_reference_date = parsed.get("age_reference_date") or None
        item.nationality = parsed.get("nationality") or None
        item.diplomas = diplomas
        item.positions_count = parsed.get("positions_count") if isinstance(parsed.get("positions_count"), int) else None
        item.registration_fee = parsed.get("registration_fee") or None
        item.location = parsed.get("location") or None
        item.cities = cities
        item.documents = documents
        item.confidence = confidence
        item.seo_description = (
            str(parsed.get("seo_description") or "")[:160] or None
        )
        item.seo_title = f"{item.title} | TravaillerEnCi"
        # Recalcule le niveau minimal.
        from scraper.models.exam_item import compute_min_diploma_level

        item.min_diploma_level = compute_min_diploma_level(item.diplomas)

    # ------------------------------------------------------------------
    def _apply_heuristics(self, item: ExamItem) -> ExamItem:
        """Extraction locale sans IA (exam_parser.py)."""
        fields = parse_communique(
            item.description_md,
            default_organizer=item.organizer,
            default_category=item.category,
        )
        if fields.get("category"):
            item.category = str(fields["category"])
        if fields.get("exam_type"):
            item.exam_type = str(fields["exam_type"])
        if fields.get("registration_start"):
            item.registration_start = fields["registration_start"]  # type: ignore[assignment]
        if fields.get("registration_end"):
            item.registration_end = fields["registration_end"]  # type: ignore[assignment]
        if fields.get("exam_date"):
            item.exam_date = fields["exam_date"]  # type: ignore[assignment]
        if fields.get("results_date"):
            item.results_date = fields["results_date"]  # type: ignore[assignment]
        if fields.get("age_min"):
            item.age_min = int(fields["age_min"])
        if fields.get("age_max"):
            item.age_max = int(fields["age_max"])
        if fields.get("age_reference_date"):
            item.age_reference_date = str(fields["age_reference_date"])
        if fields.get("nationality"):
            item.nationality = str(fields["nationality"])
        if fields.get("diplomas"):
            item.diplomas = normalize_diplomas([str(d) for d in fields["diplomas"]])  # type: ignore[union-attr]
        if fields.get("registration_fee"):
            item.registration_fee = str(fields["registration_fee"])
        if fields.get("positions_count"):
            item.positions_count = int(fields["positions_count"])
        item.confidence = confidence_from_gaps(fields)
        item.seo_title = f"{item.title} | TravaillerEnCi"
        item.seo_description = (
            f"Concours : {item.title} — {item.organizer}. "
            "Dates, conditions d'éligibilité et lien officiel sur TravaillerEnCi."
        )[:160]
        from scraper.models.exam_item import compute_min_diploma_level

        item.min_diploma_level = compute_min_diploma_level(item.diplomas)
        return item
