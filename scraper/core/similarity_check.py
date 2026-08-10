#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/core/similarity_check.py
  Contrôle anti-duplication (PARTIE 2 — §2.6 Contraintes de contenu)

  Objectif : garantir que la description Markdown réécrite par Gemini est
  bien UNIQUE et reformulée, jamais un copier-coller de la source officielle
  (risque de pénalité Google pour contenu dupliqué).

  Méthode :
    1. Normalisation : minuscules, accents supprimés, ponctuation/Markdown
       retirés, espaces uniformisés.
    2. Deux mesures complémentaires, on conserve le MAX :
       • ratio de séquence (difflib.SequenceMatcher sur les tokens) — détecte
         les copier-coller et reformulations trop fidèles ;
       • indice de Jaccard sur les n-grams de 4 tokens — robuste aux
         changements d'ordre des phrases.

  Seuil par défaut : 30 % (SIMILARITY_THRESHOLD). Au-dessus → la fiche est
  marquée `confidence='low'` et signalée à la modération manuelle pour
  réécriture (jamais publiée automatiquement : tout passe par /admin/exams).

  Usage :  from scraper.core.similarity_check import text_similarity
===============================================================================
"""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher

# Seuil de similarité au-delà duquel une fiche doit être réécrite (30 %).
SIMILARITY_THRESHOLD = 0.30

# Caractères "bruit" (Markdown, ponctuation, séparateurs).
_NOISE_RE = re.compile(r"[*#_`>\[\](){}|!?.,;:'\"«»<>/\\\n\r\t—–…·•]+")


def normalize(text: str) -> str:
    """Normalise un texte pour comparaison : minuscules, sans accents ni bruit."""
    if not text:
        return ""
    # Décomposition Unicode + suppression des accents.
    decomposed = unicodedata.normalize("NFD", text)
    no_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    cleaned = _NOISE_RE.sub(" ", no_accents)
    return re.sub(r"\s+", " ", cleaned).strip().lower()


def _ngrams(tokens: list[str], n: int = 4) -> set[str]:
    """n-grams de tokens (défaut 4, pour être insensible à l'ordre local)."""
    if len(tokens) < n:
        return {" ".join(tokens)}
    return {" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1)}


def text_similarity(source: str, rewritten: str) -> float:
    """Similarité 0..1 entre le texte source et la réécriture (max des mesures).

    ~1.0  → copie quasi intégrale (à réécrire impérativement)
    >0.30 → au-delà du seuil : signaler à la modération
    <0.30 → reformulation satisfaisante

    Métriques combinées (max) : ratio de séquence LCS, Jaccard symétrique sur
    n-grams, et couverture (n-grams de la réécriture présents dans la source).
    """
    tokens_a = normalize(source).split()
    tokens_b = normalize(rewritten).split()
    if not tokens_a or not tokens_b:
        return 0.0

    # Mesure 1 : ratio de séquence (copier-coller / reformulation légère).
    sequence_ratio = SequenceMatcher(None, tokens_a, tokens_b).ratio()

    # Mesure 2 : Jaccard sur n-grams de 4 tokens (ordre des phrases modifié).
    source_grams = _ngrams(tokens_a)
    rewrite_grams = _ngrams(tokens_b)
    union = source_grams | rewrite_grams
    jaccard = len(source_grams & rewrite_grams) / len(union) if union else 0.0

    # Mesure 3 : COUVERTURE (directionnelle) — part des n-grams de la
    # RÉÉCRITURE présents dans la source. Pertinente quand la source (page
    # complète) est bien plus longue que la description : une copie partielle
    # reste détectée.
    coverage = (
        len(source_grams & rewrite_grams) / len(rewrite_grams)
        if rewrite_grams
        else 0.0
    )

    return max(sequence_ratio, jaccard, coverage)


def needs_rewrite(source: str, rewritten: str, threshold: float = SIMILARITY_THRESHOLD) -> bool:
    """True si la réécriture est trop proche de la source (copie)."""
    return text_similarity(source, rewritten) > threshold


# -----------------------------------------------------------------------------
# Déduplication inter-sources par TITRE (--merge-duplicates / upsert)
# -----------------------------------------------------------------------------
# Deux sources collectent parfois la même annonce avec des intitulés quasi
# identiques (« CONCOURS ADMINISTRATIFS 2026 » sur ENA et GUCACI,
# « Communiqu resultats d admission pro » vs « Resultats d'admission pro »).
# Seuil calibré sur les données réelles : les vrais doublons atteignent 1.00
# (titres normalisés égaux ou sous-ensembles), les concours distincts restent
# sous 0.85 (ex. calendrier CEPE vs BEPC = 0.82). 0.88 laisse une marge de
# sécurité : mieux vaut rater une fusion que corrompre deux fiches distinctes.
#
# Risque résiduel connu : la métrique `coverage` de text_similarity vaut 1.0
# pour tout titre SOUS-ENSEMBLE d'un autre — deux concours distincts dont l'un
# serait inclus dans l'autre (ex. « CONCOURS ENA 2026 » vs « CONCOURS ENA
# 2026 — cycle supérieur ») seraient détectés comme doublons. Le seuil et la
# calibration sur les données réelles (faux positifs max observés : 0.82)
# limitent ce risque ; à surveiller si de tels intitulés apparaissent.
TITLE_DUPLICATE_THRESHOLD = 0.88


def is_duplicate_title(
    a: str | None,
    b: str | None,
    threshold: float = TITLE_DUPLICATE_THRESHOLD,
) -> bool:
    """Vrai si deux titres désignent très probablement le même concours :
    titres normalisés (casse/accents) identiques, ou similarité ≥ seuil
    (un titre sous-ensemble de l'autre → coverage 1.0 → doublon détecté)."""
    na, nb = normalize(a or ""), normalize(b or "")
    if not na or not nb:
        return False
    if na == nb:
        return True
    return text_similarity(na, nb) >= threshold


def find_duplicate_groups(
    rows: list[dict],
    title_key: str = "title",
    threshold: float = TITLE_DUPLICATE_THRESHOLD,
) -> list[list[dict]]:
    """Regroupe les lignes (dict) dont les titres sont quasi identiques.

    Union-find simple : deux lignes appartiennent au même groupe si
    `is_duplicate_title` les relie (directement ou par transitivité).
    Ne retourne que les groupes de taille > 1, ordre d'apparition conservé.
    """
    n = len(rows)
    if n < 2:
        return []

    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x: int, y: int) -> None:
        rx, ry = find(x), find(y)
        if rx != ry:
            parent[ry] = rx

    for i in range(n):
        for j in range(i + 1, n):
            if is_duplicate_title(rows[i].get(title_key), rows[j].get(title_key), threshold):
                union(i, j)

    groups: dict[int, list[dict]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(rows[i])
    return [g for g in groups.values() if len(g) > 1]
