#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/exam_sources.py
  Sources officielles des concours administratifs ivoiriens

  ⚠️ JAMAIS d'agrégateur concurrent (Ablanian…). Sources PRIMAIRES uniquement :
    - GUCACI (plateforme unifiée des concours — famille ciconcours.com)
    - Ministère de la Fonction Publique (communiqués)
    - ENA (actualités & concours)
    - Ministère de la Défense (concours militaires)
    - INFAS, INJS, CAFOP/DECO, INSFS
    - AIP (veille secondaire)
    - Service Public CI (complément, désactivé par défaut)

  Les URLs sont CENTRALISÉES dans scraper/config/exam_sources.json (modifiable
  sans redéploiement — ces plateformes changent souvent de sous-domaine).
  Chaque source passe un check robots.txt avant d'être exploitée.

  Chaque scraper retourne des ExamItem BRUTS (title, organizer, description_md,
  source_url, documents). L'extraction structurée est faite ensuite par Gemini
  (scraper/core/gemini_exams.py) avec repli heuristique (exam_parser.py).
===============================================================================
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Type
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scraper.core.base_scraper import BaseScraper
from scraper.core.logger import setup_logger
from scraper.core.robots_check import check_robots
from scraper.models.exam_item import (
    ExamItem,
    is_url_on_domain,
    url_hostname,
    validate_source_url,
)

logger = setup_logger("exam_sources")

CONFIG_PATH = Path(__file__).resolve().parent / "config" / "exam_sources.json"

# Motifs d'URL de détail (fiches concours / articles).
_DETAIL_HREF_RE = re.compile(
    r"(concours|/detail|/avis|communiqu|actualite|article|resultats?|/c/|/concours-20\d{2}/)",
    re.I,
)
_PDF_RE = re.compile(r"\.pdf(?:[?#].*)?$", re.I)

# Titres de pages génériques (navigation / recherche / accueil) à NE PAS
# enregistrer comme concours — le pattern « Recherche — » du site ENA a déjà
# produit une fiche parasite en production.
_GENERIC_TITLE_RE = re.compile(
    r"^(recherche|accueil|home|page d'accueil|bienvenue|contact|mentions|plan du site|sitemap|404|erreur)",
    re.I,
)


def _is_generic_title(title: str) -> bool:
    """True si le titre correspond à une page générique (jamais un concours)."""
    if not title:
        return True
    t = title.strip()
    return bool(_GENERIC_TITLE_RE.match(t))


# ----------------------------------------------------------------------------
# Communiqués PDF (ex. ENA) : les institutions publient parfois leurs avis de
# concours UNIQUEMENT en PDF, sans page HTML associée. Le scraper crée alors une
# fiche « communiqué officiel » (titre = nom du fichier, lien source = PDF).
# ----------------------------------------------------------------------------
# Motifs attendus dans le NOM du fichier pour considérer le PDF comme un
# communiqué de concours (et pas un document annexe quelconque).
_PDF_COMMUNIQUE_RE = re.compile(
    r"(concours|communiqu|arrete|arrêté|avis|inscription|resultat|résultat|ouverture|recrutement)",
    re.I,
)


