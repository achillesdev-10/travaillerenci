#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/models/exam_item.py
  Modèle DÉDIÉ aux concours administratifs (table `exams`)

  Contrairement au dépôt unifié `job_offers`, les concours disposent d'une
  table riche (éligibilité, dates clés, documents, confiance IA). Ce modèle
  reflète 1:1 la migration Supabase 0010_create_exams_table.sql.
===============================================================================
"""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import BaseModel, Field

# -----------------------------------------------------------------------------
# Constantes (miroir de src/lib/examConstants.ts)
# -----------------------------------------------------------------------------
EXAM_CATEGORIES = (
    "administratif",
    "sante",
    "enseignement",
    "securite",
    "militaire",
    "autre",
)

EXAM_TYPES = (
    "recrutement_nouveau",
    "promotion",
    "concours_direct",
    "concours_professionnel",
    "entree_ecole",
    "examen",
)

EXAM_CONFIDENCE = ("low", "medium", "high")

# Échelle des diplômes ivoiriens (niveau croissant) — filtrage front.
DIPLOMA_LEVELS = {
    "CEPE": 1,
    "BEPC": 2,
    "CAP/BEP": 3,
    "CAP": 3,
    "BEP": 3,
    "BAC": 4,
    "BTS/DUT": 5,
    "BTS": 5,
    "DUT": 5,
    "DEUG": 5,
    "LICENCE": 6,
    "LICENCE PRO": 6,
    "MASTER": 7,
    "INGENIEUR": 7,
    "DOCTORAT": 8,
}


def diploma_level(diploma: Optional[str]) -> Optional[int]:
    """Niveau minimal d'un diplôme donné (normalisé), ou None si inconnu."""
    if not diploma:
        return None
    key = diploma.strip().upper()
    if key in DIPLOMA_LEVELS:
        return DIPLOMA_LEVELS[key]
    for k, level in DIPLOMA_LEVELS.items():
        base = k.split("/")[0]
        if key.startswith(base) or base.startswith(key):
            return level
    return None


def compute_min_diploma_level(diplomas: List[str]) -> Optional[int]:
    levels = [diploma_level(d) for d in diplomas]
    levels = [lvl for lvl in levels if lvl is not None]
    return min(levels) if levels else None


# -----------------------------------------------------------------------------
# Normalisation des diplômes → valeurs canoniques du filtre front (DIPLOMA_FILTERS)
# -----------------------------------------------------------------------------
# Le filtre /concours?diploma=… fait une égalité EXACTE sur le tableau `diplomas`
# (json_each côté SQLite, `contains` côté Supabase). Les variantes rencontrées
# dans les communiqués (baccalauréat, BAC+3, BTS, DUT, Licence Pro, Maîtrise…)
# doivent donc être ramenées à la valeur canonique du filtre.
_DIPLOMA_ALIASES = {
    "CEPE": "CEPE",
    "BEPC": "BEPC",
    "CAP": "CAP/BEP",
    "CAP/BEP": "CAP/BEP",
    "BEP": "CAP/BEP",
    "BAC": "BAC",
    "BTS": "BTS/DUT",
    "BTS/DUT": "BTS/DUT",
    "DUT": "BTS/DUT",
    "DEUG": "DEUG",
    "LICENCE": "LICENCE",
    "LICENCE PRO": "LICENCE",
    "LICENCE PROFESSIONNELLE": "LICENCE",
    "MASTER": "MASTER",
    "INGENIEUR": "INGENIEUR",
    "DOCTORAT": "DOCTORAT",
}

# Variantes libres (baccalauréat, BAC+3, Maîtrise, PHD, CAP1/CAP2…) détectées par regex.
_DIPLOMA_VARIANTS = [
    (re.compile(r"^BACCALAUREAT$|^BACCALAURÉAT$", re.I), "BAC"),
    (re.compile(r"^BACC?\s*\+\s*\d+$", re.I), "BAC"),
    (re.compile(r"^MAITRISE$|^MAÎTRISE$", re.I), "MASTER"),
    (re.compile(r"^PHD$|^PH\.?D$", re.I), "DOCTORAT"),
    (re.compile(r"^CAP\s*[12]$", re.I), "CAP/BEP"),
    (re.compile(r"^INGÉNIEUR$", re.I), "INGENIEUR"),
]


