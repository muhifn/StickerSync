# StickerSync API

Backend API untuk StickerSync — extract sticker dari komentar video TikTok dan convert ke format sticker WhatsApp.

## Endpoints

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/fetch` | Input video URL + username (opsional) → return daftar sticker dari komentar |
| `GET` | `/download/{sticker_id}?format=wastickers\|zip\|webp` | Download sticker (resize 512×512, package) |

## Menjalankan Lokal

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 7860
```

## Deploy (Docker)

```bash
docker build -t stickersync-api .
docker run -p 7860:7860 stickersync-api
```

App listen di `$PORT` (default 7860) untuk kompatibilitas Railway/platform cloud.
