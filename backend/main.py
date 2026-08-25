import io
import json
import re
import uuid
import zipfile
from typing import Optional
from urllib.parse import parse_qs, urlparse

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image
from pydantic import BaseModel

app = FastAPI(title="StickerSync API", version="3.0.0")

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
MAX_PAGES = 20

sticker_cache: dict[str, dict] = {}
http_client: Optional[httpx.AsyncClient] = None


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


@app.on_event("shutdown")
async def shutdown():
    if http_client and not http_client.is_closed:
        await http_client.aclose()


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


async def fetch_comments(video_id: str) -> list[dict]:
    all_comments = []
    cursor = 0
    client = get_client()
    for _ in range(MAX_PAGES):
        resp = await client.get(
            TIKTOK_COMMENT_API,
            params={"aweme_id": video_id, "count": 50, "cursor": cursor, "aid": 1988},
        )
        data = resp.json()
        comments = data.get("comments") or []
        all_comments.extend(comments)
        if not data.get("has_more", False):
            break
        cursor = data.get("cursor", 0)
    return all_comments


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
    return {"status": "ok", "service": "StickerSync API v3"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/fetch")
async def fetch_stickers(req: FetchRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    resolved = await resolve_short_link(url)
    video_id = extract_video_id(resolved)
    if not video_id:
        raise HTTPException(status_code=400, detail="Could not extract video ID from URL")

    comments = await fetch_comments(video_id)
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

    for s in stickers:
        sticker_cache[s["id"]] = s

    return {
        "video_id": video_id,
        "total_comments": len(comments),
        "stickers_found": len(stickers),
        "stickers": stickers,
    }


def resize_animated_webp(data: bytes, target: int = 512) -> bytes:
    img = Image.open(io.BytesIO(data))
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

    if len(frames) == 1:
        buf = io.BytesIO()
        frames[0].save(buf, format="WEBP", quality=85, method=6)
        return buf.getvalue()

    buf = io.BytesIO()
    frames[0].save(
        buf, format="WEBP", save_all=True, append_images=frames[1:],
        duration=durations, loop=0, quality=80, method=6,
    )
    result = buf.getvalue()
    if len(result) > 500 * 1024:
        buf = io.BytesIO()
        frames[0].save(
            buf, format="WEBP", save_all=True, append_images=frames[1:],
            duration=durations, loop=0, quality=60, method=6,
        )
        result = buf.getvalue()
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
            stickers_meta.append({"image_file": fname, "emojis": ["😀"]})
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


async def download_and_process(urls: list[str]) -> bytes:
    client = get_client()
    last_err = None
    for url in urls:
        try:
            dl_client = httpx.AsyncClient(timeout=15.0, headers={"User-Agent": USER_AGENT})
            resp = await dl_client.get(url)
            await dl_client.aclose()
            resp.raise_for_status()
            return resize_animated_webp(resp.content)
        except Exception as e:
            last_err = e
            continue
    raise last_err or RuntimeError("No URLs available")


@app.get("/download/{sticker_id}")
async def download_sticker(
    sticker_id: str,
    format: str = Query("wastickers", regex="^(wastickers|zip|webp)$"),
):
    sticker = sticker_cache.get(sticker_id)
    if not sticker:
        raise HTTPException(status_code=404, detail="Sticker not found. Fetch first.")

    processed = await download_and_process(sticker.get("urls") or [sticker["url"]])

    if format == "webp":
        return StreamingResponse(
            io.BytesIO(processed),
            media_type="image/webp",
            headers={"Content-Disposition": f"attachment; filename={sticker['name']}.webp"},
        )

    pack = build_pack([(sticker["name"], processed)], sticker["name"])
    ext = "wastickers" if format == "wastickers" else "zip"
    return StreamingResponse(
        io.BytesIO(pack),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={sticker['name']}.{ext}"},
    )