def normalize_diploma(raw: Optional[str]) -> Optional[str]:
    """Ramène un diplôme brut à sa valeur canonique (filtre front), None si vide."""
    if not raw:
        return None
    token = re.sub(r"\s+", " ", str(raw).strip().upper().replace("’", "'"))
    if not token:
        return None
    if token in _DIPLOMA_ALIASES:
        return _DIPLOMA_ALIASES[token]
    for pat, canonical in _DIPLOMA_VARIANTS:
        if pat.match(token):
            return canonical
    return token


def normalize_diplomas(diplomas: List[str]) -> List[str]:
    """Normalise + déduplique (ordre préservé) une liste de diplômes."""
    out: List[str] = []
    for d in diplomas:
        n = normalize_diploma(d)
        if n and n not in out:
            out.append(n)
    return out


# -----------------------------------------------------------------------------
# Filtrage qualité post-IA — rejeter les pages qui ne sont PAS un concours
# -----------------------------------------------------------------------------
# Problème constaté en prod : le scraper créait une fiche pour chaque lien de
# page trouvé, y compris des TITRES DE RUBRIQUE / MENU (« Communiqués », « Actu
# DECO », « NOTE AUX USAGERS », « ARCHIVES DES COMMUNIQUES », « À L'ATTENTION
# DES DRENAET ET DES IEPP », « École Nationale d'Administration » seul…). Ces
# libellés ne décrivent aucune annonce de concours exploitable (dates,
# conditions, diplômes) et polluent /concours.
#
# Deux règles complémentaires (évaluées APRÈS l'enrichissement IA) :
#   1. Règle TITRE : le titre correspond à une rubrique/menu générique ;
#   2. Règle CONTENU : aucune information actionnable (dates OU conditions)
#      n'a été extraite — la fiche n'apporte rien au candidat.
# Exception : les fiches « communiqué PDF officiel » (texte non extractible
# mais document officiel exploitable) échappent à la règle CONTENU.


def _norm_title(title: str) -> str:
    """Titre normalisé : minuscules, sans accents, apostrophes unifiées."""
    t = unicodedata.normalize("NFD", title.lower().replace("’", "'"))
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t).strip()


# Titres qui, SEULS, désignent une page générique — jamais une annonce de
# concours. Les titres qui contiennent EN PLUS un mot-clé concours (ex.
# « Communiqué relatif au concours 2026 ») ne matchent pas : les motifs sont
# ancrés (début ET fin) sauf mention contraire.
_GENERIC_RUBRIQUE_PATTERNS = [
    r"^communiqu[ée]s?$",                       # « Communiqués » (menu)
    r"^archives?(?:\s+des\s+communiqu[ée]s?)?$",  # « ARCHIVES DES COMMUNIQUES »
    r"^actu(?:alit[ée]s?)?(?:\s|$)",            # « Actu DECO », « Actualités »
    r"^note\s+aux\s+usagers?$",                # « NOTE AUX USAGERS »
    r"^[aà]\s+l'attention\s+(?:des|de|du)",    # « À L'ATTENTION DES DRENAET… »
    r"^annonces?$",
    r"^r[ée]sultats?$",                         # page « Résultats » sans contexte
    r"^(accueil|bienvenue|home|page\s+d'accueil)$",
    r"^(contact|mentions?\s+l[ée]gales?|plan\s+du\s+site|sitemap|faq|foire\s+aux\s+questions)$",
    r"^(documents|t[ée]l[ée]chargements?|m[ée]diath[èe]que|galerie|liens\s+utiles)$",
    r"^(guide\s+d'inscription|comment\s+s'inscrire|proc[ée]dure\s+d'inscription)$",
    r"^(pr[ée]sentation|qui\s+sommes\s+nous|organisation|histoire)$",
    r"^(?:les\s+)?attributions?(?:\s|$)",          # « LES ATTRIBUTIONS DE LA DIRECTION DES CONCOURS »
    r"^recherche(?:\s+[-–—:]|\s*$)",               # « Recherche » / « Recherche — … » (parasite ENA)
    r"^(404|erreur|erreur\s+404)$",
]


