#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/scrapers/emploici.py
  Scraper Emploici.net — Recrutement, offres d'emploi & stages en Côte d'Ivoire

  Source : https://www.emploici.net  (VÉRIFIÉ — fonctionne en HTTP simple)

  Liste : /public/offres          → pages d'annonces /public/offres/{id}
  Les pages d'annonces exposent des champs structurés :
      « Lieu : », « Type de contrat : », « Date limite : », « Description : »
===============================================================================
"""

from __future__ import annotations

import re
from typing import List
from urllib.parse import urljoin

from scraper.core.base_scraper import BaseScraper
from scraper.models.content_item import ContentItem
from scraper.core.utils import extract_emails, clean_html_text

_DETAIL_RE = re.compile(r"/public/offres/\d+", re.I)

_KEYS = (
    "lieu",
    "ville",
    "type de contrat",
    "contrat",
    "date limite",
    "salaire",
    "secteur",
    "profil",
    "description",
    "entreprise",
)


def _parse_fields(text: str) -> dict:
    """Extrait les champs structurés « Clé : valeur » d'une annonce Emploici."""
    fields: dict = {}
    lower_lines = [ln for ln in text.split("\n")]
    current_key = None
    buffer: list = []
    for line in lower_lines:
        stripped = line.strip()
        if not stripped:
            continue
        m = re.match(r"^(?:[📌🎓📨💼📄]+[ \t]*)?([A-Za-zéèêàçûô'’\- ]{3,40})\s*:\s*(.*)$", stripped)
        if m:
            key = m.group(1).strip().lower()
            value = m.group(2).strip()
            if key in _KEYS and current_key != key:
                if current_key and buffer:
                    fields[current_key] = " ".join(buffer).strip()
                current_key = key
                buffer = [value] if value else []
            elif current_key == key:
                buffer.append(stripped)
        elif current_key:
            buffer.append(stripped)
    if current_key and buffer:
        fields[current_key] = " ".join(buffer).strip()
    return fields


class EmploiciScraper(BaseScraper):
    name = "emploici"
    base_url = "https://www.emploici.net"
    source_label = "Emploici.net"

    def scrape(self, max_offers: int = 20) -> List[ContentItem]:
        self.logger.info(f"Scraping {self.name} -> {self.base_url}")
        items: List[ContentItem] = []
        links: set[str] = set()

        for seed in (self.base_url, f"{self.base_url}/public/offres"):
            soup = self.get_soup(seed)
            if soup is None:
                continue
            for a in soup.select("a[href]"):
                href = a.get("href", "")
                full = urljoin(seed, href)
                if _DETAIL_RE.search(full):
                    links.add(full)
            self.logger.info(f"  [seed {seed}] {len(links)} liens d'annonces cumulés")

        for link in list(links)[: max_offers * 2]:
            if len(items) >= max_offers:
                break
            try:
                soup = self.get_soup(link)
                if soup is None:
                    continue

                text = clean_html_text(soup)
                if len(text) < 40:
                    continue

                fields = _parse_fields(text)

                # Titre : le <h2> de l'annonce (ex. « Emploi Commercial BTP … - Abidjan »)
                title = ""
                for h2 in soup.find_all("h2"):
                    candidate = h2.get_text(" ", strip=True)
                    if (
                        len(candidate) > 12
                        and not re.match(r"^(autres|recherche|offres|postuler)", candidate, re.I)
                    ):
                        title = re.sub(
                            r"\s*-\s*(Abidjan[^|]*|Cocody|Plateau|Bouaké|Yamoussoukro|San-Pédro).*$",
                            "",
                            candidate,
                        ).strip()
                        break
                # Fallback : og:title si aucun h2 trouvé
                if not title or len(title) < 5:
                    og = soup.find("meta", property="og:title")
                    title = (og.get("content", "").strip() if og else "") or ""
                    title = re.sub(
                        r"\s*-\s*(Abidjan[^|]*|Cocody|Plateau|Bouaké|Yamoussoukro|San-Pédro).*$",
                        "",
                        title,
                    ).strip()
                title = re.sub(r"\s+", " ", title).strip()

                location = fields.get("lieu") or fields.get("ville") or "Abidjan"
                contract = fields.get("type de contrat") or fields.get("contrat") or "CDI"
                deadline_raw = fields.get("date limite") or ""
                description = (
                    fields.get("description")
                    or fields.get("profil")
                    or text
                )
                # Coupe le pied de page « Autres offres récentes »
                cut = re.search(r"Autres offres r[ée]centes", description)
                if cut:
                    description = description[: cut.start()]

                emails = extract_emails(text)
                # Privilégie l'email du recruteur (pas l'email générique du site)
                apply_email = None
                if emails:
                    apply_email = next(
                        (e for e in emails if "emploici.net" not in e.lower()),
                        emails[0],
                    )

                item = ContentItem(
                    title=title,
                    company=self.guess_company(text, default=self.source_label),
                    location=self.guess_location(f"{location} {text}"),
                    contract_type=self.guess_contract(f"{contract} {text}"),
                    description=description.strip(),
                    deadline=self.extract_deadline(deadline_raw or text),
                    application_url=link,
                    application_email=apply_email,
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
