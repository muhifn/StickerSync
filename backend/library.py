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


async def log_view(sticker_id: str) -> None:
    """Background job: anonymous view event + library popularity bump."""
    try:
        await db.execute(
            "INSERT INTO view_log (sticker_id) VALUES ($1)",
            sticker_id,
        )
        await db.execute(
            "UPDATE library SET view_count = view_count + 1, last_viewed_at = now() WHERE sticker_id = $1",
            sticker_id,
        )
    except Exception as e:
        print(f"[log_view] failed: {e}", flush=True)


async def trending_stickers(limit: int = 12) -> list[dict]:
    """Trending: views_72h + downloads_72h*3, only non-expired URLs."""
    rows = await db.fetch_all("""
        SELECT l.sticker_id, l.comment_text, l.author_uid, l.url,
               l.is_animated, l.download_count, l.view_count,
               COALESCE(v.cnt, 0)  AS views_72h,
               COALESCE(d.cnt, 0)  AS downloads_72h,
               COALESCE(v.cnt, 0) + COALESCE(d.cnt, 0) * 3 AS score
        FROM library l
        LEFT JOIN (SELECT sticker_id, count(*) cnt FROM view_log
                   WHERE created_at > now() - interval '72 hours' GROUP BY sticker_id) v
            ON v.sticker_id = l.sticker_id
        LEFT JOIN (SELECT sticker_id, count(*) cnt FROM download_log
                   WHERE created_at > now() - interval '72 hours' GROUP BY sticker_id) d
            ON d.sticker_id = l.sticker_id
        WHERE l.url_expires_at > now()
        ORDER BY score DESC, l.created_at DESC
        LIMIT $1
    """, limit)
    return [dict(r) for r in rows]


async def library_page(
    q: str = "", sort: str = "trending", page: int = 1, per_page: int = 24
) -> tuple[list[dict], int]:
    """Public browse: FTS search + sort (trending/recent/downloads) + pagination."""
    where = "url_expires_at > now()"
    args: list = []
    if q:
        args.append(q)
        where += f" AND to_tsvector('simple', comment_text) @@ plainto_tsquery('simple', ${len(args)})"

    order = {
        "trending": "view_count + download_count * 3 DESC, created_at DESC",
        "recent": "created_at DESC",
        "downloads": "download_count DESC, created_at DESC",
    }.get(sort, "view_count + download_count * 3 DESC, created_at DESC")

    total = await db.fetch_val(f"SELECT count(*) FROM library WHERE {where}", *args)
    offset = (page - 1) * per_page
    args2 = args + [per_page, offset]
    rows = await db.fetch_all(f"""
        SELECT sticker_id, comment_text, author_uid, url, is_animated,
               download_count, view_count, created_at
        FROM library
        WHERE {where}
        ORDER BY {order}
        LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}
    """, *args2)
    return [dict(r) for r in rows], total


async def sweep_stale(days: int = 3) -> int:
    """Remove library rows with no engagement for `days` days (live-watch TTL)."""
    try:
        r = await db.execute(
            "DELETE FROM library WHERE last_viewed_at < now() - make_interval(days => $1)",
            days,
        )
        m = re.search(r"DELETE (\d+)", r or "")
        return int(m.group(1)) if m else 0
    except Exception as e:
        print(f"[sweep_stale] failed: {e}", flush=True)
        return 0


async def prune_view_log(days: int = 7) -> int:
    """Keep view_log small: drop events older than `days`."""
    try:
        r = await db.execute(
            "DELETE FROM view_log WHERE created_at < now() - make_interval(days => $1)",
            days,
        )
        m = re.search(r"DELETE (\d+)", r or "")
        return int(m.group(1)) if m else 0
    except Exception as e:
        print(f"[prune_view_log] failed: {e}", flush=True)
        return 0


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