def generic_rubrique_reason(title: Optional[str]) -> Optional[str]:
    """Raison si `title` est un titre de rubrique/menu générique, sinon None."""
    if not title:
        return "titre vide"
    t = _norm_title(title)
    if not t:
        return "titre vide"
    for pat in _GENERIC_RUBRIQUE_PATTERNS:
        if re.match(pat, t):
            return f"titre de rubrique générique (« {title.strip()[:60]} »)"
    return None


def has_actionable_info(item: Any) -> bool:
    """True si la fiche contient au moins une information exploitable pour un
    candidat : une date clé, un diplôme, un âge, une nationalité, un nombre de
    postes, des frais ou des villes. (exam_type seul ne suffit pas : il est
    souvent inféré et ne renseigne ni dates ni conditions.)"""
    if any(
        (
            item.registration_start,
            item.registration_end,
            item.exam_date,
            item.results_date,
        )
    ):
        return True
    if item.diplomas:
        return True
    if item.age_min is not None or item.age_max is not None:
        return True
    if item.nationality:
        return True
    if item.positions_count is not None:
        return True
    if item.registration_fee:
        return True
    if item.cities:
        return True
    return False


def _is_pdf_communique(item: Any) -> bool:
    """Fiche issue d'un communiqué PDF officiel (texte non extractible, mais
    document officiel exploitable) — échappe à la règle CONTENU."""
    url = str(getattr(item, "source_url", "") or "").lower()
    if url.endswith(".pdf"):
        return True
    for doc in getattr(item, "documents", []) or []:
        if isinstance(doc, dict) and str(doc.get("url") or "").lower().endswith(".pdf"):
            return True
    return False


