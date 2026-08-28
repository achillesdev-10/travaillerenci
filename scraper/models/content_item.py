#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/models/content_item.py
  Modèle UNIFIÉ de contenu scrapé (emploi / stage / bourse / concours)

  Un seul modèle alimente toute la chaîne :
      scraper → nettoyage → IA (Gemini) → classification → modération admin

  La colonne `category` discrimine le type de contenu :
      - job         : offre d'emploi (CDI, CDD, …)
      - internship  : stage / alternance
      - scholarship : bourse d'études
      - exam        : concours administratif / examen d'entrée / recrutement
===============================================================================
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field
from slugify import slugify

# -----------------------------------------------------------------------------
# Constantes partagées
# -----------------------------------------------------------------------------
CONTENT_CATEGORIES = ("job", "internship", "scholarship", "exam")

# Valeurs autorisées par la contrainte SQL `valid_contract_type`.
SQL_CONTRACT_TYPES = ("CDI", "CDD", "Stage", "Prestation", "Alternance", "Freelance")

# Catégories pour lesquelles le « type de contrat » n'a pas de sens métier.
# On stocke une valeur neutre (jamais affichée publiquement pour ces types).
NEUTRAL_CONTRACT = "CDI"


class ContentItem(BaseModel):
    id: Optional[str] = None
    category: str = "job"  # job | internship | scholarship | exam
    title: str = Field(..., min_length=2)
    company: str = Field(..., min_length=2)  # entreprise / organisme / bailleur
    location: str = "Abidjan"
    contract_type: str = NEUTRAL_CONTRACT
    description: str = Field(..., min_length=10)
    deadline: Optional[datetime] = None
    application_url: Optional[str] = None
    application_email: Optional[str] = None
    source: str = "web"  # nom du site source (ex. Educarriere.ci)
    source_url: str
    status: str = "pending"  # pending, published, rejected, archived
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None
    slug: Optional[str] = None
    scraped_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    # ------------------------------------------------------------------
    # Utilitaires
    # ------------------------------------------------------------------
    def dedup_key(self) -> str:
        """Clé de déduplication (titre + organisme + lieu)."""
        parts = [
            slugify(self.title, separator="-"),
            slugify(self.company or "inconnu", separator="-"),
            slugify(self.location or "abidjan", separator="-"),
        ]
        return "|".join(p for p in parts if p)

    def contract_type_sql(self) -> str:
        """Garantit une valeur acceptée par la contrainte SQL
        `valid_contract_type`. Les bourses / concours n'ont pas de « type de
        contrat » : on stocke une valeur neutre jamais affichée pour eux."""
        if self.contract_type in SQL_CONTRACT_TYPES:
            return self.contract_type
        if self.category == "internship":
            return "Stage"
        return NEUTRAL_CONTRACT

    def category_sql(self) -> str:
        if self.category not in CONTENT_CATEGORIES:
            return "job"
        return self.category

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------
    def is_valid(self) -> tuple[bool, str]:
        """Validation « qualité » : applicable à toutes les catégories."""
        if not self.title or len(self.title.strip()) < 3:
            return False, "titre trop court"
        if not self.company or len(self.company.strip()) < 2:
            return False, "organisme absent"
        if not self.description or len(self.description.strip()) < 25:
            return False, "description trop courte"
        if not self.source_url:
            return False, "source_url obligatoire"
        return True, "ok"

    def needs_review(self) -> tuple[bool, str]:
        """Vérifie les problèmes de qualité qui nécessitent une revue admin.

        Contrairement à is_valid() qui rejette purement, needs_review()
        identifie les contenus qui doivent être en statut 'pending' pour
        révision (plutôt que publiés automatiquement).
        """
        if not self.title or len(self.title.strip()) < 10:
            return True, "titre trop court pour publication automatique"
        if not self.description or len(self.description.strip()) < 50:
            return True, "description trop courte pour publication automatique"
        # Ville non reconnue (défaut "Abidjan" maispas de mention explicite)
        if self.category in ('job', 'internship') and self.location == 'Abidjan':
            corpus = f"{self.title} {self.description}".lower()
            if 'abidjan' not in corpus:
                return True, "ville non vérifiée dans le contenu"
        return False, "ok"

    def is_valid_ivorian(self) -> tuple[bool, str]:
        """Validation géographique ivoirienne — réservée aux emplois & stages.

        Les bourses d'études (souvent internationales) et les concours ne sont
        PAS soumis à ce filtre : ils restent pertinents pour les Ivoiriens."""
        if self.category in ("scholarship", "exam"):
            return True, "ok (hors filtre géographique volontairement)"

        _ivorian_keywords = [
            "côte d'ivoire", "cote d'ivoire", "ivory coast", "abidjan", "yamoussoukro",
            "bouaké", "san-pedro", "san pedro", "daloa", "korhogo", "man", "gagnoa",
            "abobo", "cocody", "plateau", "treichville", "port-bouët", "port bouet",
            "koumassi", "adjamé", "yopougon", "marcory", "anyama", "bingerville",
        ]
        # NB : le domaine « .ci » (source ivoirienne vérifiée) est vérifié
        # SÉPARÉMENT ci-dessous sur l'URL brute : normalisé en « ci », ce mot
        # clé matcherait presque tout texte français et rendrait le filtre
        # inopérant.
        normalized_keywords = [re.sub(r"[^a-z0-9à-ÿ]+", "", kw) for kw in _ivorian_keywords]
        corpus = f"{self.title} {self.location} {self.description}".lower()
        corpus = re.sub(r"[^a-z0-9à-ÿ]+", "", corpus)
        source_low = (self.source_url or "").lower()
        if any(kw and kw in corpus for kw in normalized_keywords):
            return True, "ok"
        if ".ci" in source_low:
            return True, "ok (site source .ci)"
        return False, "hors ciblage géographique ivoirien"