def _pdf_filename_title(url: str) -> str:
    """Titre lisible depuis le nom de fichier d'un PDF (URL-décodé, sans extension)."""
    from urllib.parse import unquote

    name = unquote((url or "").rsplit("/", 1)[-1])
    name = re.sub(r"\.pdf(?:\?.*)?$", "", name, flags=re.I)
    name = re.sub(r"[\_\-\+\(\)]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name[:200] or ""


def _make_pdf_item(
    link: str,
    source_config: Dict,
    organizer: str,
    category: str,
    source_label: Optional[str] = None,
) -> Optional[ExamItem]:
    """Fiche concours créée directement depuis un PDF de communiqué officiel.

    Sans parseur PDF, le texte n'est pas extractible : on crée une fiche
    « communiqué officiel » (titre = nom du fichier, lien source = PDF,
    description courte) qui renvoie vers le document officiel. La réécriture
    Gemini / l'extraction structurée s'appliquent ensuite comme pour les
    autres fiches. Retourne None si le nom de fichier ne ressemble pas à un
    communiqué de concours.
    """
    title = _pdf_filename_title(link)
    if not title or _is_generic_title(title) or not _PDF_COMMUNIQUE_RE.search(title):
        return None
    description_md = (
        f"Communiqué officiel au format PDF publié par {organizer} : « {title} ». "
        "Consultez le document source (lien ci-dessous) pour les conditions "
        "d'inscription, les dates et les modalités de candidature."
    )
    item = ExamItem(
        title=title,
        organizer=organizer,
        category=category,
        description_md=description_md,
        source=source_label or str(source_config.get("name", "web")),
        source_url=link,
        documents=[{"name": title, "url": link}],
        status="pending",
        confidence="low",
    )
    ok, _ = item.is_valid()
    return item if ok else None


def load_sources_config() -> Dict:
    with open(CONFIG_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def _clean_text(soup: BeautifulSoup) -> str:
    """Extrait le texte principal lisible d'une page (hors nav/header/footer)."""
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form"]):
        tag.decompose()
    # Priorité aux conteneurs d'articles si présents.
    container = soup.find("article") or soup.find("main") or soup.body or soup
    text = container.get_text("\n", strip=True) if container else ""
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_documents(soup: BeautifulSoup, base_url: str) -> List[Dict[str, str]]:
    docs: List[Dict[str, str]] = []
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if _PDF_RE.search(href):
            name = a.get_text(" ", strip=True).strip() or "Document officiel"
            docs.append({"name": name[:160], "url": urljoin(base_url, href)})
    return docs


def _extract_title(soup: BeautifulSoup) -> str:
    for tag in soup.find_all(["h1", "h2"]):
        text = tag.get_text(" ", strip=True)
        if len(text) > 8:
            return text[:200]
    title_tag = soup.find("title")
    if title_tag:
        text = title_tag.get_text(" ", strip=True).strip()
        if text:
            return text[:200]
    return ""


def _collect_detail_links(
    soup: BeautifulSoup,
    base_url: str,
    extra_patterns: List[str] = None,
    allowed_domains: List[str] = None,
) -> List[str]:
    """Liens de fiches candidates, restreints au(x) domaine(s) autorisé(s) de la source.

    La validation de domaine évite les fiches parasites interdomaines — ex. le
    scraper ENA suivait un lien « candidater » vers gucaci.ciconcours.com et
    créait une fiche « CONCOURS ADMINISTRATIFS 2026 » avec organisateur ENA,
    doublon de la fiche GUCACI officielle (source du doublon constaté en prod).
    """
    links: List[str] = []
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if not href or href.startswith(("#", "javascript:", "mailto:")):
            continue
        if not (
            _DETAIL_HREF_RE.search(href)
            or _PDF_RE.search(href)  # communiqués PDF (ex. ENA) = contenu, pas de la navigation
            or (extra_patterns and any(p in href for p in extra_patterns))
        ):
            continue
        link = urljoin(base_url, href)
        if allowed_domains and not is_url_on_domain(link, allowed_domains):
            continue
        links.append(link)
    # Déduplication en conservant l'ordre.
    seen: set[str] = set()
    out: List[str] = []
    for link in links:
        if link not in seen:
            seen.add(link)
            out.append(link)
    return out


def _allowed_domains(source_config: Dict) -> List[str]:
    """Domaines autorisés pour une source : config explicite, sinon l'hôte de base_url."""
    domains = source_config.get("allowed_domains")
    if domains and isinstance(domains, list):
        return [str(d).strip() for d in domains if str(d).strip()]
    host = url_hostname(str(source_config.get("base_url", "")))
    return [host] if host else []


# ============================================================================
# Scrapers
# ============================================================================
class CiconcoursPlatformScraper(BaseScraper):
    """Plateformes de la famille ciconcours.com (GUCACI, INFAS, INSFS, INJS, Défense)."""

    name = "ciconcours"
    base_url = ""

    def __init__(self, http_client, source_config: Dict):
        super().__init__(http_client)
        self.source_config = source_config
        self.base_url = str(source_config.get("base_url", "")).rstrip("/")
        self.source_label = str(source_config.get("name", self.name))
        self.allowed_domains = _allowed_domains(source_config)

    def scrape(self, max_offers: int = 15) -> List[ExamItem]:
        self.logger.info(f"Scraping {self.source_label} -> {self.base_url}")
        items: List[ExamItem] = []
        links: List[str] = []
        reachable = False
        pdf_count = 0
        organizer = str(self.source_config.get("organizer", self.source_label))
        category = str(self.source_config.get("category", "administratif"))

        for path in self.source_config.get("list_paths", ["/"]):
            soup = self.get_soup(urljoin(f"{self.base_url}/", path.lstrip("/")))
            if soup is None:
                continue
            reachable = True
            links.extend(_collect_detail_links(soup, self.base_url, allowed_domains=self.allowed_domains))
        self.logger.info(f"  [ciconcours] {len(links)} liens de fiches cumulés")

        for link in links[: max_offers * 3]:
            if len(items) >= max_offers:
                break
            # Communiqué PDF (ex. « Communiqué relatif au concours 2026.pdf ») :
            # fiche créée directement, aucune page HTML à parser.
            if _PDF_RE.search(link):
                pdf_item = _make_pdf_item(link, self.source_config, organizer, category, self.source_label)
                if pdf_item:
                    items.append(pdf_item)
                    pdf_count += 1
                continue
            try:
                soup = self.get_soup(link)
                if soup is None:
                    continue
                text = _clean_text(soup)
                if len(text) < 60:
                    continue
                title = _extract_title(soup)
                if not title or _is_generic_title(title):
                    continue
                docs = _extract_documents(soup, link)
                if self.allowed_domains and not is_url_on_domain(link, self.allowed_domains):
                    self.logger.debug(f"  🚫 Lien hors domaine ignoré : {link}")
                    continue
                item = ExamItem(
                    title=title,
                    organizer=organizer,
                    category=category,
                    description_md=text[:20000],
                    source=self.source_label,
                    source_url=link,
                    documents=docs,
                    status="pending",
                    confidence="low",
                )
                ok, reason = item.is_valid()
                if ok:
                    items.append(item)
                else:
                    self.logger.debug(f"  🚫 Rejeté ({reason}) : {title[:60]}")
            except Exception as exc:
                self.logger.debug(f"Erreur sur lien {link}: {exc}")

        CiconcoursPlatformScraper._log_source_outcome(reachable, items, pdf_count, self.source_label)
        return items

    @staticmethod
    def _log_source_outcome(
        reachable: bool,
        items: List[ExamItem],
        pdf_count: int = 0,
        label: str = "",
    ) -> None:
        """Journalise l'issue de la collecte en distinguant les 3 cas :
        injoignable / joignable mais 0 résultat / résultats obtenus.
        (Les trois cas produisaient avant le même message « ✓ 0 communiqués ».)"""
        logger = setup_logger("exam_sources")
        prefix = f"  [{label}] " if label else "  "
        if not reachable:
            logger.error(
                f"{prefix}❌ Source injoignable (toutes les pages de liste en erreur — timeout / DNS / blocage)."
            )
        elif not items:
            logger.warning(
                f"{prefix}⚠️ 0 résultat — site joignable mais aucun lien de concours trouvé "
                "(structure de page modifiée ou aucun concours en cours)."
            )
        else:
            suffix = f" (dont {pdf_count} communiqués PDF)" if pdf_count else ""
            logger.info(f"{prefix}✅ {len(items)} concours bruts{suffix}.")


class ActualitesScraper(BaseScraper):
    """Sites institutionnels à flux d'actualités (Fonction Publique, ENA, DECO)."""

    name = "actualites"
    base_url = ""

    def __init__(self, http_client, source_config: Dict):
        super().__init__(http_client)
        self.source_config = source_config
        self.base_url = str(source_config.get("base_url", "")).rstrip("/")
        self.source_label = str(source_config.get("name", self.name))
        self.allowed_domains = _allowed_domains(source_config)

    def scrape(self, max_offers: int = 15) -> List[ExamItem]:
        self.logger.info(f"Scraping {self.source_label} -> {self.base_url}")
        items: List[ExamItem] = []
        links: List[str] = []
        reachable = False
        pdf_count = 0
        organizer = str(self.source_config.get("organizer", self.source_label))
        category = str(self.source_config.get("category", "administratif"))

        for path in self.source_config.get("list_paths", ["/"]):
            soup = self.get_soup(urljoin(f"{self.base_url}/", path.lstrip("/")))
            if soup is None:
                continue
            reachable = True
            links.extend(_collect_detail_links(soup, self.base_url, allowed_domains=self.allowed_domains))

        for link in links[: max_offers * 3]:
            if len(items) >= max_offers:
                break
            # Communiqué PDF : fiche créée directement (le filtre « concours »
            # s'applique alors au NOM du fichier, pas au texte de la page).
            if _PDF_RE.search(link):
                pdf_item = _make_pdf_item(link, self.source_config, organizer, category, self.source_label)
                if pdf_item:
                    items.append(pdf_item)
                    pdf_count += 1
                continue
            try:
                soup = self.get_soup(link)
                if soup is None:
                    continue
                text = _clean_text(soup)
                if len(text) < 60:
                    continue
                # Ne garder que les contenus à forte probabilité « concours ».
                probe = f"{_extract_title(soup)} {text[:2000]}".lower()
                if not any(k in probe for k in ("concours", "recrutement", "inscription", "examen", "communiqué", "communique", "résultat", "resultat")):
                    continue
                title = _extract_title(soup)
                if not title or _is_generic_title(title):
                    continue
                if self.allowed_domains and not is_url_on_domain(link, self.allowed_domains):
                    self.logger.debug(f"  🚫 Lien hors domaine ignoré : {link}")
                    continue
                docs = _extract_documents(soup, link)
                item = ExamItem(
                    title=title,
                    organizer=organizer,
                    category=category,
                    description_md=text[:20000],
                    source=self.source_label,
                    source_url=link,
                    documents=docs,
                    status="pending",
                    confidence="low",
                )
                ok, reason = item.is_valid()
                if ok:
                    items.append(item)
                else:
                    self.logger.debug(f"  🚫 Rejeté ({reason}) : {title[:60]}")
            except Exception as exc:
                self.logger.debug(f"Erreur sur lien {link}: {exc}")

        CiconcoursPlatformScraper._log_source_outcome(reachable, items, pdf_count, self.source_label)
        return items


class AipScraper(BaseScraper):
    """Agence Ivoirienne de Presse — veille des communiqués officiels."""

    name = "aip"
    base_url = "https://www.aip.ci"

    def __init__(self, http_client, source_config: Dict):
        super().__init__(http_client)
        self.source_config = source_config
        self.base_url = str(source_config.get("base_url", self.base_url)).rstrip("/")
        self.source_label = "AIP — Agence Ivoirienne de Presse"
        self.allowed_domains = _allowed_domains(source_config)

    def scrape(self, max_offers: int = 15) -> List[ExamItem]:
        self.logger.info(f"Scraping AIP (veille) -> {self.base_url}")
        items: List[ExamItem] = []
        links: List[str] = []
        reachable = False
        pdf_count = 0
        organizer = str(self.source_config.get("organizer", self.source_label))
        category = str(self.source_config.get("category", "administratif"))

        for path in self.source_config.get("list_paths", ["/recherche?q=concours"]):
            soup = self.get_soup(urljoin(f"{self.base_url}/", path.lstrip("/")))
            if soup is None:
                continue
            reachable = True
            links.extend(_collect_detail_links(soup, self.base_url, extra_patterns=["concours"], allowed_domains=self.allowed_domains))

        for link in links[: max_offers * 3]:
            if len(items) >= max_offers:
                break
            if _PDF_RE.search(link):
                pdf_item = _make_pdf_item(link, self.source_config, organizer, category, self.source_label)
                if pdf_item:
                    items.append(pdf_item)
                    pdf_count += 1
                continue
            try:
                soup = self.get_soup(link)
                if soup is None:
                    continue
                text = _clean_text(soup)
                if len(text) < 60:
                    continue
                if not re.search(r"concours|recrutement|inscription", text[:2000], re.I):
                    continue
                title = _extract_title(soup)
                if not title or _is_generic_title(title):
                    continue
                if self.allowed_domains and not is_url_on_domain(link, self.allowed_domains):
                    self.logger.debug(f"  🚫 Lien hors domaine ignoré : {link}")
                    continue
                item = ExamItem(
                    title=title,
                    organizer=organizer,
                    category=category,
                    description_md=text[:20000],
                    source=self.source_label,
                    source_url=link,
                    documents=_extract_documents(soup, link),
                    status="pending",
                    confidence="low",
                )
                ok, reason = item.is_valid()
                if ok:
                    items.append(item)
            except Exception as exc:
                self.logger.debug(f"Erreur sur lien {link}: {exc}")

        CiconcoursPlatformScraper._log_source_outcome(reachable, items, pdf_count, self.source_label)
        return items


# ============================================================================
# Fabrique
# ============================================================================
def build_scraper(source_config: Dict, http_client):
    source_type = str(source_config.get("type", "ciconcours"))
    if source_type == "aip":
        return AipScraper(http_client, source_config)
    if source_type == "actualites":
        return ActualitesScraper(http_client, source_config)
    return CiconcoursPlatformScraper(http_client, source_config)


def get_enabled_sources() -> List[Dict]:
    cfg = load_sources_config()
    return [s for s in cfg.get("sources", []) if s.get("enabled", True)]
