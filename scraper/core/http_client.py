#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scraper/core/http_client.py
  Client HTTP robuste (httpx) avec retry, gestion 403 / Cloudflare, timeouts
===============================================================================
"""

from __future__ import annotations

import os

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from scraper.core.proxy import ProxyManager
from scraper.core.logger import setup_logger

logger = setup_logger("http_client")


class HttpClient:
    def __init__(self, timeout: float = 15.0, use_cache: bool = True, verify_ssl: bool | None = None):
        self.timeout = timeout
        self.proxy_manager = ProxyManager()

        # Cache HTTP conditionnel : stocke ETag/Last-Modified + CORPS DE LA
        # RÉPONSE par URL. Quand un serveur renvoie 304 Not Modified, la
        # réponse HTTP n'a PAS de body : on réinjecte donc le texte/HTML
        # précédemment stocké pour éviter de rendre une page vide.
        self._etag_cache: dict[str, dict] = {}  # url → {etag, last_modified, body, content_type}

        # Vérification TLS : désactivable via l'environnement (certains sites
        # ouest-africains exposent des chaînes de certificats incomplètes).
        if verify_ssl is None:
            verify_ssl = os.getenv("TRAVAILLERENCI_VERIFY_SSL", "1").strip().lower() not in ("0", "false", "no")
        self.verify_ssl = verify_ssl

        self.client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            verify=verify_ssl,
            headers={
                "User-Agent": self.proxy_manager.get_random_user_agent(),
                "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
            }
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.RequestError, httpx.TimeoutException, httpx.HTTPStatusError)),
        reraise=True
    )
    def get(self, url: str) -> httpx.Response:
        headers = {"User-Agent": self.proxy_manager.get_random_user_agent()}

        # Cache HTTP conditionnel : si on a un ETag ou Last-Modified pour
        # cette URL, on ajoute les en-têtes If-None-Match / If-Modified-Since
        # pour éviter de retélécharger une page inchangée (304 Not Modified).
        cached = self._etag_cache.get(url)
        if cached:
            if cached.get("etag"):
                headers["If-None-Match"] = cached["etag"]
            if cached.get("last_modified"):
                headers["If-Modified-Since"] = cached["last_modified"]

        resp = self.client.get(url, headers=headers)

        # 304 Not Modified : la page n'a pas changé mais la réponse n'a PAS
        # de body. On construit une réponse « virtuelle » avec le body
        # précédemment mis en cache (si disponible) pour que l'appelant
        # reçoive un contenu exploitable au lieu d'un texte vide.
        if resp.status_code == 304:
            logger.debug(f"  ↩️ 304 Not Modified : {url}")
            if cached and "body" in cached:
                # Retourne une nouvelle réponse « 200 OK » forgée à partir
                # du body en cache. Les headers de cache originaux sont
                # conservés pour que la détection de blocage fonctionne.
                resp = httpx.Response(
                    status_code=200,
                    headers=dict(resp.headers),
                    content=cached["body"],
                    request=resp.request,
                )
            return resp

        # Mise à jour du cache ETag/Last-Modified + BODY
        etag = resp.headers.get("etag")
        last_modified = resp.headers.get("last-modified")
        if etag or last_modified or cached:
            entry = dict(cached or {})
            entry.update({
                "etag": etag,
                "last_modified": last_modified,
            })
            try:
                entry["body"] = resp.content
                entry["content_type"] = resp.headers.get("content-type", "")
            except Exception:
                pass
            self._etag_cache[url] = entry

        # Blocage RÉEL : status 403/429 OU page « challenge » Cloudflare
        # (« Just a moment… »). La simple présence du mot « cloudflare » dans
        # le HTML n'est PAS un blocage (CDN présent sur beaucoup de sites).
        blocked = (
            resp.status_code in (403, 429)
            or "just a moment" in resp.text[:2000].lower()
            or "attention required!" in resp.text[:2000].lower()
        )
        if blocked:
            logger.warning(f"⚠️ Blocage potentiel ({resp.status_code}) détecté sur {url}")
        resp.raise_for_status()
        return resp

    def close(self):
        try:
            self.client.close()
        except Exception:
            pass
