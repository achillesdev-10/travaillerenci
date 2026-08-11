#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/core/exam_parser.py
  Parseur HEURISTIQUE des communiqués de concours ivoiriens (repli sans IA)

  Les communiqués officiels suivent presque toujours la même structure
  rédactionnelle (voir docs/CONCOURS_SOURCES.md, exemples 1 à 4) :

    Ex.1 Administratif   : « [N] concours administratifs sont ouverts dont [x]
                           recrutements nouveaux et [y] promotions. Les
                           inscriptions en ligne débuteront le [d1] pour prendre
                           fin le [d2]. [...] Pour les grades D1 à A3, l'âge
                           maximum est de [x] ans et pour le grade A4, de [y] ans. »
    Ex.2 ENA             : « Les inscriptions [...] se font du [d1] au [d2].
                           Peuvent faire acte de candidature les personnes de
                           nationalité ivoirienne âgées de [min] ans au moins et
                           de [max] ans au plus au 31 décembre [année], titulaires
                           d'un [diplôme]. Les frais d'inscription sont fixés à
                           [montant] Fcfa. »
    Ex.3 Militaire       : « Les inscriptions [...] du [d1] au [d2],
                           exclusivement en ligne sur la plateforme [url]. Ce
                           concours s'adresse aux [...] âgés de [min] à [max] ans
                           au 31 décembre [année] et titulaires du [diplôme]. Les
                           épreuves [...] sont prévues pour le [date]. La visite
                           médicale se fera du [d] au [d]. »
    Ex.4 INFAS/santé     : « La préinscription en ligne se fera du [d1] au [d2]
                           sur [url]. La phase d'inscription se déroulera du [d3]
                           au [d4]. [...] [x] filières sont accessibles aux
                           titulaires du [diplôme A], du [diplôme B] ou du
                           [diplôme C]. »

  Ce parseur extrait les champs structurés sans IA. Gemini (gemini_exams.py)
  reste la voie principale ; ce module sert de filet de sécurité et alimente
  les tests unitaires (scraper/tests/test_exam_parser.py).
===============================================================================
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

FRENCH_MONTHS = {
    "janvier": 1, "février": 2, "fevrier": 2, "mars": 3, "avril": 4,
    "mai": 5, "juin": 6, "juillet": 7, "août": 8, "aout": 8,
    "septembre": 9, "octobre": 10, "novembre": 11, "décembre": 12, "decembre": 12,
}

# Expressions fréquentes de diplômes ivoiriens — ordre décroissant de
# spécificité (les variantes longues d'abord, sinon « BAC » masquerait
# « BACCALAUREAT » et « BTS » masquerait « BTS/DUT »).
_DIPLOMA_PATTERNS = [
    r"BACCALAURÉAT", r"BACCALAUREAT", r"BACC\s*\+\s*\d+", r"BAC\s*\+\s*\d+",
    r"MAÎTRISE", r"MAITRISE", r"PHD", r"PH\.?D",
    r"LICENCE\s+PROFESSIONNELLE", r"LICENCE\s+PRO", r"LICENCE",
    r"DOCTORAT", r"INGÉNIEUR", r"INGENIEUR",
    r"CAP/BEP", r"CAP\s*[12]\b", r"CAP\b", r"BEP\b",
    r"BTS/DUT", r"BTS\b", r"DUT\b", r"DEUG",
    r"BAC", r"BEPC", r"CEPE",
]

_DATE_TOKEN_RE = re.compile(
    r"\b(\d{1,2})\s*(?:er)?\s*(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s*(\d{4})?\b",
    re.I,
)
_DATE_NUM_RE = re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b")


# Noms de fichiers PDF / documents collés comme titres (ex. « communiqué 2026.pdf »).
_FILE_EXT_RE = re.compile(r"\.(pdf|docx?|rtf|odt|txt|xlsx?|pptx?)$", re.I)
# Préfixes génériques qui, SANS sujet, produisent des titres illisibles
# (« Communiqué 2e Étape Direct », « Arrete Ouverture 2027 »…). On ne retire
# PAS le préfixe seul : on normalise l'ensemble (voir clean_exam_title).


