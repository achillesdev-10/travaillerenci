#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/core/base_scraper.py
  Classe de base abstraite pour tous les scrapers
===============================================================================
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
import json
import re
from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

from scraper.models.content_item import ContentItem
from scraper.core.http_client import HttpClient
from scraper.core.logger import setup_logger
from scraper.core.utils import (
    clean_html_text,
    extract_contract,
    extract_deadline,
    extract_emails,
    extract_education,
    guess_company,
    normalize_location,
)


class BaseScraper(ABC):
    name: str = "base"
    base_url: str = "https://example.com"

    def __init__(self, http_client: HttpClient):
        self.http_client = http_client
        self.logger = setup_logger(f"scraper.{self.name}")

    @abstractmethod
    def scrape(self, max_offers: int = 20) -> List[ContentItem]:
        pass

    def get_soup(self, url: str) -> BeautifulSoup | None:
        """Télécharge une page et la parse en BeautifulSoup (None en cas d'erreur)."""
        try:
            resp = self.http_client.get(url)
            return BeautifulSoup(resp.text, "lxml")
        except Exception as exc:
            self.logger.warning(f"Impossible de joindre {url}: {exc}")
            return None

    def get_text(self, url: str) -> Optional[str]:
        """Télécharge une page et retourne son texte brut (None en cas d'erreur)."""
        try:
            resp = self.http_client.get(url)
            return resp.text
        except Exception as exc:
            self.logger.warning(f"Impossible de joindre {url}: {exc}")
            return None

    # ------------------------------------------------------------------
    # Helpers d'extraction (partagés par tous les scrapers)
    # ------------------------------------------------------------------
    def guess_contract(self, text: str) -> str:
        return extract_contract(text)

    def guess_education(self, text: str) -> Optional[str]:
        return extract_education(text)

    def guess_location(self, text: str) -> str:
        return normalize_location(text)

    def guess_company(self, text: str, default: str = "Entreprise") -> str:
        return guess_company(text, default)

    def extract_deadline(self, text: str) -> Optional[datetime]:
        return extract_deadline(text)

    def extract_emails(self, text: str) -> List[str]:
        return extract_emails(text)

    def clean_html(self, html: str) -> str:
        return clean_html_text(html)

    # ------------------------------------------------------------------
    # Extraction de métadonnées structurées (fallback robuste)
    # ------------------------------------------------------------------
    def extract_meta_tag(self, soup: BeautifulSoup, *, property: Optional[str] = None,
                         name: Optional[str] = None) -> str:
        """Récupère le contenu d'une balise <meta property="…"> ou <meta name="…">."""
        try:
            if property:
                tag = soup.find("meta", attrs={"property": property})
            else:
                tag = soup.find("meta", attrs={"name": name})
            return (tag.get("content", "") if tag else "").strip()
        except Exception:
            return ""

    def extract_jsonld(self, soup: BeautifulSoup, *, type_contains: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Extrait le premier bloc JSON-LD <script type="application/ld+json"> de la page.

        Si `type_contains` est fourni, filtre pour ne garder que le(s) bloc(s) dont
        `@type` contient cette sous-chaîne (case-insensitive). Utile pour ne récupérer
        qu'un JobPosting sur une page qui en déclare plusieurs.
        """
        try:
            scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
            for script in scripts:
                raw = script.string or ""
                if not raw:
                    continue
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                # Certains sites mettent un tableau dans le JSON-LD
                items: List[Any] = data if isinstance(data, list) else [data]
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    t = item.get("@type") or ""
                    if isinstance(t, list):
                        t = " ".join(str(x) for x in t)
                    t_low = str(t).lower()
                    if type_contains and type_contains.lower() not in t_low:
                        continue
                    return item
            return None
        except Exception:
            return None

    @staticmethod
    def extract_salary(text: str) -> Optional[str]:
        """Extrait une mention de salaire si présente dans le texte.

        Patterns : « Salaire : 500 000 FCFA », « Rémunération : 450k € »,
        « 3000 € brut / mois », « entre 400 et 600 K€ », etc.
        """
        if not text:
            return None
        patterns = [
            r"(?:salaire|rémunération|rémunération brute|revenu|paie|gains?)\s*[:=]\s*([^\n\r]{3,60}?(?:€|fcfa|usd|\$|k|k€|dollars?|euros?)[^\n\r]{0,40})",
            r"([0-9][0-9\s\.]{0,15}\s*(?:€|fcfa|usd|\$|k|k€|dollars?|euros?)\s*(?:brut|net|par mois|/mois|mensuel|annuel|par an)?)",
            r"(?:entre\s+)?([0-9][0-9\s\.]{0,10}\s*(?:€|fcfa|usd|\$|k)\s*(?:à|-|et)\s*[0-9][0-9\s\.]{0,10}\s*(?:€|fcfa|usd|\$|k))",
        ]
        for pat in patterns:
            m = re.search(pat, text, re.I)
            if m:
                val = m.group(1).strip().rstrip(".,;:- ")
                if 5 <= len(val) <= 80:
                    return val
        return None
