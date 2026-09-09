"""BYO TikTok session — users may link their own logged-in TikTok cookie
to unlock stickers TikTok hides from anonymous viewers.

Research verdict (2026-09): comment sticker payloads (image_list /
cmt_sticker_struct) are login-gated by TikTok server-side. Anonymous scans
(dual-aid httpx, attested Chromium via Playwright, even paid TikHub with its
session pool) all receive image_list=null for [Sticker] comments. Only a
logged-in session sees the media. This module stores a user's OWN cookie,
encrypted at rest, and exposes it to the scan engine on demand.

Security notes:
- AES-256-GCM encryption at rest, key from SESSION_ENC_KEY env.
- Cookie is NEVER returned to any client — only its status.
- Cookie is only used server-side for TikTok comment fetches.
- Validation hits TikTok's own user-info endpoint (cheap, definitive).
"""
import base64
import hashlib
import os
import secrets
import time
from typing import Optional

import httpx

import db

TIKTOK_USER_INFO = "https://www.tiktok.com/passport/web/account/info/"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

# ---- AES-256-GCM at rest (stdlib only: cryptography lib not in requirements) ----
# Implemented via Fernet would need `cryptography`; backend requirements use
# stdlib-only crypto primitives here: XOR-stream is NOT acceptable, so we use
# hashlib-based key derivation + `cryptography` if present, else refuse to store.
# => We keep it honest: if `cryptography` is unavailable, endpoints return 503.


def _enc_key() -> bytes:
    raw = os.environ.get("SESSION_ENC_KEY", "")
    if not raw:
        raise RuntimeError("SESSION_ENC_KEY not configured")
    return hashlib.sha256(raw.encode()).digest()  # 32 bytes


def encrypt_cookie(cookie: str) -> str:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce = secrets.token_bytes(12)
    aes = AESGCM(_enc_key())
    ct = aes.encrypt(nonce, cookie.encode(), None)
    return base64.urlsafe_b64encode(nonce + ct).decode()


def decrypt_cookie(enc: str) -> str:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    blob = base64.urlsafe_b64decode(enc)
    nonce, ct = blob[:12], blob[12:]
    aes = AESGCM(_enc_key())
    return aes.decrypt(nonce, ct, None).decode()


# ---- validation ----

def _extract_sessionid(cookie: str) -> Optional[str]:
    for part in cookie.split(";"):
        k, _, v = part.strip().partition("=")
        if k == "sessionid":
            v = v.strip()
            return v if v else None
    return None


async def validate_cookie(cookie: str) -> dict:
    """Validate against TikTok's account-info endpoint.
    Returns {"ok": bool, "username": str?, "reason": str?}."""
    sid = _extract_sessionid(cookie)
    if not sid:
        return {"ok": False, "reason": "Cookie must contain a sessionid value"}
    if len(sid) < 20 or len(sid) > 512:
        return {"ok": False, "reason": "sessionid looks invalid"}
    headers = {"User-Agent": UA, "Cookie": cookie.strip()}
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(TIKTOK_USER_INFO, headers=headers)
        if r.status_code != 200:
            return {"ok": False, "reason": f"TikTok rejected the session (HTTP {r.status_code})"}
        d = r.json()
        data = d.get("Data") or {}
        if d.get("code", -1) == 10000 and (data.get("email") or data.get("username")):
            return {
                "ok": True,
                "username": data.get("username") or data.get("email"),
                "screen_name": data.get("screen_name") or "",
            }
        return {"ok": False, "reason": "Session expired or invalid"}
    except Exception as e:
        return {"ok": False, "reason": f"Could not reach TikTok ({type(e).__name__})"}


# ---- DB CRUD (table: tiktok_session) ----

async def save(uid: str, cookie: str, username: str) -> None:
    enc = encrypt_cookie(cookie)
    await db.execute(
        """
        INSERT INTO tiktok_session (uid, enc_cookie, status, username, updated_at)
        VALUES ($1, $2, 'active', $3, now())
        ON CONFLICT (uid) DO UPDATE SET
            enc_cookie = EXCLUDED.enc_cookie,
            status = 'active',
            username = EXCLUDED.username,
            updated_at = now()
        """,
        uid, enc, username,
    )


async def get_active(uid: str) -> Optional[dict]:
    row = await db.fetch_one(
        "SELECT enc_cookie, username, updated_at FROM tiktok_session "
        "WHERE uid = $1 AND status = 'active'",
        uid,
    )
    if not row:
        return None
    try:
        return {
            "cookie": decrypt_cookie(row["enc_cookie"]),
            "username": row["username"],
            "updated_at": row["updated_at"],
        }
    except Exception:
        return None


async def mark_dead(uid: str) -> None:
    """Session rejected mid-scan — mark so we stop using it until re-linked."""
    await db.execute(
        "UPDATE tiktok_session SET status = 'dead' WHERE uid = $1", uid
    )


async def remove(uid: str) -> None:
    await db.execute("DELETE FROM tiktok_session WHERE uid = $1", uid)


async def touch_last_used(uid: str) -> None:
    await db.execute(
        "UPDATE tiktok_session SET last_used_at = now() WHERE uid = $1", uid
    )
