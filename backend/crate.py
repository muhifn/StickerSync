"""Crate: per-user sticker collection.

Design:
- crate rows are a wishlist snapshot (url + fallback urls; no author/comment — privacy).
- Ownership is proven by download_log (user previously paid for a sticker).
- Download/Get flow calls is_owned() first -> skip spend_credit when owned.
- Export builds a flat .wastickers zip (author.txt/title.txt/tray.png/webp files)
  charging 1 credit per not-yet-owned sticker; owned ones ride along free.
"""
import io
import zipfile
from datetime import datetime, timezone
from typing import Optional

import db

CRATE_LIMIT = 200


async def crate_count(user_id: str) -> int:
    return await db.fetch_val("SELECT count(*) FROM crate WHERE user_id = $1", user_id)


async def is_owned(user_id: str, sticker_id: str) -> bool:
    """True if this user ever paid a credit for this sticker."""
    n = await db.fetch_val(
        "SELECT count(*) FROM download_log WHERE user_id = $1 AND sticker_id = $2",
        user_id, sticker_id,
    )
    return n > 0


async def crate_add(user_id: str, sticker_id: str, url: str, urls: list[str], is_animated: bool) -> dict:
    """Add sticker snapshot to user's crate. Cap at CRATE_LIMIT."""
    import json as _json
    count = await crate_count(user_id)
    if count >= CRATE_LIMIT:
        return {"ok": False, "error": f"Crate is full ({CRATE_LIMIT} stickers)"}
    existing = await db.fetch_one(
        "SELECT 1 FROM crate WHERE user_id = $1 AND sticker_id = $2", user_id, sticker_id
    )
    if existing:
        return {"ok": True, "duplicate": True}
    await db.execute(
        "INSERT INTO crate (user_id, sticker_id, url, urls, is_animated) VALUES ($1,$2,$3,$4,$5)",
        user_id, sticker_id, url, _json.dumps(urls or [url]), is_animated,
    )
    return {"ok": True}


async def crate_remove(user_id: str, sticker_id: str) -> None:
    await db.execute(
        "DELETE FROM crate WHERE user_id = $1 AND sticker_id = $2", user_id, sticker_id
    )


async def crate_list(user_id: str) -> list[dict]:
    """User's crate with ownership + freshness status.
    fresh = library still has a non-expired URL for re-serve."""
    rows = await db.fetch_all("""
        SELECT c.sticker_id, c.url, c.urls, c.is_animated, c.added_at,
               (l.url_expires_at > now()) AS fresh,
               EXISTS (SELECT 1 FROM download_log d
                       WHERE d.user_id = c.user_id AND d.sticker_id = c.sticker_id) AS owned
        FROM crate c
        LEFT JOIN library l ON l.sticker_id = c.sticker_id
        WHERE c.user_id = $1
        ORDER BY c.added_at DESC
    """, user_id)
    import json as _json
    out = []
    for r in rows:
        try:
            urls = _json.loads(r["urls"])
        except Exception:
            urls = [r["url"]]
        out.append({
            "sticker_id": r["sticker_id"],
            "url": r["url"],
            "urls": urls,
            "is_animated": r["is_animated"],
            "added_at": r["added_at"].isoformat(),
            "fresh": bool(r["fresh"]),
            "owned": bool(r["owned"]),
        })
    return out


async def crate_export(user_id: str, sticker_ids: list[str], fetch_bytes) -> dict:
    """Build a flat .wastickers zip from selected crate stickers.

    fetch_bytes: async callable (sticker_id, urls) -> webp bytes (512x512).
    Charges handled by caller (main.py) BEFORE building:
      - owned sticker -> free
      - new sticker   -> 1 credit via spend_credit
    Returns {"ok": True, "zip": bytes, "charged": n, "free": n} or error dict.
    """
    import json as _json
    rows = await db.fetch_all("""
        SELECT c.sticker_id, c.url, c.urls, c.is_animated
        FROM crate c
        WHERE c.user_id = $1 AND c.sticker_id = ANY($2)
    """, user_id, sticker_ids)
    if len(rows) != len(set(sticker_ids)):
        return {"ok": False, "error": "Some stickers are not in your crate"}

    sticker_files: list[tuple[str, bytes]] = []
    for r in rows:
        try:
            urls = _json.loads(r["urls"]) or [r["url"]]
        except Exception:
            urls = [r["url"]]
        data = await fetch_bytes(r["sticker_id"], urls)
        if data:
            sticker_files.append((r["sticker_id"], data))
    if not sticker_files:
        return {"ok": False, "error": "No stickers could be fetched — links may have expired. Re-scan the video."}

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("author.txt", "StickerSync")
        zf.writestr(
            "title.txt",
            f"StickerSync Hunt {datetime.now(timezone.utc).strftime('%d %b %Y')}",
        )
        for i, (sid, data) in enumerate(sticker_files):
            # Sticker Maker flat format: unix-timestamp-like names
            fname = f"{int(datetime.now().timestamp())}{i}.webp"
            zf.writestr(fname, data)
        # tray icon from first sticker
        tray = _make_tray(sticker_files[0][1])
        if tray:
            zf.writestr("cover.png", tray)
    return {"ok": True, "zip": buf.getvalue()}


def _make_tray(webp_bytes: bytes) -> Optional[bytes]:
    """96x96 PNG tray icon from first frame (reuse of main.make_tray_icon logic)."""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(webp_bytes))
        img.seek(0)
        frame = img.copy().convert("RGBA")
        frame.thumbnail((96, 96), Image.LANCZOS)
        canvas = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
        canvas.paste(frame, ((96 - frame.width) // 2, (96 - frame.height) // 2), frame)
        out = io.BytesIO()
        canvas.save(out, format="PNG")
        return out.getvalue()
    except Exception:
        return None
