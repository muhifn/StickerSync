"""Library persistence (L2 cache) + URL expiry parsing + upsert helpers."""
import json
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import parse_qs, urlparse

import db

# URL validity: TikTok signed URLs (x-expires) live ~30 days; default assumption
_DEFAULT_VALIDITY = timedelta(days=25)


def parse_url_expiry(url: str) -> Optional[datetime]:
    """Extract x-expires (unix ts) from a signed CDN URL."""
    try:
        qs = parse_qs(urlparse(url).query)
        exp = qs.get("x-expires", [None])[0]
        if exp:
            return datetime.fromtimestamp(int(exp), tz=timezone.utc)
    except Exception:
        return None
    return None


async def library_upsert(stickers: list[dict], video_id: str) -> None:
    """Background job: persist scanned stickers into library (L2 cache)."""
    if not stickers:
        return
    rows = []
    for s in stickers:
        exp = parse_url_expiry(s.get("url", "")) or (
            datetime.now(timezone.utc) + _DEFAULT_VALIDITY
        )
        rows.append((
            s["id"],
            video_id,
            s.get("comment_text", "") or "",
            s.get("author_uid", "") or "",
            s.get("url", ""),
            json.dumps(s.get("urls", [])),
            s.get("width", 0) or 0,
            s.get("height", 0) or 0,
            s.get("is_animated", True),
            exp,
        ))
    try:
        await db.execute("""
            INSERT INTO library
                (sticker_id, video_id, comment_text, author_uid, url, urls,
                 width, height, is_animated, url_expires_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (sticker_id) DO UPDATE SET
                video_id = EXCLUDED.video_id,
                comment_text = EXCLUDED.comment_text,
                author_uid = EXCLUDED.author_uid,
                url = EXCLUDED.url,
                urls = EXCLUDED.urls,
                width = EXCLUDED.width,
                height = EXCLUDED.height,
                is_animated = EXCLUDED.is_animated,
                url_expires_at = EXCLUDED.url_expires_at
        """, *rows[0])
        # batch remaining rows individually (small n per scan)
        for r in rows[1:]:
            await db.execute("""
                INSERT INTO library
                    (sticker_id, video_id, comment_text, author_uid, url, urls,
                     width, height, is_animated, url_expires_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                ON CONFLICT (sticker_id) DO UPDATE SET
                    video_id = EXCLUDED.video_id,
                    comment_text = EXCLUDED.comment_text,
                    author_uid = EXCLUDED.author_uid,
                    url = EXCLUDED.url,
                    urls = EXCLUDED.urls,
                    width = EXCLUDED.width,
                    height = EXCLUDED.height,
                    is_animated = EXCLUDED.is_animated,
                    url_expires_at = EXCLUDED.url_expires_at
            """, *r)
    except Exception as e:
        print(f"[library_upsert] failed: {e}", flush=True)


async def library_get_cached(sticker_id: str) -> Optional[dict]:
    """Get a sticker's URL list from library if not expired (L2 hit)."""
    row = await db.fetch_one(
        "SELECT urls, url FROM library WHERE sticker_id = $1 AND url_expires_at > now()",
        sticker_id,
    )
    if not row:
        return None
    try:
        urls = json.loads(row["urls"])
        if urls:
            return {"urls": urls}
    except Exception:
        pass
    return {"urls": [row["url"]]} if row["url"] else None


async def log_download(user_id: str, sticker_id: str, source: str) -> None:
    """Background job: audit trail + trending foundation."""
    try:
        await db.execute(
            "INSERT INTO download_log (user_id, sticker_id, source) VALUES ($1,$2,$3)",
            user_id, sticker_id, source,
        )
        await db.execute(
            "UPDATE library SET download_count = download_count + 1 WHERE sticker_id = $1",
            sticker_id,
        )
    except Exception as e:
        print(f"[log_download] failed: {e}", flush=True)


async def cleanup_expired() -> int:
    """Daily sweep: delete library rows whose URL signature expired."""
    try:
        r = await db.execute("DELETE FROM library WHERE url_expires_at < now()")
        # asyncpg execute returns "DELETE n"
        m = re.search(r"DELETE (\d+)", r or "")
        return int(m.group(1)) if m else 0
    except Exception as e:
        print(f"[cleanup_expired] failed: {e}", flush=True)
        return 0
