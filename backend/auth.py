"""JWT auth — self-signed HS256 tokens (native email+password auth).

Flow: client POST /auth/login -> user_id -> client stores token
(stamped by server with our JWT_SECRET). Server verifies on every request.
"""
import os
import time
from typing import Optional

import jwt

_secret: Optional[str] = None


def set_jwt_secret(secret: str) -> None:
    global _secret
    _secret = secret


def get_jwt_secret() -> Optional[str]:
    global _secret
    if _secret is None:
        _secret = os.environ.get("JWT_SECRET", "")
    return _secret


def make_token(user_id: str, ttl_hours: int = 24 * 30) -> str:
    """Create a signed token for a user."""
    now = int(time.time())
    payload = {"sub": user_id, "iat": now, "exp": now + ttl_hours * 3600}
    return jwt.encode(payload, get_jwt_secret(), algorithm="HS256")


# L1 cache: verified user_id -> cache_until (60s positive cache, no re-verify)
_verified_cache: dict[str, float] = {}
_CACHE_TTL = 60.0


def verify_token(token: str) -> Optional[dict]:
    """Verify our self-signed token. Returns payload with `sub` or None."""
    secret = get_jwt_secret()
    if not secret or not token:
        return None
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except Exception:
        return None

    sub = payload.get("sub")
    if not sub:
        return None

    now = time.time()
    if now < _verified_cache.get(sub, 0):
        return payload
    _verified_cache[sub] = now + _CACHE_TTL

    if len(_verified_cache) > 10_000:
        for k in [k for k, v in _verified_cache.items() if v < now]:
            _verified_cache.pop(k, None)

    return payload
