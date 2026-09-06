"""InstanPay client — QRIS payments via pay.instanlive.id.

Docs: https://pay.instanlive.id/docs
- Auth: X-Api-Key header (sk_test_ = sandbox, sk_live_ = live)
- create: POST /transaction/create {ref_id, amount, description}
- status: GET /transaction/status/{txn_id}   (300 req/min limit — 4s polling safe)
- cancel: POST /transaction/cancel/{txn_id}
- simulate: POST /sandbox/pay/{txn_id}       (sandbox key only)
- webhook: HMAC-SHA256 over payload minus 'signature', keys sorted asc,
           JSON_UNESCAPED_SLASHES|UNESCAPED_UNICODE, keyed with API key
"""
import hashlib
import hmac
import json
import os
import uuid
from typing import Any, Optional

import httpx

BASE_URL = "https://pay.instanlive.id/api/v1"

# Packages: (price_idr, credits, pool_drops)
PACKAGES = {
    "starter": {"amount": 500, "credits": 2, "pool_drops": 1},
    "bundle": {"amount": 10_000, "credits": 50, "pool_drops": 12},
}
CUSTOM_MIN = 500
CUSTOM_MAX = 100_000
CUSTOM_CREDIT_RATE = 250  # Rp 250 per credit
CUSTOM_POOL_RATE = 4      # 1 pool drop per 4 credits


def get_api_key() -> str:
    return os.environ.get("INSTANPAY_API_KEY", "")


def is_sandbox() -> bool:
    return get_api_key().startswith("sk_test_")


def package_for(package: str, custom_amount: Optional[int] = None) -> dict:
    """Resolve package name (+custom nominal) -> {amount, credits, pool_drops} or raises ValueError."""
    if package in PACKAGES:
        return dict(PACKAGES[package])
    if package == "custom":
        amt = int(custom_amount or 0)
        if amt < CUSTOM_MIN or amt > CUSTOM_MAX:
            raise ValueError(f"Custom amount must be Rp {CUSTOM_MIN:,}–{CUSTOM_MAX:,}")
        credits = amt // CUSTOM_CREDIT_RATE
        if credits < 1:
            raise ValueError("Amount too small for credits")
        return {
            "amount": amt,
            "credits": credits,
            "pool_drops": credits // CUSTOM_POOL_RATE,
        }
    raise ValueError("Unknown package")


async def _request(method: str, path: str, json_body: Optional[dict] = None) -> dict:
    """Call InstanPay API. Returns parsed JSON dict. Raises RuntimeError with
    the provider's error field on non-2xx."""
    key = get_api_key()
    if not key:
        raise RuntimeError("Payment gateway not configured")
    headers = {"X-Api-Key": key, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        if method == "GET":
            resp = await client.get(f"{BASE_URL}{path}", headers=headers)
        else:
            resp = await client.post(f"{BASE_URL}{path}", headers=headers, json=json_body or {})
    try:
        data = resp.json()
    except Exception:
        raise RuntimeError(f"Gateway returned non-JSON (HTTP {resp.status_code})")
    if resp.status_code >= 400 or not data.get("ok"):
        err = data.get("error") or f"HTTP {resp.status_code}"
        raise RuntimeError(f"Gateway error: {err}")
    return data.get("data") or {}


async def create_transaction(ref_id: str, amount: int, description: str) -> dict:
    """Create QRIS transaction. Idempotent on ref_id (same ref -> same txn)."""
    return await _request(
        "POST",
        "/transaction/create",
        {"ref_id": ref_id, "amount": amount, "description": description},
    )


async def check_status(txn_id: int) -> dict:
    return await _request("GET", f"/transaction/status/{txn_id}")


async def cancel_transaction(txn_id: int) -> dict:
    return await _request("POST", f"/transaction/cancel/{txn_id}")


async def simulate_pay(txn_id: int) -> dict:
    """Sandbox only — marks txn paid and fires callback."""
    if not is_sandbox():
        raise RuntimeError("Simulate is sandbox-only")
    return await _request("POST", f"/sandbox/pay/{txn_id}")


def verify_webhook_signature(payload_raw: bytes, received_sig: Optional[str]) -> bool:
    """HMAC-SHA256 over payload minus 'signature', keys sorted ascending,
    JSON dumps with unescaped slashes/unicode, keyed with the API key.
    Constant-time compare."""
    if not received_sig:
        return False
    try:
        data = json.loads(payload_raw)
        sig = data.pop("signature", None)
        if sig is None:
            return False
        ordered = {k: data[k] for k in sorted(data.keys())}
        calc = hmac.new(
            get_api_key().encode(),
            json.dumps(ordered, ensure_ascii=False, separators=(",", ":")).encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(calc, sig) and hmac.compare_digest(str(sig), calc)
    except Exception:
        return False


def new_ref_id() -> str:
    return f"SS-{uuid.uuid4().hex[:16]}"
