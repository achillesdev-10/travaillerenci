#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/scrapers/educarriere.py
  Scraper Educarriere.ci — Emplois & Stages (Côte d'Ivoire)

  Source : https://emploi.educarriere.ci  (VÉRIFIÉ — fonctionne en HTTP simple)

  Le site liste les annonces sous la forme :
      https://emploi.educarriere.ci/offre-{id}-{slug}.html

  La catégorie finale (job / internship / scholarship / exam) est décidée par
  l'enrichisseur IA (Gemini), avec repli heuristique local.
===============================================================================
"""

from __future__ import annotations

import re
from typing import List
from urllib.parse import urljoin

from scraper.core.base_scraper import BaseScraper
from scraper.models.content_item import ContentItem
from scraper.core.utils import clean_html_text, extract_emails

_ANNOUNCE_RE = re.compile(r"/offre-\d+", re.I)

_SECTION_HINT = re.compile(r"d[ée]tails de l'offre", re.I)


class EducarriereScraper(BaseScraper):
    name = "educarriere"
    base_url = "https://emploi.educarriere.ci"
    source_label = "Educarriere.ci"

    def scrape(self, max_offers: int = 20) -> List[ContentItem]:
        self.logger.info(f"Scraping {self.name} -> {self.base_url}")
        items: List[ContentItem] = []
        links: set[str] = set()

        # 1. Collecte des liens d'annonces (accueil + page « Toutes les offres »)
        for seed in (self.base_url, f"{self.base_url}/page/all"):
            soup = self.get_soup(seed)
            if soup is None:
                continue
            for a in soup.select("a[href]"):
                href = a.get("href", "")
                full = urljoin(seed, href)
                if _ANNOUNCE_RE.search(full.lower()):
                    links.add(full)
            self.logger.info(f"  [seed {seed}] {len(links)} liens d'annonces cumulés")

        for link in list(links)[: max_offers * 2]:
            if len(items) >= max_offers:
                break
            try:
                soup = self.get_soup(link)
                if soup is None:
                    continue

                h1 = soup.find("h1")
                title = h1.get_text(" ", strip=True) if h1 else ""
                if not title or len(title) < 5:
                    # Fallback 1 : og:title
                    og = soup.find("meta", property="og:title")
                    title = og.get("content", "").strip() if og else ""
                if not title or len(title) < 5:
                    # Fallback 2 : premier h2 non-navigation
                    for h2 in soup.find_all("h2"):
                        candidate = h2.get_text(" ", strip=True)
                        if len(candidate) > 8 and not re.match(r"^(autres|recherche|offres|postuler)", candidate, re.I):
                            title = candidate
                            break
                if not title or len(title) < 5:
                    og = soup.find("meta", property="og:title")
                    title = og.get("content", "").strip() if og else ""
                # Retire le suffixe « - Offres d'emploi - Educarriere.ci »
                title = re.sub(r"\s*-\s*Offres d'emploi.*$", "", title).strip()
                title = re.sub(r"\s+", " ", title)

                container = (
                    soup.select_one(".job-description")
                    or soup.select_one("article")
                    or soup.select_one(".offre-description")
                    or soup.select_one(".post-content")
                    or soup.select_one(".entry-content")
                    or soup.select_one(".annonce-detail")
                    or soup.select_one("section.content")
                    or soup.select_one("main")
                    or soup.select_one(".content")
                    or soup.select_one("#content")
                    or soup.select_one(".detail-content")
                )
                raw = str(container) if container else ""
                text = clean_html_text(container or soup)

                if not raw or len(text) < 40:
                    continue

                emails = extract_emails(text)

                item = ContentItem(
                    title=title,
                    company=self.guess_company(text, default=self.source_label),
                    location=self.guess_location(text),
                    contract_type=self.guess_contract(text),
                    description=self.clean_html(raw),
                    deadline=self.extract_deadline(text),
                    application_url=link,
                    application_email=emails[0] if emails else None,
                    source=self.source_label,
                    source_url=link,
                    status="pending",
                )
                ok, reason = item.is_valid()
                if ok:
                    items.append(item)
                else:
                    self.logger.debug(f"  🚫 Rejeté ({reason}) : {title[:60]}")
            except Exception as exc:
                self.logger.debug(f"Erreur sur lien {link}: {exc}")

        self.logger.info(f"  ✓ {self.name} : {len(items)} contenus collectés.")
        return items
