# StickerSync

Extract sticker dari komentar video TikTok dan import ke WhatsApp sebagai sticker animasi.

## Production URLs

| Komponen | URL |
|---|---|
| Frontend | https://stickersync.vercel.app |
| Backend API | https://stickersync-production.up.railway.app |
| Database | Supabase Postgres (Supavisor pooler, ap-southeast-1) |

## Cara Pakai

1. Buka video TikTok yang punya sticker di komentar
2. Catat **username** orang yang pakai sticker
3. **Share → Copy link** video tersebut
4. Buka StickerSync, paste link + username
5. Tap sticker yang dimau → download `.wastickers`
6. Buka file di HP → import ke WhatsApp

## Arsitektur

```
frontend/  → Next.js 16 (deploy: Vercel)
backend/   → FastAPI + Pillow (deploy: Railway, Docker)
```

### Backend Endpoints

| Method | Path | Fungsi |
|---|---|---|
| `POST` | `/fetch` | Video URL + username (opsional) → daftar sticker dari komentar |
| `GET` | `/download/{id}?format=wastickers\|zip\|webp` | Download sticker (512×512, animated WebP) |
| `GET` | `/health` | Health check |

### Spec Sticker WhatsApp

- 512×512 px
- Animated WebP, ≤500KB
- Package `.wastickers` (ZIP: WebP + tray.png + contents.json)

## Development Lokal

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --port 7860

# Frontend
cd frontend
pnpm install
pnpm dev   # http://localhost:3000 (API: http://localhost:7860 via .env.local)
```

## Deploy

- **Backend**: push ke `master` → Railway auto-build Dockerfile (root dir: `backend/`)
- **Frontend**: `vercel --prod` dari folder `frontend/` (env: `NEXT_PUBLIC_API_URL`)
