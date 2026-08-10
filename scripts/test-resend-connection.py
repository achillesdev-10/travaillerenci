#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
  TravaillerEnCi — scripts/test-resend-connection.py
  Diagnostic de l'envoi d'emails Resend (avant de configurer Vercel)

  Vérifie en 1 commande :
    1. que RESEND_API_KEY est présente et acceptée par l'API Resend (401 sinon) ;
    2. que le domaine d'expéditeur (EMAIL_FROM) est VÉRIFIÉ dans Resend
       (403 « domain not verified » sinon — SPF/DKIM à ajouter) ;
    3. que l'envoi d'un email de test aboutit (200) — à recevoir dans la
       boîte de réception (domaine test onboarding@resend.dev : uniquement
       l'adresse du compte Resend).

  Usage :
      RESEND_API_KEY=re_xxx python scripts/test-resend-connection.py --to vous@exemple.com
      RESEND_API_KEY=re_xxx python scripts/test-resend-connection.py --to vous@exemple.com --from "TravaillerEnCi <onboarding@resend.dev>"

  Lit aussi .env.local s'il existe (EMAIL_FROM, NEXT_PUBLIC_SITE_URL).
===============================================================================
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent


def _load_dotenv_local() -> None:
    """Charge .env.local (sans écraser les variables déjà définies)."""
    env_file = PROJECT_ROOT / ".env.local"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def main() -> int:
    _load_dotenv_local()

    parser = argparse.ArgumentParser(description="Diagnostic de l'envoi d'emails Resend")
    parser.add_argument("--to", required=True, help="Adresse de réception du test")
    parser.add_argument("--from", dest="from_addr", help="Expéditeur (défaut : EMAIL_FROM du .env.local ou noreply@travaillerenci.ci)")
    args = parser.parse_args()

    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key:
        print("❌ RESEND_API_KEY absente — définissez-la dans l'environnement ou .env.local.")
        return 1

    from_addr = args.from_addr or os.getenv("EMAIL_FROM") or "TravaillerEnCi <noreply@travaillerenci.ci>"
    sender = re.search(r"<([^>]+)>", from_addr)
    sender_email = sender.group(1) if sender else from_addr
    domain = sender_email.rsplit("@", 1)[-1].lower()

    print(f"▶ Envoi de test vers {args.to}")
    print(f"▶ Expéditeur : {from_addr}")
    print(f"▶ Domaine d'expéditeur : {domain}")
    print()

    payload = {
        "from": from_addr,
        "to": [args.to],
        "subject": "Test TravaillerEnCi — connexion Resend",
        "html": (
            "<div style='font-family:Arial;padding:24px'>"
            "<h2>✅ Email de test TravaillerEnCi</h2>"
            "<p>Si vous recevez cet email, la clé Resend et le domaine d'expéditeur "
            "<strong>fonctionnent</strong>.</p>"
            "</div>"
        ),
    }

    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=30,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"❌ Réseau : {exc}")
        return 1

    body = resp.text[:400]
    if resp.status_code == 200:
        print(f"✅ 200 — Email envoyé. À vérifier dans la boîte de réception ({args.to}, dossier spam inclus).")
        return 0
    if resp.status_code == 401:
        print(f"❌ 401 — Clé API invalide. Recréez-la sur https://resend.com/api-keys")
    elif resp.status_code == 403 and "domain" in body.lower():
        print(
            f"❌ 403 — Domaine « {domain} » NON VÉRIFIÉ dans Resend.\n"
            f"   → Dashboard Resend → Domains → vérifiez « {domain} » (SPF/DKIM).\n"
            f"   → Pour tester immédiatement : --from \"TravaillerEnCi <onboarding@resend.dev>\"."
        )
    elif resp.status_code == 422:
        print(f"❌ 422 — Paramètres de l'email invalides : {body}")
    else:
        print(f"❌ HTTP {resp.status_code} : {body}")
    print("\nDétail de la réponse Resend :")
    print(body)
    return 1


if __name__ == "__main__":
    sys.exit(main())