def relevance_issues(
    *,
    rejected: bool,
    rejection_reason: Optional[str],
    title: Optional[str],
    item: Optional[Any] = None,
    row: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Raison si la fiche (APRÈS enrichissement IA) n'est pas un concours
    exploitable, sinon None. Accepte soit un ExamItem (`item`), soit un
    dictionnaire de ligne BDD (`row`) pour le nettoyage des fiches existantes.

    Ordre d'évaluation :
      1. rejet explicite de l'IA (is_concours=false) ;
      2. titre de rubrique générique ;
      3. contenu inexploitable (aucune date ni condition) — hors communiqués PDF.
    """
    if rejected:
        return rejection_reason or "page jugée hors-sujet"

    reason = generic_rubrique_reason(title)
    if reason:
        return reason

    if row is not None:
        proxy = _RowProxy(row)
    elif item is not None:
        proxy = item
    else:
        return None

    if _is_pdf_communique(proxy):
        return None
    if not has_actionable_info(proxy):
        return "aucune information exploitable (aucune date ni condition d'éligibilité)"
    return None


class _RowProxy:
    """Vue minimale d'une ligne BDD (dict) exposant les attributs attendus par
    has_actionable_info / _is_pdf_communique."""

    def __init__(self, row: Dict[str, Any]):
        self.row = row

    def __getattr__(self, name: str):
        val = self.row.get(name)
        if name in ("diplomas", "cities", "documents") and isinstance(val, str):
            try:
                import json

                return json.loads(val)
            except Exception:
                return []
        if name in ("registration_start", "registration_end", "exam_date", "results_date"):
            return val or None
        return val


# -----------------------------------------------------------------------------
# Normalisation / validation des URLs sources
# -----------------------------------------------------------------------------
# Paramètres de suivi à retirer : deux URLs ne différant que par un ?utm_…
# désignent la même fiche et doivent être dédupliquées.
_TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "ref", "ref_source", "source",
}


def normalize_source_url(url: Optional[str]) -> Optional[str]:
    """URL source normalisée : minuscules, sans fragment ni paramètres de suivi."""
    if not url:
        return None
    try:
        parts = urlsplit(url.strip())
    except ValueError:
        return url.strip()
    if parts.scheme.lower() not in ("http", "https") or not parts.hostname:
        return url.strip()
    query = parts.query
    kept = [
        (k, v) for k, v in parse_qsl(query, keep_blank_values=True)
        if k.lower() not in _TRACKING_PARAMS
    ]

    return urlunsplit(
        (
            parts.scheme.lower(),
            parts.netloc.lower(),
            parts.path or "/",
            urlencode(kept) if kept else "",
            "",  # fragment toujours supprimé
        )
    )


def url_hostname(url: Optional[str]) -> Optional[str]:
    """Hôte (minuscules, sans port) d'une URL, None si invalide."""
    if not url:
        return None
    try:
        host = urlsplit(url).hostname
    except ValueError:
        return None
    return host.lower() if host else None


def validate_source_url(url: Optional[str]) -> tuple[bool, str]:
    """Validation stricte d'une URL source : schéma http(s) + hôte valide."""
    if not url:
        return False, "source_url obligatoire"
    try:
        parts = urlsplit(url)
    except ValueError:
        return False, "source_url invalide (non parsable)"
    if parts.scheme.lower() not in ("http", "https"):
        return False, f"source_url invalide (schéma « {parts.scheme or 'vide'} »)"
    if not parts.hostname or "." not in parts.hostname:
        return False, "source_url invalide (hôte absent)"
    return True, "ok"


def is_url_on_domain(url: Optional[str], allowed_domains: List[str]) -> bool:
    """True si l'hôte de `url` appartient à l'un des domaines autorisés (ou sous-domaine)."""
    host = url_hostname(url)
    if not host:
        return False
    for domain in allowed_domains:
        d = domain.strip().lower().lstrip(".")
        if not d:
            continue
        if host == d or host.endswith("." + d):
            return True
    return False


# -----------------------------------------------------------------------------
# Fusion de doublons inter-sources (--merge-duplicates / upsert)
# -----------------------------------------------------------------------------
# Colonnes scalaires fusionnées champ à champ (premier non nul gagne).
_MERGE_SCALAR_KEYS = (
    "organizer",
    "category",
    "exam_type",
    "registration_start",
    "registration_end",
    "exam_date",
    "results_date",
    "age_min",
    "age_max",
    "age_reference_date",
    "nationality",
    "positions_count",
    "registration_fee",
    "location",
    "source_website",
    "seo_title",
    "seo_description",
    "seo_keywords",
)


def _row_field_count(row: Dict[str, Any]) -> int:
    """Nombre de champs structurés renseignés (indicateur de richesse)."""
    count = 0
    for key in _MERGE_SCALAR_KEYS:
        if row.get(key) not in (None, "", [], {}):
            count += 1
    for key in ("diplomas", "documents", "cities"):
        count += len(row.get(key) or [])
    return count


def _url_specificity(url: Optional[str]) -> int:
    """Nombre de segments de chemin — la fiche de DÉTAIL (URL la plus
    spécifique) est privilégiée face à la racine du site."""
    if not url:
        return 0
    try:
        from urllib.parse import urlsplit

        return len([s for s in urlsplit(url).path.split("/") if s])
    except ValueError:
        return 0


def pick_keeper(group: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Choisit LA fiche à conserver dans un groupe de doublons : publiée
    d'abord, puis la plus riche (champs structurés), URL de détail, puis
    description la plus longue."""
    return max(
        group,
        key=lambda r: (
            r.get("status") == "published",
            _row_field_count(r),
            _url_specificity(r.get("source_url")),
            len(r.get("description_md") or ""),
        ),
    )


def merge_exam_rows(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Fusionne les lignes d'un même doublon en UNE ligne (la plus riche).

    - documents : union par URL (ordre stable) ;
    - diplomas / cities : union sans doublon ;
    - champs scalaires : premier non nul ;
    - description_md : la plus longue.

    Le statut/publié/organisateur viennent du keeper (`pick_keeper`).
    """
    if not rows:
        return {}
    keeper = pick_keeper(rows)
    merged = dict(keeper)
    # Documents : on conserve AUSSI ceux sans URL (observés en prod), dédup
    # par URL quand elle existe (un document sans lien n'est pas fusionnable).
    merged["documents"] = [d for d in (keeper.get("documents") or []) if isinstance(d, dict)]

    for other in rows:
        if other is keeper:
            continue
        # Documents : union par URL (les documents sans URL sont conservés).
        seen = {str(d.get("url") or "") for d in merged["documents"]}
        for doc in other.get("documents") or []:
            if not isinstance(doc, dict):
                continue
            doc_url = str(doc.get("url") or "")
            if doc_url and doc_url in seen:
                continue
            merged["documents"].append(doc)
            if doc_url:
                seen.add(doc_url)
        # Diplômes / villes : union sans doublon.
        for key in ("diplomas", "cities"):
            current = list(merged.get(key) or [])
            for value in other.get(key) or []:
                if value not in current:
                    current.append(value)
            merged[key] = current
        # Champs scalaires : premier non nul (l'existant fait foi).
        for key in _MERGE_SCALAR_KEYS:
            if merged.get(key) in (None, "", [], {}):
                value = other.get(key)
                if value not in (None, "", [], {}):
                    merged[key] = value
        # Description : la plus longue.
        if len(other.get("description_md") or "") > len(merged.get("description_md") or ""):
            merged["description_md"] = other.get("description_md")

    return merged


class ExamItem(BaseModel):
    """Un concours extrait d'une source officielle, avant validation BDD."""

    title: str = Field(..., min_length=3)
    organizer: str = Field(..., min_length=2)
    category: str = "administratif"
    exam_type: Optional[str] = None
    description_md: str = Field(..., min_length=10)
    registration_start: Optional[datetime] = None
    registration_end: Optional[datetime] = None
    exam_date: Optional[datetime] = None
    results_date: Optional[datetime] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    age_reference_date: Optional[str] = None
    nationality: Optional[str] = None
    diplomas: List[str] = []
    min_diploma_level: Optional[int] = None
    positions_count: Optional[int] = None
    registration_fee: Optional[str] = None
    location: Optional[str] = None
    cities: List[str] = []
    documents: List[dict] = []  # [{name, url}]
    source: str = "web"
    source_url: str
    status: str = "pending"
    confidence: str = "medium"
    # Rejet explicite (Gemini is_concours=false) : la fiche n'est pas une
    # annonce de concours exploitable et ne doit pas être insérée.
    rejected: bool = False
    rejection_reason: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    seo_keywords: Optional[str] = None
    slug: Optional[str] = None
    scraped_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    def __init__(self, **data):
        super().__init__(**data)
        # Normalisation après construction.
        self.category = self.category if self.category in EXAM_CATEGORIES else "administratif"
        if self.exam_type and self.exam_type not in EXAM_TYPES:
            self.exam_type = None
        self.confidence = self.confidence if self.confidence in EXAM_CONFIDENCE else "medium"
        # Diplômes normalisés vers les valeurs canoniques du filtre front.
        self.diplomas = normalize_diplomas(self.diplomas)
        self.min_diploma_level = compute_min_diploma_level(self.diplomas)
        # URL source normalisée (minuscules, sans fragment ni paramètres de suivi)
        # → la déduplication par source_url devient robuste.
        self.source_url = normalize_source_url(self.source_url) or ""

    # ------------------------------------------------------------------
    def dedup_key(self) -> str:
        from slugify import slugify

        return "|".join(
            [
                slugify(self.title, separator="-"),
                slugify(self.organizer or "inconnu", separator="-"),
            ]
        )

    def is_valid(self) -> tuple[bool, str]:
        if not self.title or len(self.title.strip()) < 3:
            return False, "titre trop court"
        if not self.organizer or len(self.organizer.strip()) < 2:
            return False, "organisateur absent"
        if not self.description_md or len(self.description_md.strip()) < 25:
            return False, "description trop courte"
        ok, reason = validate_source_url(self.source_url)
        if not ok:
            return False, reason
        return True, "ok"

    # ------------------------------------------------------------------
    def relevance_issues(self) -> Optional[str]:
        """Raison si la fiche (à APPELER APRÈS l'enrichissement IA) n'est pas
        un concours exploitable, sinon None. Voir `relevance_issues()` module.

        NB : à NE PAS appeler sur les items BRUTS avant enrichissement — c'est
        l'enrichissement qui remplit les dates/diplômes.
        """
        return relevance_issues(
            rejected=self.rejected,
            rejection_reason=self.rejection_reason,
            title=self.title,
            item=self,
        )