def clean_exam_title(title: str) -> str:
    """Normalise un titre de concours brut pour le rendre lisible par un visiteur.

    Corrige notamment :
      • noms de fichiers collés ("communiqué_concours_2026.pdf" → "Communiqué concours 2026") ;
      • extensions traînantes (.pdf, .docx…) ;
      • séparateurs de fichiers (underscores, tirets multiples, parenthèses) ;
      • accent manquant sur la première lettre (« communique » → « Communique »,
        l'IA/la source reste responsable du contenu).

    Ne corrige PAS le fond : un titre vide ou sans sujet reste tel quel (il sera
    traité par la pertinence/la modération).
    """
    from urllib.parse import unquote

    t = (title or "").strip()
    if not t:
        return t
    # URL-décodé (noms de fichiers encodés type %20).
    t = unquote(t)
    # Extension de fichier traînante.
    t = _FILE_EXT_RE.sub(" ", t).strip()
    # Séparateurs de fichiers → espaces (conserve les tirets de mots composés
    # comme « Sous-officier »).
    t = re.sub(r"[_\u00a0]+", " ", t)
    # Tirets longs espacés (« — », « – ») → tiret simple entouré d'espaces.
    t = re.sub(r"\s+[-–—]+\s+", " - ", t)
    # Suites de tirets multiples → un seul ; retire les tirets en bordure.
    t = re.sub(r"[-–—]{2,}", "-", t).strip("-")
    t = re.sub(r"[()\[\]]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    # Première lettre en majuscule (les fichiers sont souvent en minuscules).
    if t:
        t = t[0].upper() + t[1:]
    return t[:200]


def parse_french_date(text: str) -> Optional[datetime]:
    """Parse une date française (« 15 août 2026 », « 15/08/2026 »)."""
    m = _DATE_TOKEN_RE.search(text)
    if m:
        day, month_name, year = int(m.group(1)), FRENCH_MONTHS.get(m.group(2).lower()), m.group(3)
        if month_name and year:
            return datetime(int(year), month_name, day)
    m = _DATE_NUM_RE.search(text)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if year < 100:
            year += 2000
        if 1 <= month <= 12 and 1 <= day <= 31:
            return datetime(year, month, day)
    return None


# Une DATE isolée (française ou numérique) — ancre les bornes des plages.
_DATE_TOKEN = (
    r"\d{1,2}\s*(?:er)?\s*(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s*\d{4}"
    r"|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}"
)
_DATE_PAIR_RE = re.compile(
    rf"(?:du|de|dès|dès le|à partir du|débuteront le|le|jusqu'au)\s+({_DATE_TOKEN})"
    rf"\s+(?:pour prendre fin le|au|à|jusqu'au|jusqu'à)\s+({_DATE_TOKEN})",
    re.I,
)


def _range_dates(text: str) -> List[Tuple[datetime, datetime]]:
    """Toutes les paires de dates « du [d1] au [d2] » / « le [d1] pour prendre fin le [d2] »."""
    pairs: List[Tuple[datetime, datetime]] = []
    for m in _DATE_PAIR_RE.finditer(text):
        d1 = parse_french_date(m.group(1))
        d2 = parse_french_date(m.group(2))
        if d1 and d2 and d1 <= d2:
            pairs.append((d1, d2))
    return pairs


_AGE_BOUNDS_PATTERNS = [
    re.compile(
        r"âg(?:é|ée|és|ées)?s?\s+(?:de|entre)\s+(\d{1,2})\s*ans?\s+(?:au moins|minimum)\s+(?:et\s+de\s+)?(\d{1,2})\s*ans?\s+(?:au plus|maximum)",
        re.I,
    ),
    re.compile(
        r"âg(?:é|ée|és|ées)?s?\s+(?:de|entre)\s+(\d{1,2})\s*ans?\s+(?:à|jusqu'à)\s+(\d{1,2})\s*ans?",
        re.I,
    ),
    re.compile(
        r"âg(?:é|ée|és|ées)?s?\s+(?:de|entre)\s+(\d{1,2})\s+à\s+(\d{1,2})\s*ans?",
        re.I,
    ),
]


def _age_bounds(text: str) -> Tuple[Optional[int], Optional[int]]:
    """Âge min/max : « âgées de X ans au moins et de Y ans au plus » / « X à Y ans »."""
    for pat in _AGE_BOUNDS_PATTERNS:
        m = pat.search(text)
        if m:
            return int(m.group(1)), int(m.group(2))
    return None, None


def _nationality(text: str) -> Optional[str]:
    m = re.search(r"nationalit[ée]\s+(?:de\s+|ivoirienne)", text, re.I)
    if m:
        return "ivoirienne"
    if re.search(r"\bivoiriens?\b|\bivoiriennes?\b", text, re.I):
        return "ivoirienne"
    return None


def _diplomas(text: str) -> List[str]:
    """Diplômes cités dans un communiqué, normalisés vers les valeurs canoniques du filtre front."""
    from scraper.models.exam_item import normalize_diploma

    found: List[str] = []
    for pat in _DIPLOMA_PATTERNS:
        for m in re.finditer(rf"\b{pat}\b", text, re.I):
            norm = normalize_diploma(m.group(0))
            if norm and norm not in found:
                found.append(norm)
    return found


def _registration_fee(text: str) -> Optional[str]:
    m = re.search(
        r"frais d'inscription\s+(?:sont\s+)?fix[ée]s?\s+à\s+([\d\s\u00a0]+)\s*(?:Fcfa|FCFA|francs CFA|francs)",
        text, re.I,
    )
    if m:
        return f"{m.group(1).strip()} FCFA"
    m = re.search(r"(\d[\d\s\u00a0]*)\s*(?:Fcfa|FCFA)\b", text)
    return m.group(1).strip() + " FCFA" if m else None


def _positions_count(text: str) -> Optional[int]:
    m = re.search(r"\b(\d{1,4})\s+(?:postes?\s+(?:à|au|mis au)?\s*(?:concours|ouverts?)|places?\s+offertes)", text, re.I)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d{1,4})\s+concours\s+administratifs\s+sont\s+ouverts", text, re.I)
    if m:
        return int(m.group(1))
    # « [x] filières de formation sont accessibles » (INFAS et autres).
    m = re.search(r"(\d{1,4})\s+fili[èe]res?\s+de\s+formation", text, re.I)
    return int(m.group(1)) if m else None


