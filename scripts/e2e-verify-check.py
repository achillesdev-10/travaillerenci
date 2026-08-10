"""E2E check: verification email link (local dev server).

Genere un jeton comme le ferait l'app (sha256), l'insere en base, appelle
GET /api/auth/verify-email?token=..., puis controle email_verified en base.
"""
import hashlib
import json
import os
import secrets
import sqlite3
import sys
import urllib.parse
import urllib.request

DB = os.environ.get("SQLITE_DB", "data/travaillerenci.sqlite3")
EMAIL = os.environ.get("TEST_EMAIL", "achillesdev10@gmail.com")
BASE = os.environ.get("APP_BASE", "http://localhost:3000")

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
row = conn.execute("SELECT id, email, email_verified FROM users WHERE email=?", (EMAIL,)).fetchone()
if row is None:
    print("UTILISATEUR INTROUVABLE:", EMAIL)
    sys.exit(1)

uid = row["id"]
print("UTILISATEUR:", dict(row))

# 1. Generer + inserer un jeton (meme logique que createEmailVerificationToken)
token = secrets.token_hex(32)
token_hash = hashlib.sha256(token.encode()).hexdigest()
expires_at = "2026-08-11T23:59:59.000Z"
conn.execute(
    "INSERT INTO verify_email_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    (token_hash, uid, expires_at),
)
conn.commit()

# 2. Appeler l'endpoint de verification
url = f"{BASE}/api/auth/verify-email?token={urllib.parse.quote(token)}"
try:
    with urllib.request.urlopen(url, timeout=120) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        print("VERIFY HTTP", resp.status)
        print("BODY:", body[:500])
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8", errors="replace")
    print("VERIFY HTTP", e.code)
    print("BODY:", body[:500])
except Exception as e:
    print("VERIFY EXC:", type(e).__name__, str(e)[:300])

# 3. Controle en base
row2 = conn.execute(
    "SELECT email_verified FROM users WHERE id=?", (uid,)
).fetchone()
print("EMAIL_VERIFIED APRES:", row2["email_verified"] if row2 else "n/a")
conn.close()
