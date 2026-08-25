#!/bin/bash
kill $(pgrep -f "uvicorn main:app") 2>/dev/null
sleep 1
cd /home/ipank/StickerSync/backend
exec /home/ipank/.local/bin/uvicorn main:app --host 0.0.0.0 --port 7860