def _exam_type(text: str) -> Optional[str]:
    # Un communiqué « N concours dont x recrutements nouveaux et y promotions »
    # désigne le type PRINCIPAL par le premier terme cité (recrutement d'abord).
    if re.search(r"recrutement\s+nouveau", text, re.I):
        return "recrutement_nouveau"
    if re.search(r"concours\s+de\s+promotion|promotion", text, re.I):
        return "promotion"
    if re.search(r"concours\s+direct", text, re.I):
        return "concours_direct"
    if re.search(r"concours\s+professionnel", text, re.I):
        return "concours_professionnel"
    if re.search(r"concours\s+d['’]entr[ée]e|concours\s+d'entrée|admission\s+à\s+[^\n]{0,20}?entr[ée]e", text, re.I):
        return "entree_ecole"
    return None


def guess_category(text: str, default: str = "administratif") -> str:
    """Catégorie probable du concours à partir du contexte."""
    t = text.lower()
    if any(k in t for k in ("infas", "infirmier", "infirmière", "sage-femme", "sage femme", "technicien supérieur de santé", "laborantin", "secrétaire médical")):
        return "sante"
    if any(k in t for k in ("cafop", "instituteur", "institutrice", "maître d'école", "enseignant", "professeur des écoles", "dec0", "men-deco")):
        return "enseignement"
    if any(k in t for k in ("gendarmerie", "armée", "armee", "militaire", "zambakro", "ensoa", "sous-officier", "soldat")):
        return "militaire"
    if any(k in t for k in ("police", "douane", "eaux et forêts", "gardien de la paix", "sécurité", "securite")):
        return "securite"
    if any(k in t for k in ("ena ", "fonction publique", "concours administratif", "agent administratif", "guichet unique")):
        return "administratif"
    return default


