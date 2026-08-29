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
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from PIL import Image
from pydantic import BaseModel

import auth
import db
import library as lib

app = FastAPI(title="StickerSync API", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TIKTOK_COMMENT_API = "https://www.tiktok.com/api/comment/list/"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
PARALLEL_PAGES = 3

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
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
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


async def fetch_comments_parallel(video_id: str) -> list[dict]:
    """Fetch PARALLEL_PAGES pages concurrently, then continue sequentially until exhausted.
    Dedup by cid — TikTok's dynamic sort may return overlapping comments."""
    client = get_client()

    async def page(cursor: int) -> dict:
        resp = await client.get(
            TIKTOK_COMMENT_API,
            params={"aweme_id": video_id, "count": 50, "cursor": cursor, "aid": 1988},
        )
        return resp.json()

    first = await page(0)
    comments = list(first.get("comments") or [])
    if not comments:
        return comments

    # parallel batch of next pages
    results = await asyncio.gather(*[page(50 * i) for i in range(1, PARALLEL_PAGES)])
    for r in results:
        comments.extend(r.get("comments") or [])

    # dedup by cid
    seen: set[int] = set()
    deduped: list[dict] = []
    for c in comments:
        cid = c.get("cid")
        if cid in seen:
            continue
        seen.add(cid)
        deduped.append(c)
    return deduped


def extract_stickers(comments: list[dict], username: Optional[str] = None) -> list[dict]:
    seen = set()
    stickers = []
    username_lower = username.strip().lstrip("@").lower() if username else None

    for c in comments:
        struct = c.get("cmt_sticker_struct")
        if not struct:
            continue

        user = c.get("user", {})
        uid = user.get("unique_id", "")
        nickname = user.get("nickname", "")

        if username_lower:
            if username_lower != uid.lower() and username_lower not in nickname.lower():
                continue

        sid = struct.get("id", "")
        if sid in seen:
            continue
        seen.add(sid)

        animated = struct.get("animated_url", {})
        static = struct.get("static_url", {})
        high = animated.get("high_resolution_url") or static.get("high_resolution_url") or {}
        urls = high.get("url_list", [])
        if not urls:
            continue

        stickers.append({
            "id": sid,
            "name": struct.get("name", "") or f"Sticker {sid[-6:]}",
            "width": high.get("width", 0),
            "height": high.get("height", 0),
            "is_animated": bool(animated.get("high_resolution_url")),
            "url": urls[0],
            "urls": urls,
            "author": nickname,
            "author_uid": uid,
            "comment_text": c.get("text", ""),
            "comment_likes": c.get("digg_count", 0),
        })
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


async def _fetch_core(req: "FetchRequest", request: "Request"):
    """Scan a video's comments (free). Pure logic, no background tasks."""
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    rate_limit_scan(request.client.host if request else "local")

    resolved = await resolve_short_link(url)
    video_id = extract_video_id(resolved)
    if not video_id:
        raise HTTPException(status_code=400, detail="Could not extract video ID from URL")

    comments = await fetch_comments_parallel(video_id)
    if not comments:
        raise HTTPException(status_code=404, detail="No comments found for this video")

    stickers = extract_stickers(comments, req.username)

    if not stickers and req.username:
        all_stickers = extract_stickers(comments)
        return {
            "video_id": video_id,
            "total_comments": len(comments),
            "stickers_found": 0,
            "stickers": [],
            "all_stickers_count": len(all_stickers),
            "message": f"No stickers found from @{req.username.strip().lstrip('@')}. "
                       f"This video has {len(all_stickers)} stickers from other users.",
        }

    if not stickers:
        raise HTTPException(
            status_code=404,
            detail="No sticker comments found in this video's comments.",
        )

    return {
        "video_id": video_id,
        "total_comments": len(comments),
        "stickers_found": len(stickers),
        "stickers": stickers,
    }


@app.post("/fetch")
async def fetch_stickers(req: FetchRequest, background: BackgroundTasks, request: Request):
    """Scan + auto-persist to library (L2) in the background."""
    result = await _fetch_core(req, request)
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


class SignupRequest(BaseModel):
    email: str
    password: str
    referral_code: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


def _gen_ref_code() -> str:
    import secrets as _secrets
    return _secrets.token_hex(3).upper()  # 6-char hex


@app.post("/auth/signup")
async def auth_signup(req: SignupRequest):
    """Native signup: email + password. Returns a signed token."""
    email = req.email.strip().lower()
    result = await db.fetch_val(
        "SELECT auth_signup($1, $2, $3)", email, req.password, req.referral_code
    )
    import json as _json
    data = _json.loads(result) if isinstance(result, str) else result
    if isinstance(data, dict) and data.get("error"):
        raise HTTPException(status_code=400, detail=data["error"])
    token = auth.make_token(str(data["user_id"]))
    return {"token": token, "user_id": data["user_id"]}


@app.post("/auth/login")
async def auth_login(req: LoginRequest):
    """Native login. Returns a signed token."""
    email = req.email.strip().lower()
    result = await db.fetch_val(
        "SELECT auth_login($1, $2)", email, req.password
    )
    import json as _json
    data = _json.loads(result) if isinstance(result, str) else result
    if isinstance(data, dict) and data.get("error"):
        raise HTTPException(status_code=401, detail=data["error"])
    token = auth.make_token(str(data["user_id"]))
    return {"token": token, "user_id": data["user_id"]}


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


@app.post("/download/{sticker_id}")
async def download_sticker(
    sticker_id: str,
    background: BackgroundTasks,
    format: str = Query("wastickers", regex="^(wastickers|zip|webp)$"),
    sticker_url: Optional[str] = Query(None),
    user: dict = Depends(current_user),
):
    """Spend order: free -> pool race -> private. L1 cache hit skips spend? NO —
    every download costs 1 credit regardless of cache (cache saves TIME, not CREDITS)."""
    uid = user["sub"]

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
    # 2. Get bytes: L1 -> fetch
    processed = lru_get(sticker_id)
    if processed is None:
        # try L2 library
        cached_urls = await lib.library_get_cached(sticker_id)
        urls = None
        if cached_urls:
            urls = cached_urls["urls"]
        if not urls and sticker_url:
            urls = [sticker_url]
        if not urls:
            raise HTTPException(status_code=404, detail="Sticker not found. Re-scan the video first.")
        try:
            processed = await download_and_process(urls)
            lru_put(sticker_id, processed)
        except Exception:
            raise HTTPException(
                status_code=502,
                detail="Sticker link expired. Re-scan the video and try again.",
            )

    # 3. Background: audit log
    background.add_task(lib.log_download, uid, sticker_id, source)

    if format == "webp":
        return StreamingResponse(
            io.BytesIO(processed),
            media_type="image/webp",
            headers={"Content-Disposition": f'attachment; filename="{sticker_id}.webp"'},
        )

    pack = build_pack([(sticker_id, processed)], sticker_id)
    ext = "wastickers" if format == "wastickers" else "zip"
    return StreamingResponse(
        io.BytesIO(pack),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{sticker_id}.{ext}"'},
    )


@app.get("/cleanup")
async def cleanup():
    """Daily sweep endpoint (called by external cron). Removes expired library URLs."""
    n = await lib.cleanup_expired()
    return {"removed": n}
