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

                # JSON-LD schema.org (fallback structuré le plus fiable)
                ld = self.extract_jsonld(soup, type_contains="JobPosting")
                ld_title = ""
                ld_desc = ""
                ld_company = ""
                ld_location = ""
                ld_salary = ""
                if isinstance(ld, dict):
                    ld_title = str(ld.get("title") or "").strip()
                    ld_desc_raw = ld.get("description") or ""
                    ld_desc = clean_html_text(ld_desc_raw) if isinstance(ld_desc_raw, str) else ""
                    hiring = ld.get("hiringOrganization")
                    if isinstance(hiring, dict):
                        ld_company = str(hiring.get("name") or "").strip()
                    place = ld.get("jobLocation")
                    if isinstance(place, dict):
                        addr = place.get("address")
                        if isinstance(addr, dict):
                            parts = [str(addr.get(k) or "") for k in ("addressLocality", "addressRegion", "addressCountry")]
                            ld_location = ", ".join(p for p in parts if p)
                    salary_base = ld.get("baseSalary")
                    if isinstance(salary_base, dict):
                        val = salary_base.get("value")
                        cur = salary_base.get("currency") or ""
                        if isinstance(val, dict):
                            minv = val.get("minValue")
                            maxv = val.get("maxValue")
                            unit = val.get("unitText") or ""
                            if minv and maxv:
                                ld_salary = f"{minv} - {maxv} {cur} {unit}".strip()
                            elif val.get("value"):
                                ld_salary = f"{val.get('value')} {cur} {unit}".strip()

                if len(text) < 40 and len(ld_desc) >= 40:
                    text = ld_desc

                if len(text) < 40:
                    meta_desc = self.extract_meta_tag(soup, name="description")
                    if len(meta_desc) >= 20:
                        text = meta_desc

                if len(text) < 40:
                    continue

                fields = _parse_fields(text)

                # Titre : H2 → JSON-LD → og:title
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
                if not title or len(title) < 5:
                    title = ld_title
                if not title or len(title) < 5:
                    og_title = self.extract_meta_tag(soup, property="og:title")
                    title = re.sub(
                        r"\s*-\s*(Abidjan[^|]*|Cocody|Plateau|Bouaké|Yamoussoukro|San-Pédro).*$",
                        "",
                        og_title,
                    ).strip()
                title = re.sub(r"\s+", " ", title).strip()

                location = fields.get("lieu") or fields.get("ville") or ld_location or "Abidjan"
                contract = fields.get("type de contrat") or fields.get("contrat") or "CDI"
                deadline_raw = fields.get("date limite") or ""
                description = (
                    fields.get("description")
                    or fields.get("profil")
                    or ld_desc
                    or text
                )
                cut = re.search(r"Autres offres r[ée]centes", description)
                if cut:
                    description = description[: cut.start()]

                # Injection salaire (champ structuré « Salaire » → regex → JSON-LD)
                salary_structured = fields.get("salaire") or ""
                if not salary_structured:
                    salary_structured = self.extract_salary(text) or ld_salary or ""
                if salary_structured and salary_structured.lower() not in description.lower():
                    description = f"Salaire : {salary_structured}\n\n{description}"

                company = ld_company or self.guess_company(text, default=self.source_label)
                # Entreprise structurée dans les champs si présente
                if fields.get("entreprise") and not ld_company:
                    company_candidate = fields["entreprise"]
                    if len(company_candidate) >= 3:
                        company = company_candidate

                emails = extract_emails(text)
                apply_email = None
                if emails:
                    apply_email = next(
                        (e for e in emails if "emploici.net" not in e.lower()),
                        emails[0],
                    )

                item = ContentItem(
                    title=title,
                    company=company,
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
