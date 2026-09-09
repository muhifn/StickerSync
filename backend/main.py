import asyncio
import io
import json
import re
import time
import uuid
import zipfile
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from urllib.parse import parse_qs, urlparse

import httpx
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from PIL import Image
from pydantic import BaseModel

import auth
import crate as crate_mod
import db
import library as lib
import payments as pay_mod
import tiktok_session as tsession

app = FastAPI(title="StickerSync API", version="4.0.0")

# CORS: strict origin allowlist (no wildcard). Set ALLOWED_ORIGINS env for extra origins.
_origins = [
    o.strip() for o in _env_cors.split(",") if o.strip()
] if (_env_cors := __import__("os").environ.get("ALLOWED_ORIGINS", "")) else []
if not _origins:
    _origins = ["https://stickersync.vercel.app", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

TIKTOK_COMMENT_API = "https://www.tiktok.com/api/comment/list/"
TIKTOK_REPLY_API = "https://www.tiktok.com/api/comment/list/reply/"
TIKTOK_OEMBED = "https://www.tiktok.com/oembed"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
USER_AGENT_ALT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)
# Maximum-reliability scan engine: sequential pages, generous retries with
# UA rotation (TikTok soft-blocks datacenter IPs intermittently).
# Dual-aid scan (Phase 1): aid=1988 returns comment payloads (sticker structs),
# aid=1180/1233 returns a WIDER comment set but strips media payloads and marks
# visual comments via text instead ("[Sticker] " prefix / " [Photo]" suffix).
# We union both: 1988 versions win (payloads), 1180 gives detection coverage.
SCAN_AIDS = (1988, 1180)
PAGE_ATTEMPTS = 4          # attempts per page: UA rotation below (same aid)
PAGE_RETRY_DELAYS = [0.4, 0.8, 1.6]   # seconds before attempts 2/3/4
PAGE_GAP = 0.25            # pause between sequential pages (be kind to TikTok)
MAX_COMMENT_PAGES = 60     # hard cap: 60*50 = 3000 top-level comments per video
MAX_REPLY_THREADS = 150    # hard cap: reply threads scanned per video
REPLY_CONCURRENCY = 2      # conservative parallelism for reply threads
SCAN_CACHE_TTL = 90        # seconds — repeated scans of the same video are served
UA_ROTATION: list[Optional[str]] = [
    None,            # None = client default (desktop)
    USER_AGENT_ALT,  # mobile Safari
    None,
    USER_AGENT_ALT,
]

http_client: Optional[httpx.AsyncClient] = None
resize_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="resize")

# L1 caches (per worker process)
_lru_cache: dict[str, tuple[bytes, float]] = {}  # sticker_id -> (processed_webp, ts)
_LRU_MAX_BYTES = 50 * 1024 * 1024
_LRU_TTL = 30 * 60

# rate limit: token bucket per IP — 6 scans/min
_rate_buckets: dict[str, tuple[float, float]] = {}  # ip -> (tokens, last_refill)
_RATE_CAPACITY = 6.0
_RATE_REFILL = 0.1  # tokens per second


def get_client() -> httpx.AsyncClient:
    global http_client
    if http_client is None or http_client.is_closed:
        http_client = httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=False,
            # rolling parallel batches need a few more concurrent sockets
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            headers={"User-Agent": USER_AGENT},
        )
    return http_client


@app.on_event("startup")
async def startup() -> None:
    await db.init_pool()
    import os as _os
    secret = _os.environ.get("JWT_SECRET", "")
    if secret:
        auth.set_jwt_secret(secret)


@app.on_event("shutdown")
async def shutdown() -> None:
    if http_client and not http_client.is_closed:
        await http_client.aclose()
    resize_pool.shutdown(wait=False)
    await db.close_pool()


security = HTTPBearer(auto_error=False)