def _media_visit_dates(text: str) -> Optional[Tuple[datetime, datetime]]:
    """Étape « visite médicale » (souvent distincte des épreuves)."""
    m = re.search(r"visite\s+m[ée]dicale[^.]{0,80}?(?:du|de)\s+([^\n.,;]{2,50}?)\s+(?:au|à)\s+([^\n.,;]{2,50}?)[\.,]", text, re.I)
    if m:
        d1, d2 = parse_french_date(m.group(1)), parse_french_date(m.group(2))
        if d1 and d2:
            return (d1, d2)
    return None


def parse_communique(text: str, default_organizer: str = "", default_category: str = "administratif") -> Dict[str, object]:
    """Extrait les champs structurés d'un communiqué. Ne lève JAMAIS."""
    text_clean = re.sub(r"\s+", " ", text)
    result: Dict[str, object] = {}

    # Dates : priorité à « du X au Y » puis dates isolées.
    ranges = _range_dates(text_clean)
    if ranges:
        result["registration_start"], result["registration_end"] = ranges[0]
    single_dates = [parse_french_date(text_clean)]
    single_dates = [d for d in single_dates if d]
    if not ranges and single_dates:
        result["registration_start"] = single_dates[0]
        result["registration_end"] = single_dates[0]

    # Épreuves / résultats / visite médicale.
    m = re.search(r"(?:épreuves|epreuves)\s+(?:écrites\s+)?(?:sont\s+)?pr[ée]vues?\s+(?:pour\s+le\s+|le\s+)([^\n.,;]{2,50})", text_clean, re.I)
    if m:
        d = parse_french_date(m.group(1))
        if d:
            result["exam_date"] = d
    m = re.search(r"r[ée]sultats\s+(?:seront\s+)?(?:publi[ée]s?|proclam[ée]s?|disponibles)?\s*(?:le\s+|pour\s+le\s+)?([^\n.,;]{2,50})", text_clean, re.I)
    if m and "résultats" in m.group(0).lower():
        d = parse_french_date(m.group(1))
        if d:
            result["results_date"] = d
    visit = _media_visit_dates(text_clean)
    if visit:
        result["_visit_medicale"] = visit  # conservé pour la description réécrite

    # Âge, nationalité, diplômes, frais, postes, type.
    age_min, age_max = _age_bounds(text_clean)
    if age_min is not None:
        result["age_min"] = age_min
    if age_max is not None:
        result["age_max"] = age_max
    m = re.search(r"au\s+31\s+d[ée]cembre\s+(\d{4})", text_clean, re.I)
    if m:
        result["age_reference_date"] = f"au 31 décembre {m.group(1)}"
    nat = _nationality(text_clean)
    if nat:
        result["nationality"] = nat
    diplomas = _diplomas(text_clean)
    if diplomas:
        result["diplomas"] = diplomas
    fee = _registration_fee(text_clean)
    if fee:
        result["registration_fee"] = fee
    count = _positions_count(text_clean)
    if count:
        result["positions_count"] = count
    etype = _exam_type(text_clean)
    if etype:
        result["exam_type"] = etype

    # Plateforme d'inscription (URL) — à stocker dans la description réécrite.
    m = re.search(r"(https?://[^\s)\"']+)", text_clean)
    if m:
        result["_inscription_platform"] = m.group(1)

    result["category"] = guess_category(text_clean, default_category)
    if default_organizer:
        result["organizer"] = default_organizer
    return result


def confidence_from_gaps(fields: Dict[str, object]) -> str:
    """Confiance heuristique : peu de champs extraits → relecture prioritaire."""
    filled = sum(1 for k, v in fields.items() if v not in (None, "", [], {}))
    if filled >= 6:
        return "high"
    if filled >= 3:
        return "medium"
    return "low"