def current_user(cred: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Require a valid Supabase JWT. Returns payload with `sub` = user id."""
    if cred is None:
        raise HTTPException(status_code=401, detail="Login required")
    payload = auth.verify_token(cred.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return payload


def rate_limit_scan(ip: str) -> None:
    now = time.time()
    tokens, last = _rate_buckets.get(ip, (_RATE_CAPACITY, now))
    tokens = min(_RATE_CAPACITY, tokens + (now - last) * _RATE_REFILL)
    if tokens < 1.0:
        raise HTTPException(status_code=429, detail="Too many scans — wait a moment")
    _rate_buckets[ip] = (tokens - 1.0, now)
    # prune
    if len(_rate_buckets) > 50_000:
        cutoff = now - 120
        for k in [k for k, v in _rate_buckets.items() if v[1] < cutoff]:
            _rate_buckets.pop(k, None)


# ---- Security helpers: SSRF guard, id sanitization, more rate limits ----

# sticker ids are TikTok numeric ids (or our safe tokens) — keep strict
_STICKER_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def sanitize_sticker_id(sticker_id: str) -> str:
    """Reject ids that could smuggle header/SQL/path tricks."""
    if not _STICKER_ID_RE.match(sticker_id):
        raise HTTPException(status_code=400, detail="Invalid sticker id")
    return sticker_id


# hosts the sticker downloader is allowed to fetch from (TikTok CDN family)
_ALLOWED_FETCH_HOSTS = (
    "tiktokcdn.com",
    "tiktokcdn-us.com",
    "tiktokcdn-eu.com",
    "tiktok.com",
    "ibyteimg.com",
    "ipstatp.com",
    "byteoversea.com",
    "muscdn.com",
    "musical.ly",
    "tiktokv.com",
)

import ipaddress as _ipa


def _host_allowed(hostname: str) -> bool:
    """Allow only known TikTok CDN domains; block raw IPs (SSRF guard)."""
    if not hostname:
        return False
    h = hostname.lower().rstrip(".")
    # block IP-literal hosts (cloud metadata, internal ranges)
    try:
        _ipa.ip_address(h)
        return False
    except ValueError:
        pass
    return h == _ALLOWED_FETCH_HOSTS[0] or any(
        h == d or h.endswith("." + d) for d in _ALLOWED_FETCH_HOSTS
    )


def validate_fetch_urls(urls: list[str]) -> list[str]:
    """SSRF guard: only TikTok CDN URLs pass; scheme must be https."""
    out = []
    for u in urls or []:
        try:
            p = urlparse(u)
        except Exception:
            continue
        if p.scheme != "https":
            continue
        if _host_allowed(p.hostname or ""):
            out.append(u)
    if not out:
        raise HTTPException(
            status_code=400,
            detail="Sticker URL is not from an allowed CDN — re-scan the video.",
        )
    return out


# rate limit: auth endpoints (brute-force guard) — 10 req/min per IP
_auth_buckets: dict[str, tuple[float, float]] = {}


def rate_limit_auth(ip: str) -> None:
    now = time.time()
    tokens, last = _auth_buckets.get(ip, (10.0, now))
    tokens = min(10.0, tokens + (now - last) * (10.0 / 60.0))
    if tokens < 1.0:
        raise HTTPException(status_code=429, detail="Too many attempts — wait a minute")
    _auth_buckets[ip] = (tokens - 1.0, now)
    if len(_auth_buckets) > 50_000:
        cutoff = now - 120
        for k in [k for k, v in _auth_buckets.items() if v[1] < cutoff]:
            _auth_buckets.pop(k, None)


# rate limit: downloads (credit endpoint) — 12/min per IP
_dl_buckets: dict[str, tuple[float, float]] = {}


def rate_limit_download(ip: str) -> None:
    now = time.time()
    tokens, last = _dl_buckets.get(ip, (12.0, now))
    tokens = min(12.0, tokens + (now - last) * 0.2)
    if tokens < 1.0:
        raise HTTPException(status_code=429, detail="Too many downloads — slow down")
    _dl_buckets[ip] = (tokens - 1.0, now)
    if len(_dl_buckets) > 50_000:
        cutoff = now - 120
        for k in [k for k, v in _dl_buckets.items() if v[1] < cutoff]:
            _dl_buckets.pop(k, None)


def require_cron_secret(request: Request) -> None:
    """Protect destructive maintenance endpoints (cleanup sweeps)."""
    secret = __import__("os").environ.get("CRON_SECRET", "")
    provided = request.headers.get("x-cron-secret", "")
    if not secret or provided != secret:
        raise HTTPException(status_code=403, detail="Forbidden")


class FetchRequest(BaseModel):
    url: str
    username: Optional[str] = None


async def resolve_short_link(url: str) -> str:
    parsed = urlparse(url)
    if parsed.hostname in ("vt.tiktok.com", "vm.tiktok.com", "t.tiktok.com"):
        client = get_client()
        for _ in range(5):
            resp = await client.get(url)
            location = resp.headers.get("location")
            if not location:
                break
            url = location
            if urlparse(url).hostname not in ("vt.tiktok.com", "vm.tiktok.com", "t.tiktok.com"):
                break
    return url


def extract_video_id(url: str) -> Optional[str]:
    patterns = [
        r"/video/(\d+)",
        r"/v/(\d+)",
        r"item_id=(\d+)",
        r"share_item_id=(\d+)",
        r"aweme_id=(\d+)",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    if re.match(r"^\d{15,25}$", url.strip()):
        return url.strip()
    return None


async def _fetch_page_with_retry(
    video_id: str, cursor: int, api: str,
    comment_id: Optional[str] = None, aid: int = 1988,
    cookie: Optional[str] = None,
) -> Optional[dict]:
    """Fetch one comment/reply page with up to PAGE_ATTEMPTS tries, rotating
    User-Agent within the same aid. Returns parsed dict, or None if every
    attempt failed (exception / non-200 / broken JSON).
    With `cookie` (user's own logged-in session), media payloads are
    included by TikTok for comments anonymous scans see stripped."""
    client = get_client()
    for attempt, ua in enumerate(UA_ROTATION[:PAGE_ATTEMPTS]):
        if attempt > 0:
            await asyncio.sleep(PAGE_RETRY_DELAYS[attempt - 1])
        headers = {}
        if ua:
            headers["User-Agent"] = ua
        if cookie:
            headers["Cookie"] = cookie
        params: dict = {"aid": aid, "count": 50, "cursor": cursor}
        if api == TIKTOK_REPLY_API:
            params["item_id"] = video_id
            params["comment_id"] = comment_id
        else:
            params["aweme_id"] = video_id
        try:
            resp = await client.get(api, params=params, headers=headers)
            if resp.status_code != 200:
                continue
            return resp.json()
        except Exception:
            continue
    return None


async def video_exists(video_id: str) -> bool:
    """Cheap existence check via TikTok oEmbed (public, separate from the
    comment API quota). Distinguishes 'video gone' from 'throttled'."""
    client = get_client()
    try:
        resp = await client.get(
            TIKTOK_OEMBED, params={"url": f"https://www.tiktok.com/@x/video/{video_id}"}
        )
        return resp.status_code == 200
    except Exception:
        return False


class ScanThrottled(Exception):
    """TikTok returned empty pages across ALL fingerprints — soft rate-limit."""


async def fetch_comments_sequential(
    video_id: str, aid: int = 1988, cookie: Optional[str] = None
) -> list[dict]:
    """Maximum-reliability top-level scan: strictly sequential pages with
    PAGE_GAP pacing, per-page retried fetches. Stops only on
    has_more == 0, two consecutive fully-failed pages, or the page cap.
    Raises ScanThrottled if page 0 stays empty after every retry (and the
    video itself exists) — the caller maps that to a 503, not a misleading 404."""
    comments: list[dict] = []
    consecutive_dead = 0
    pages_fetched = 0
    cursor = 0

    while pages_fetched < MAX_COMMENT_PAGES:
        page = await _fetch_page_with_retry(
            video_id, cursor, TIKTOK_COMMENT_API, aid=aid, cookie=cookie
        )
        pages_fetched += 1

        if page is None:
            consecutive_dead += 1
            if pages_fetched == 1:
                # page 0 unfetchable across all fingerprints: throttle vs gone video
                if await video_exists(video_id):
                    raise ScanThrottled()
                raise ScanThrottled()  # caller also treats as throttle — honest retry msg
            if consecutive_dead >= 2:
                break  # TikTok is pushing back hard mid-scan — keep what we have
            cursor += 50
            continue

        batch = page.get("comments") or []
        comments.extend(batch)
        if batch:
            consecutive_dead = 0
        elif pages_fetched > 1:
            # empty page that DID respond — could be throttle shadow or true end;
            # only trust it as the end when the API says so
            consecutive_dead += 1
            if consecutive_dead >= 2 and not page.get("has_more"):
                break

        if not page.get("has_more"):
            break
        cursor += 50
        await asyncio.sleep(PAGE_GAP)

    # dedup by cid — TikTok's dynamic sort overlaps pages
    seen: set[int] = set()
    deduped: list[dict] = []
    for c in comments:
        cid = c.get("cid")
        if cid in seen:
            continue
        seen.add(cid)
        deduped.append(c)
    return deduped


async def fetch_reply_comments(
    video_id: str, top_comments: list[dict], aid: int = 1988,
    cookie: Optional[str] = None,
) -> list[dict]:
    """Fetch replies for every top-level thread that declares replies.
    item_id + comment_id params are required (without item_id the API returns
    an empty list even when replies exist). Concurrency-limited to
    REPLY_CONCURRENCY with the same per-page retries.
    Dedup by cid across threads."""
    threads = [c for c in top_comments if c.get("reply_comment_total", 0) > 0]
    threads = threads[:MAX_REPLY_THREADS]

    sem = asyncio.Semaphore(REPLY_CONCURRENCY)
    replies: list[dict] = []

    async def thread_replies(cid: str):
        cursor = 0
        while True:
            async with sem:
                page = await _fetch_page_with_retry(
                    video_id, cursor, TIKTOK_REPLY_API, comment_id=cid,
                    aid=aid, cookie=cookie,
                )
            if page is None:
                return  # thread unreachable — skip, don't fail the scan
            batch = page.get("comments") or []
            if not batch:
                return
            replies.extend(batch)
            if not page.get("has_more"):
                return
            cursor += 50
            await asyncio.sleep(PAGE_GAP)

    await asyncio.gather(*[thread_replies(c["cid"]) for c in threads if c.get("cid")])

    seen: set[int] = set()
    deduped: list[dict] = []
    for rp in replies:
        cid = rp.get("cid")
        if cid in seen:
            continue
        seen.add(cid)
        deduped.append(rp)
    return deduped


def _photo_comment_sticker(c: dict) -> Optional[dict]:
    """TikTok has a SECOND visual comment type: photo comments (image_list).
    Users treat these images as 'stickers' just like official pack stickers —
    extract them with the same shape as cmt_sticker_struct results."""
    il = c.get("image_list") or []
    if not il:
        return None
    img = il[0]
    origin = img.get("origin_url") or img.get("crop_url") or {}
    urls = origin.get("url_list") or []
    if not urls:
        return None
    # prefer jpeg origin urls (full-size), dedup by uri
    sid = f"photo_{origin.get('uri', '') or urls[0][-40:]}"
    return {
        "id": sid,
        "name": "Photo sticker",
        "width": origin.get("width", 0) or img.get("crop_url", {}).get("width", 0),
        "height": origin.get("height", 0) or img.get("crop_url", {}).get("height", 0),
        "is_animated": False,  # photo comments are static images
        "url": urls[0],
        "urls": urls,
    }


def extract_stickers(comments: list[dict], username: Optional[str] = None) -> list[dict]:
    seen = set()
    stickers = []
    username_lower = username.strip().lstrip("@").lower() if username else None

    def match_user(c: dict) -> bool:
        if not username_lower:
            return True
        user = c.get("user", {})
        return (
            username_lower == user.get("unique_id", "").lower()
            or username_lower in user.get("nickname", "").lower()
        )

    for c in comments:
        entry: Optional[dict] = None

        struct = c.get("cmt_sticker_struct")
        if struct:
            if not match_user(c):
                continue
            sid = struct.get("id", "")
            if sid in seen:
                continue
            animated = struct.get("animated_url", {})
            static = struct.get("static_url", {})
            high = animated.get("high_resolution_url") or static.get("high_resolution_url") or {}
            urls = high.get("url_list", [])
            if not urls:
                continue
            seen.add(sid)
            entry = {
                "id": sid,
                "name": struct.get("name", "") or f"Sticker {sid[-6:]}",
                "width": high.get("width", 0),
                "height": high.get("height", 0),
                "is_animated": bool(animated.get("high_resolution_url")),
                "url": urls[0],
                "urls": urls,
            }
        else:
            # photo comments (image_list) — same treatment, same user filter
            if not match_user(c):
                continue
            photo = _photo_comment_sticker(c)
            if not photo or photo["id"] in seen:
                continue
            seen.add(photo["id"])
            entry = photo

        if entry:
            stickers.append(entry)
    return stickers


@app.get("/")
async def root():
    return {"status": "ok", "service": "StickerSync API v4"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/pool")
async def world_pool():
    """Current world pool balance (frontend polls this as Realtime fallback)."""
    pool = await db.fetch_val("SELECT pool FROM world_pool WHERE id = 1")
    return {"pool": pool}


def _resize_in_thread(data: bytes) -> bytes:
    """CPU-bound: resize animated WebP to 512x512 (adaptive quality)."""
    img = Image.open(io.BytesIO(data))
    target = 512
    frames = []
    durations = []
    try:
        while True:
            frame = img.copy().convert("RGBA")
            frame.thumbnail((target, target), Image.LANCZOS)
            canvas = Image.new("RGBA", (target, target), (0, 0, 0, 0))
            offset = ((target - frame.width) // 2, (target - frame.height) // 2)
            canvas.paste(frame, offset, frame)
            frames.append(canvas)
            durations.append(img.info.get("duration", 100))
            img.seek(img.tell() + 1)
    except EOFError:
        pass

    # adaptive: heavy animations encode with faster method
    method = 6 if len(frames) <= 30 else 4
    quality = 80 if len(frames) <= 30 else 70

    if len(frames) == 1:
        buf = io.BytesIO()
        frames[0].save(buf, format="WEBP", quality=85, method=6)
        return buf.getvalue()

    def encode(q: int, m: int) -> bytes:
        buf = io.BytesIO()
        frames[0].save(
            buf, format="WEBP", save_all=True, append_images=frames[1:],
            duration=durations, loop=0, quality=q, method=m,
        )
        return buf.getvalue()

    result = encode(quality, method)
    if len(result) > 500 * 1024:
        result = encode(max(quality - 20, 40), method)
    return result


async def download_and_process(urls: list[str]) -> bytes:
    """Download raw WebP (fallback URLs) then resize in thread pool (non-blocking)."""
    client = get_client()
    last_err = None
    for url in urls:
        try:
            dl = httpx.AsyncClient(timeout=15.0, headers={"User-Agent": USER_AGENT})
            resp = await dl.get(url)
            await dl.aclose()
            resp.raise_for_status()
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(resize_pool, _resize_in_thread, resp.content)
        except Exception as e:
            last_err = e
            continue
    raise last_err or RuntimeError("No URLs available")


def lru_get(sticker_id: str) -> Optional[bytes]:
    entry = _lru_cache.get(sticker_id)
    if not entry:
        return None
    data, ts = entry
    if time.time() - ts > _LRU_TTL:
        _lru_cache.pop(sticker_id, None)
        return None
    return data


def lru_put(sticker_id: str, data: bytes) -> None:
    _lru_cache[sticker_id] = (data, time.time())
    # simple size guard: drop oldest when oversized
    while len(_lru_cache) > 512:
        oldest = min(_lru_cache, key=lambda k: _lru_cache[k][1])
        _lru_cache.pop(oldest, None)


# scan result cache: (video_id, username) -> (ts, result) — repeated scans
# of the same video within TTL are instant and don't hammer TikTok
_scan_cache: dict[tuple, tuple[float, dict]] = {}


def _visual_marker(c: dict) -> Optional[str]:
    """Detect visual comments in payload-stripped (aid=1180) responses.
    TikTok marks them via text: '[Sticker] ...' prefix for pack stickers,
    '... [Photo]' suffix for photo comments. Returns 'sticker' / 'photo' / None."""
    t = c.get("text") or ""
    if t.startswith("[Sticker] "):
        return "sticker"
    if t.endswith(" [Photo]"):
        return "photo"
    return None


def _merge_comments(primary: list[dict], secondary: list[dict]) -> list[dict]:
    """Union by cid — primary version wins (it carries media payloads)."""
    by_cid: dict = {}
    for c in secondary:
        if c.get("cid") is not None:
            by_cid[c["cid"]] = c
    for c in primary:
        if c.get("cid") is not None:
            by_cid[c["cid"]] = c
    return list(by_cid.values())


def _user_matches(c: dict, username_lower: str) -> bool:
    user = c.get("user", {})
    return (
        username_lower == user.get("unique_id", "").lower()
        or username_lower in user.get("nickname", "").lower()
    )


async def _fetch_core(
    req: "FetchRequest", request: "Request", user_session: Optional[dict] = None
):
    """Scan a video's comments (free). Pure logic, no background tasks.
    Dual-aid engine: aid=1988 returns media payloads, aid=1180 returns a
    WIDER comment set with payloads stripped (but text markers). Union both
    (1988 wins), scan reply threads via both aids, 90s result cache.
    With user_session (BYO cookie): logged-in fetch becomes primary — TikTok
    returns media payloads only to logged-in sessions (research 2026-09)."""
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    rate_limit_scan(request.client.host if request else "local")

    resolved = await resolve_short_link(url)
    video_id = extract_video_id(resolved)
    if not video_id:
        raise HTTPException(status_code=400, detail="Could not extract video ID from URL")

    # cache hit? (same video + username + session-mode within TTL)
    cache_key = (
        video_id,
        (req.username or "").strip().lower(),
        bool(user_session),
    )
    hit = _scan_cache.get(cache_key)
    if hit and time.time() - hit[0] < SCAN_CACHE_TTL:
        cached = dict(hit[1])
        cached["cached"] = True
        return cached

    t0 = time.time()
    top_payload: list[dict] = []
    top_wide: list[dict] = []
    throttled_aids = 0
    # BYO-session pass (0): user's own logged-in cookie sees ALL comments
    # WITH media payloads (research verdict: payloads are login-gated).
    # This becomes the primary fetch when linked; anonymous dual-aid below
    # still runs as a wide-union supplement + fallback.
    session_cookie: Optional[str] = None
    top_session: list[dict] = []
    if user_session is not None:
        session_cookie = user_session.get("cookie")
    if session_cookie:
        try:
            top_session = await fetch_comments_sequential(
                video_id, aid=1988, cookie=session_cookie
            )
        except ScanThrottled:
            top_session = []
    # pass 1: top-level via both aids (sequential, paced) — one aid being
    # throttled must not kill the scan if the other one works
    for aid in SCAN_AIDS:
        try:
            fetched = await fetch_comments_sequential(video_id, aid=aid)
        except ScanThrottled:
            throttled_aids += 1
            continue
        if aid == 1988:
            top_payload = fetched
        else:
            top_wide = fetched
    # session version wins over anonymous 1988 (it carries the payloads)
    comments = _merge_comments(top_session or top_payload, top_wide)
    if not comments:
        if throttled_aids == len(SCAN_AIDS) or await video_exists(video_id):
            raise HTTPException(
                status_code=503,
                detail="TikTok is rate-limiting scans right now — please try again in a minute.",
            )
        raise HTTPException(status_code=404, detail="No comments found for this video")

    # pass 2: reply threads (union) — replies via BOTH aids, 1988 first for
    # payloads (cross-aid thread fetch recovers stickers invisible in 1988's list)
    threads = [c for c in comments if c.get("reply_comment_total", 0) > 0]
    if session_cookie and top_session:
        replies_session = await fetch_reply_comments(
            video_id, threads, aid=1988, cookie=session_cookie
        )
    else:
        replies_session = []
    replies_payload = await fetch_reply_comments(video_id, threads, aid=1988)
    replies_wide = await fetch_reply_comments(video_id, threads, aid=1180)
    replies = _merge_comments(
        _merge_comments(replies_session, replies_payload), replies_wide
    )
    total_comments = len(comments) + len(replies)

    stickers = extract_stickers(comments + replies, req.username)

    took_ms = int((time.time() - t0) * 1000)
    print(
        f"[scan] video={video_id} user={req.username or '-'} "
        f"session={'y' if session_cookie else 'n'} "
        f"top={len(comments)}({len(top_session)}s+{len(top_payload)}+{len(top_wide)}) "
        f"replies={len(replies)}({len(replies_session)}s+{len(replies_payload)}+{len(replies_wide)}) "
        f"stickers={len(stickers)} {took_ms}ms",
        flush=True,
    )

    base = {
        "video_id": video_id,
        "total_comments": total_comments,
        "scanned_top": len(comments),
        "scanned_replies": len(replies),
    }

    result: Optional[dict] = None
    if not stickers and req.username:
        all_stickers = extract_stickers(comments + replies)
        uname = req.username.strip().lstrip("@")
        # detection pass: username match + visual marker in the wide set,
        # but no downloadable payload (TikTok strips media for those comments)
        ul = uname.lower()
        detected = 0
        for c in top_wide + replies_wide:
            if not _user_matches(c, ul):
                continue
            u = next(
                (m for m in comments + replies if m.get("cid") == c.get("cid")), c
            )
            if u.get("cmt_sticker_struct") or u.get("image_list"):
                continue  # downloadable — would have been found above
            if _visual_marker(c):
                detected += 1
        if detected:
            result = {
                **base,
                "stickers_found": 0,
                "stickers": [],
                "all_stickers_count": len(all_stickers),
                "blocked_count": detected,
                "message": f"@{uname} did post {detected} visual comment(s) here, but TikTok "
                           f"blocks external download for them — only the app can save those. "
                           f"Scanned {total_comments} comments including replies; "
                           f"this video has {len(all_stickers)} downloadable stickers from other users.",
            }
        else:
            result = {
                **base,
                "stickers_found": 0,
                "stickers": [],
                "all_stickers_count": len(all_stickers),
                "message": f"No stickers found from @{uname} — scanned "
                           f"{total_comments} comments including replies. "
                           f"This video has {len(all_stickers)} stickers from other users. "
                           f"(If you're sure they commented, the comment may be deleted, "
                           f"private, or the username misspelled.)",
            }
    elif not stickers:
        raise HTTPException(
            status_code=404,
            detail="No sticker comments found in this video's comments.",
        )
    else:
        result = {
            **base,
            "stickers_found": len(stickers),
            "stickers": stickers,
        }

    # remember (only successful shapes are cached)
    _scan_cache[cache_key] = (time.time(), result)
    # keep the cache bounded
    while len(_scan_cache) > 64:
        oldest = min(_scan_cache, key=lambda k: _scan_cache[k][0])
        _scan_cache.pop(oldest, None)

    return result


@app.post("/fetch")
async def fetch_stickers(
    req: FetchRequest,
    background: BackgroundTasks,
    request: Request,
    cred: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """Scan + auto-persist to library (L2) in the background.
    Logged-in users with a linked TikTok session get payload-full scans."""
    user_session = None
    if cred is not None:
        try:
            payload = auth.verify_token(cred.credentials)
            if payload:
                user_session = await tsession.get_active(payload["sub"])
        except HTTPException:
            user_session = None  # invalid/expired token: anonymous scan still fine
    result = await _fetch_core(req, request, user_session=user_session)
    if isinstance(result, dict) and result.get("stickers"):
        background.add_task(lib.library_upsert, result["stickers"], result["video_id"])
    return result


def make_tray_icon(data: bytes) -> bytes:
    img = Image.open(io.BytesIO(data))
    img.seek(0)
    frame = img.copy().convert("RGBA")
    frame.thumbnail((96, 96), Image.LANCZOS)
    canvas = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    offset = ((96 - frame.width) // 2, (96 - frame.height) // 2)
    canvas.paste(frame, offset, frame)
    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    return buf.getvalue()


def build_pack(sticker_files: list[tuple[str, bytes]], pack_name: str) -> bytes:
    stickers_meta = []
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, (name, data) in enumerate(sticker_files):
            fname = f"sticker_{i+1:03d}.webp"
            zf.writestr(fname, data)
            stickers_meta.append({"image_file": fname, "emojis": ["\U0001F600"]})
        tray = make_tray_icon(sticker_files[0][1])
        zf.writestr("tray.png", tray)
        contents = {
            "identifier": f"stickersync-{uuid.uuid4().hex[:12]}",
            "name": pack_name,
            "publisher": "StickerSync",
            "tray_image_file": "tray.png",
            "stickers": stickers_meta,
        }
        zf.writestr("contents.json", json.dumps(contents, indent=2))
    return zip_buf.getvalue()


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

import os as _env
GOOGLE_CLIENT_ID = _env.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = _env.environ.get("GOOGLE_CLIENT_SECRET", "")
FRONTEND_URL = _env.environ.get("FRONTEND_URL", "")
BACKEND_URL = _env.environ.get("BACKEND_URL", "")


@app.get("/auth/oauth/google/start")
async def oauth_google_start(ref: Optional[str] = Query(None), request: Request = None):
    """Kick off Google OAuth: one-time state, redirect to Google consent screen."""
    rate_limit_auth(request.client.host if request else "local")
    import secrets as _s
    from urllib.parse import urlencode as _ue
    state = _s.token_urlsafe(32)
    ref_clean = ref.upper() if (ref and re.match(r"^[A-Za-z0-9]{4,8}$", ref)) else None
    await db.execute("INSERT INTO oauth_states (state, ref) VALUES ($1, $2)", state, ref_clean)
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": f"{BACKEND_URL}/auth/oauth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{_ue(params)}", status_code=302)


@app.get("/auth/oauth/google/callback")
async def oauth_google_callback(code: Optional[str] = Query(None), state: Optional[str] = Query(None)):
    """Google redirects here with code+state. Validate, exchange, upsert, redirect home."""
    import json as _json
    from urllib.parse import urlencode as _ue

    def err_redirect(code_err: str):
        back = FRONTEND_URL or "https://stickersync.vercel.app"
        return RedirectResponse(url=f"{back}#auth_error={code_err}", status_code=302)

    # 1. validate state (one-time use, 10-min TTL)
    if not state:
        return err_redirect("state")
    row = await db.fetch_one(
        "DELETE FROM oauth_states WHERE state = $1 "
        "AND created_at > now() - interval '600 seconds' RETURNING ref",
        state,
    )
    if not row:
        return err_redirect("state")
    ref_code = row["ref"] if row else None

    # 2. exchange code for access token
    if not code:
        return err_redirect("denied")
    try:
        async with httpx.AsyncClient(timeout=15.0) as ex:
            token_resp = await ex.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": f"{BACKEND_URL}/auth/oauth/google/callback",
                },
            )
        token_resp.raise_for_status()
        access_token = token_resp.json().get("access_token")
        if not access_token:
            return err_redirect("exchange")
    except Exception:
        return err_redirect("exchange")

    # 3. fetch userinfo (require verified email)
    try:
        async with httpx.AsyncClient(timeout=15.0) as ui:
            info_resp = await ui.get(
                GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
            )
        info_resp.raise_for_status()
        info = info_resp.json()
        email = info.get("email")
        email_verified = info.get("email_verified")
        if not email or email_verified not in (True, "true", "True"):
            return err_redirect("email")
    except Exception:
        return err_redirect("email")

    # 4. upsert user via RPC
    result = await db.fetch_val("SELECT oauth_login($1, $2)", email, ref_code)
    data = _json.loads(result) if isinstance(result, str) else result
    if isinstance(data, dict) and data.get("error"):
        return err_redirect("email")

    # 5. sign our JWT, redirect to frontend with token in URL fragment
    token = auth.make_token(str(data["user_id"]))
    back = FRONTEND_URL or "https://stickersync.vercel.app"
    return RedirectResponse(url=f"{back}#token={token}&uid={data['user_id']}", status_code=302)


def _gen_ref_code() -> str:
    import secrets as _secrets
    return _secrets.token_hex(3).upper()  # 6-char hex


@app.get("/me")
async def me(user: dict = Depends(current_user)):
    """Balance info: free downloads, private credits, pool claims today."""
    uid = user["sub"]
    row = await db.fetch_one("SELECT id FROM users WHERE id=$1", uid)
    if not row:
        # lazy signup: grant 3 free downloads + referral code
        await db.fetch_val("SELECT grant_signup_credits($1, NULL)", uid)
    row = await db.fetch_one("""
        SELECT u.private_credits, u.free_downloads, u.referral_code, u.is_purchaser,
               COALESCE(p.count, 0) AS pool_claims_today
        FROM users u
        LEFT JOIN pool_claims p ON p.user_id = u.id AND p.date = CURRENT_DATE
        WHERE u.id = $1
    """, uid)
    return {
        "user_id": uid,
        "private_credits": row["private_credits"],
        "free_downloads": row["free_downloads"],
        "referral_code": row["referral_code"],
        "is_purchaser": row["is_purchaser"],
        "pool_claims_today": row["pool_claims_today"],
        "pool_daily_limit": None if row["is_purchaser"] else 3,
    }


# ---- BYO TikTok session: link / status / unlink ----

class TikTokSessionRequest(BaseModel):
    cookie: str


@app.get("/tiktok-session")
async def tiktok_session_status(user: dict = Depends(current_user)):
    """Status only — the cookie itself is never returned to any client."""
    sess = await tsession.get_active(user["sub"])
    if not sess:
        return {"linked": False}
    return {
        "linked": True,
        "username": sess["username"],
        "updated_at": sess["updated_at"],
    }


@app.post("/tiktok-session")
async def tiktok_session_link(
    req: TikTokSessionRequest, request: Request, user: dict = Depends(current_user)
):
    """Link the user's own TikTok cookie (sessionid). Validated live against
    TikTok before storing; stored AES-256-GCM encrypted at rest."""
    rate_limit_auth(request.client.host if request else "local")
    cookie = (req.cookie or "").strip()
    if not cookie or len(cookie) > 4096:
        raise HTTPException(status_code=400, detail="Cookie missing or too long")
    check = await tsession.validate_cookie(cookie)
    if not check.get("ok"):
        raise HTTPException(status_code=400, detail=check.get("reason") or "Invalid session")
    await tsession.save(user["sub"], cookie, check.get("username") or "")
    return {"linked": True, "username": check.get("username")}


@app.delete("/tiktok-session")
async def tiktok_session_unlink(user: dict = Depends(current_user)):
    """Remove the stored session permanently."""
    await tsession.remove(user["sub"])
    return {"linked": False}


async def _get_sticker_bytes(sticker_id: str, urls: list[str]) -> bytes:
    """L1 cache -> fetch+process (SSRF-validated urls). Raises 404/502."""
    processed = lru_get(sticker_id)
    if processed is None:
        try:
            processed = await download_and_process(validate_fetch_urls(urls))
            lru_put(sticker_id, processed)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=502,
                detail="Sticker link expired. Re-scan the video and try again.",
            )
    return processed


async def _resolve_urls(sticker_id: str, sticker_url: Optional[str]) -> list[str]:
    """L2 library urls -> param fallback. Raises 404 when neither exists."""
    cached_urls = await lib.library_get_cached(sticker_id)
    if cached_urls and cached_urls.get("urls"):
        return cached_urls["urls"]
    if sticker_url:
        return validate_fetch_urls([sticker_url])
    raise HTTPException(status_code=404, detail="Sticker not found. Re-scan the video first.")


@app.post("/download/{sticker_id}")
async def download_sticker(
    sticker_id: str,
    request: Request,
    background: BackgroundTasks,
    format: str = Query("wastickers", regex="^(wastickers|zip|webp)$"),
    sticker_url: Optional[str] = Query(None),
    user: dict = Depends(current_user),
):
    """Charge: 1 credit per NEW sticker. Stickers this user already paid for
    (proven via download_log) are re-served FREE — buy once, own forever."""
    rate_limit_download(request.client.host if request else "local")
    sticker_id = sanitize_sticker_id(sticker_id)
    uid = user["sub"]

    # 0. Ownership: skip charge if previously paid
    owned = await crate_mod.is_owned(uid, sticker_id)
    if owned:
        source = "owned"
    else:
        # 1. Charge FIRST (atomic) — prevents free downloads via race
        source = await db.fetch_val("SELECT spend_credit($1)", uid)
        if source == "empty":
            raise HTTPException(
                status_code=402,
                detail="No credits left. Free downloads used up and the world pool is dry — top-up coming soon.",
            )
        if source is None:
            raise HTTPException(status_code=500, detail="Spend failed")

    # ensure user row exists (spend_credit grants lazily via users table FK)
    # 2. Get bytes
    urls = await _resolve_urls(sticker_id, sticker_url)
    processed = await _get_sticker_bytes(sticker_id, urls)

    # 3. Background: audit log (ownership proof for future free re-serves)
    background.add_task(lib.log_download, uid, sticker_id, source)

    headers = {"X-Charged": "0" if owned else "1"}
    if format == "webp":
        return StreamingResponse(
            io.BytesIO(processed),
            media_type="image/webp",
            headers={**headers, "Content-Disposition": f'attachment; filename="{sticker_id}.webp"'},
        )

    pack = build_pack([(sticker_id, processed)], sticker_id)
    ext = "wastickers" if format == "wastickers" else "zip"
    return StreamingResponse(
        io.BytesIO(pack),
        media_type="application/octet-stream",
        headers={**headers, "Content-Disposition": f'attachment; filename="{sticker_id}.{ext}"'},
    )


@app.get("/stats")
async def stats():
    """Public read-only stats for the landing page."""
    library_size = await db.fetch_val("SELECT count(*) FROM library")
    total_downloads = await db.fetch_val("SELECT count(*) FROM download_log")
    pool = await db.fetch_val("SELECT pool FROM world_pool WHERE id = 1")
    return {
        "library_size": library_size,
        "total_downloads": total_downloads,
        "world_pool": pool,
    }


_activity_cache: dict[str, tuple[float, list]] = {"v": (0.0, [])}


@app.get("/activity")
async def activity():
    """Public anonymized activity feed: last sticker grabs (no downloader identity)."""
    import time as _time

    now = _time.time()
    ts, cached = _activity_cache.get("v", (0.0, []))
    if cached and now - ts < 10.0:
        return {"events": cached}

    rows = await db.fetch_all("""
        SELECT d.created_at,
               (now() - d.created_at) AS age
        FROM download_log d
        ORDER BY d.created_at DESC
        LIMIT 8
    """)
    events = []
    for r in rows:
        age_s = int(r["age"].total_seconds()) if hasattr(r["age"], "total_seconds") else int(r["age"])
        if age_s < 60:
            ago = f"{age_s}s ago"
        elif age_s < 3600:
            ago = f"{age_s // 60}m ago"
        elif age_s < 86400:
            ago = f"{age_s // 3600}h ago"
        else:
            ago = f"{age_s // 86400}d ago"
        events.append({
            "ago": ago,
        })
    _activity_cache["v"] = (now, events)
    return {"events": events}


@app.get("/cleanup")
async def cleanup(request: Request):
    """Daily sweep endpoint (external cron only, X-Cron-Secret required)."""
    require_cron_secret(request)
    n = await lib.cleanup_expired()
    return {"removed": n}


# ============ LIVE WATCH / TRENDING / LIBRARY BROWSE ============

# view rate limit: token bucket per IP — 60 views/min
_view_buckets: dict[str, tuple[float, float]] = {}


def rate_limit_view(ip: str) -> None:
    now = time.time()
    tokens, last = _view_buckets.get(ip, (60.0, now))
    refill = (now - last) * 1.0  # 1 token/sec
    tokens = min(60.0, tokens + refill)
    if tokens < 1.0:
        raise HTTPException(status_code=429, detail="Too many view pings")
    _view_buckets[ip] = (tokens - 1.0, now)
    # opportunistic size guard
    if len(_view_buckets) > 5000:
        oldest = min(_view_buckets, key=lambda k: _view_buckets[k][1])
        _view_buckets.pop(oldest, None)


@app.post("/view/{sticker_id}")
async def view_sticker(sticker_id: str, background: BackgroundTasks, request: Request):
    """Anonymous view ping (live-watch). Fire-and-forget: 202, no auth."""
    rate_limit_view(request.client.host if request else "local")
    sticker_id = sanitize_sticker_id(sticker_id)
    background.add_task(lib.log_view, sticker_id)
    return {"ok": True}


_trending_cache: dict[str, tuple[float, list]] = {"v": (0.0, [])}
_last_stale_sweep: dict[str, float] = {"t": 0.0}


@app.get("/trending")
async def trending():
    """Public live-watch board: most viewed/downloaded stickers in the last 72h.
    Lazy stale sweep (max 1x/hour): drop library rows unviewed for 3+ days."""
    import time as _time

    now = _time.time()
    if now - _last_stale_sweep["t"] > 3600.0:
        _last_stale_sweep["t"] = now
        await lib.sweep_stale(days=3)
        await lib.prune_view_log(days=7)

    ts, cached = _trending_cache.get("v", (0.0, []))
    if cached and now - ts < 60.0:
        return {"stickers": cached}

    rows = await lib.trending_stickers(limit=12)
    _trending_cache["v"] = (now, rows)
    return {"stickers": rows}


@app.get("/library")
async def library_browse(
    q: str = Query("", max_length=100),
    sort: str = Query("trending", regex="^(trending|recent|downloads)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=48),
):
    """Public library browse: FTS search + sort + pagination. Only fresh URLs."""
    items, total = await lib.library_page(q=q.strip(), sort=sort, page=page, per_page=per_page)
    pages = max(1, -(-total // per_page))
    return {"stickers": items, "total": total, "page": page, "pages": pages}


# ============ CRATE (per-user collection) ============

class CrateAddRequest(BaseModel):
    sticker_id: str
    url: str
    urls: list[str] = []
    is_animated: bool = True


class CrateExportRequest(BaseModel):
    sticker_ids: list[str]


async def _ensure_user_row(uid: str) -> None:
    """Lazy user row (FK target for crate) — same pattern as /me."""
    row = await db.fetch_one("SELECT 1 FROM users WHERE id = $1", uid)
    if not row:
        await db.fetch_val("SELECT grant_signup_credits($1, NULL)", uid)


@app.post("/crate/add")
async def crate_add(req: CrateAddRequest, user: dict = Depends(current_user)):
    """Add sticker snapshot to my crate (wishlist). Free; owned badge auto-derived."""
    uid = user["sub"]
    await _ensure_user_row(uid)
    req.sticker_id = sanitize_sticker_id(req.sticker_id)
    try:
        urls = validate_fetch_urls(req.urls if req.urls else [req.url])
    except HTTPException:
        urls = []
    if not urls:
        raise HTTPException(status_code=400, detail="Invalid sticker URL")
    result = await crate_mod.crate_add(uid, req.sticker_id, req.url, req.urls, req.is_animated)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Could not add"))
    return {"ok": True, "duplicate": result.get("duplicate", False)}


@app.post("/crate/remove")
async def crate_remove(req: CrateAddRequest, user: dict = Depends(current_user)):
    uid = user["sub"]
    req.sticker_id = sanitize_sticker_id(req.sticker_id)
    await crate_mod.crate_remove(uid, req.sticker_id)
    return {"ok": True}


@app.get("/crate")
async def crate_list(user: dict = Depends(current_user)):
    """My crate: snapshots + owned/fresh status."""
    uid = user["sub"]
    items = await crate_mod.crate_list(uid)
    return {"stickers": items, "count": len(items), "limit": crate_mod.CRATE_LIMIT}


@app.post("/crate/export")
async def crate_export(req: CrateExportRequest, request: Request, user: dict = Depends(current_user)):
    """Build .wastickers pack from selected crate stickers.
    Charge: 1 credit per NOT-owned sticker (owned = free re-export)."""
    rate_limit_download(request.client.host if request else "local")
    uid = user["sub"]
    if not req.sticker_ids:
        raise HTTPException(status_code=400, detail="No stickers selected")
    if len(req.sticker_ids) > 30:
        raise HTTPException(status_code=400, detail="Max 30 stickers per pack")

    charged = 0
    free = 0
    # 1. charge for not-owned stickers (atomic, per sticker)
    for sid in req.sticker_ids:
        sid = sanitize_sticker_id(sid)
        if await crate_mod.is_owned(uid, sid):
            free += 1
            continue
        source = await db.fetch_val("SELECT spend_credit($1)", uid)
        if source == "empty":
            raise HTTPException(
                status_code=402,
                detail=f"Ran out of credits after {charged} charged — export needs {len(req.sticker_ids) - charged - free} more.",
            )
        charged += 1

    async def fetch_bytes(sticker_id: str, urls: list[str]) -> Optional[bytes]:
        try:
            return await _get_sticker_bytes(sticker_id, urls)
        except HTTPException:
            return None

    result = await crate_mod.crate_export(uid, req.sticker_ids, fetch_bytes)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Export failed"))

    # 2. audit log for newly charged stickers (ownership proof)
    for sid in req.sticker_ids:
        sid = sanitize_sticker_id(sid)
        if not await crate_mod.is_owned(uid, sid):
            await db.execute(
                "INSERT INTO download_log (user_id, sticker_id, source) VALUES ($1,$2,$3)",
                uid, sid, "export",
            )

    return StreamingResponse(
        io.BytesIO(result["zip"]),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="stickersync-pack-{int(time.time())}.wastickers"',
            "X-Charged": str(charged),
            "X-Free": str(free),
        },
    )


# ============ PAYMENTS (InstanPay QRIS) ============

class PaymentCreateRequest(BaseModel):
    package: str = Query("starter", regex="^(starter|bundle|custom)$")
    custom_amount: Optional[int] = None


# payments rate limit: 10 creates/min per IP
_pay_buckets: dict[str, tuple[float, float]] = {}


def rate_limit_payment(ip: str) -> None:
    now = time.time()
    tokens, last = _pay_buckets.get(ip, (10.0, now))
    tokens = min(10.0, tokens + (now - last) * (10.0 / 60.0))
    if tokens < 1.0:
        raise HTTPException(status_code=429, detail="Too many payment attempts — wait a minute")
    _pay_buckets[ip] = (tokens - 1.0, now)
    if len(_pay_buckets) > 10_000:
        cutoff = now - 120
        for k in [k for k, v in _pay_buckets.items() if v[1] < cutoff]:
            _pay_buckets.pop(k, None)


@app.post("/payments/create")
async def payments_create(req: PaymentCreateRequest, request: Request, user: dict = Depends(current_user)):
    """Create a QRIS payment for a credit package. Returns QR + payment page URL."""
    rate_limit_payment(request.client.host if request else "local")
    uid = user["sub"]
    await _ensure_user_row(uid)

    try:
        pkg = pay_mod.package_for(req.package, req.custom_amount)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    ref_id = pay_mod.new_ref_id()
    try:
        txn = await pay_mod.create_transaction(
            ref_id, pkg["amount"], f"StickerSync top-up — {pkg['credits']} credits"
        )
    except RuntimeError as e:
        msg = str(e)
        if "minimum" in msg.lower():
            # masked friendly nudge (gateway live minimum Rp 5.000)
            raise HTTPException(
                status_code=422,
                detail="QRIS starts from Rp 5.000 — at Rp 5.000 you get 20 credits + 10 world pool drops (10x the Rp 500 rate). Try Rp 5.000 or higher!",
            )
        raise HTTPException(status_code=502, detail=msg)

    # persist locally (idempotent: ref_id unique)
    try:
        await db.execute("""
            INSERT INTO payments (trx_id, user_id, package, amount, credits, pool_drops)
            VALUES ($1,$2,$3,$4,$5,$6)
        """, str(txn["txn_id"]), uid, req.package, txn.get("unique_amount") or pkg["amount"],
             pkg["credits"], pkg["pool_drops"])
    except Exception as e:
        print(f"[payments_create] insert failed: {e}", flush=True)

    return {
        "txn_id": txn["txn_id"],
        "package": req.package,
        "amount": txn.get("unique_amount") or pkg["amount"],
        "credits": pkg["credits"],
        "pool_drops": pkg["pool_drops"],
        "qr_string": txn.get("qris_string"),
        "payment_url": txn.get("payment_url"),
        "expires_in_minutes": txn.get("expired_in_minutes", 15),
        "sandbox": pay_mod.is_sandbox(),
    }


@app.get("/payments/status/{txn_id}")
async def payments_status(txn_id: int, user: dict = Depends(current_user)):
    """Poll payment status. On paid → apply purchase (atomic idempotent)."""
    uid = user["sub"]
    row = await db.fetch_one(
        "SELECT * FROM payments WHERE trx_id = $1", str(txn_id)
    )
    if not row:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if str(row["user_id"]) != str(uid):
        raise HTTPException(status_code=403, detail="Not your transaction")

    # already applied — no gateway call needed
    if row["status"] == "SUCCESS":
        return {"status": "paid", "applied": True, "credits": row["credits"]}

    try:
        txn = await pay_mod.check_status(txn_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    gw_status = txn.get("status")
    if gw_status == "paid":
        result = await db.fetch_val("SELECT apply_purchase($1)", str(txn_id))
        return {"status": "paid", "applied": result == "applied", "credits": row["credits"]}
    if gw_status in ("expired", "cancelled", "refunded"):
        await db.execute(
            "UPDATE payments SET status = $1 WHERE trx_id = $2 AND status = 'PENDING'",
            gw_status.upper(), str(txn_id),
        )
        return {"status": gw_status, "applied": False, "credits": 0}
    return {"status": gw_status or "pending", "applied": False, "credits": 0}


@app.post("/payments/simulate/{txn_id}")
async def payments_simulate(txn_id: int, user: dict = Depends(current_user)):
    """Sandbox-only: mark transaction as paid (for testing the full flow)."""
    if not pay_mod.is_sandbox():
        raise HTTPException(status_code=403, detail="Simulate is sandbox-only")
    uid = user["sub"]
    row = await db.fetch_one("SELECT * FROM payments WHERE trx_id = $1", str(txn_id))
    if not row:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if str(row["user_id"]) != str(uid):
        raise HTTPException(status_code=403, detail="Not your transaction")
    try:
        await pay_mod.simulate_pay(txn_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    result = await db.fetch_val("SELECT apply_purchase($1)", str(txn_id))
    return {"status": "paid", "applied": result == "applied", "credits": row["credits"]}


@app.post("/payments/webhook")
async def payments_webhook(request: Request):
    """InstanPay callback. HMAC-verified; applies purchase on 'paid'.
    Server-to-server — JWT not applicable; signature IS the auth."""
    raw = await request.body()
    sig = request.headers.get("X-Signature") or request.headers.get("x-signature")
    if not pay_mod.verify_webhook_signature(raw, sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    txn_id = str(payload.get("txn_id"))
    status = payload.get("status")
    if status == "paid" and txn_id:
        await db.fetch_val("SELECT apply_purchase($1)", txn_id)
    return {"ok": True}
