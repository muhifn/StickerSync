"use client";

import { useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7860";

interface Sticker {
  id: string;
  name: string;
  width: number;
  height: number;
  is_animated: boolean;
  url: string;
  author: string;
  author_uid: string;
  comment_text: string;
  comment_likes: number;
}

interface FetchResult {
  video_id: string;
  total_comments: number;
  stickers_found: number;
  stickers: Sticker[];
  message?: string;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleFetch = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), username: username.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to fetch stickers");
      }
      const data: FetchResult = await res.json();
      setResult(data);
      if (data.stickers_found === 0 && !data.message) {
        setError("No stickers found in this video's comments.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [url, username]);

  const handleDownload = useCallback(async (stickerId: string, format: string) => {
    setDownloading(stickerId);
    try {
      const res = await fetch(`${API_BASE}/download/${stickerId}?format=${format}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `sticker.${format === "webp" ? "webp" : format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDownloading(null);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-50">
      <header className="pt-12 pb-8 px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Sticker<span className="text-violet-600">Sync</span>
          </h1>
          <p className="text-gray-500 text-lg">
            Get TikTok comment stickers → Import to WhatsApp
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste TikTok video link (Share → Copy link)"
            className="w-full px-5 py-3.5 text-base bg-white border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 transition-all"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              placeholder="Filter username (optional, e.g. @niko_000444)"
              className="flex-1 px-5 py-3.5 text-base bg-white border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 transition-all"
            />
            <button
              onClick={handleFetch}
              disabled={loading || !url.trim()}
              className="px-6 py-3.5 bg-violet-600 text-white font-semibold rounded-2xl hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {loading ? "Scanning..." : "Get Stickers"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-20">
        {loading && (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-violet-200 border-t-violet-600 mb-4"></div>
            <p className="text-gray-600">Scanning comments for stickers...</p>
          </div>
        )}

        {error && (
          <div className="max-w-lg mx-auto p-4 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {result && result.message && result.stickers_found === 0 && (
          <div className="max-w-lg mx-auto p-4 bg-amber-50 border border-amber-200 rounded-xl text-center mb-6">
            <p className="text-amber-800">{result.message}</p>
          </div>
        )}

        {result && result.stickers_found > 0 && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Found {result.stickers_found} sticker{result.stickers_found !== 1 ? "s" : ""}
                {username.trim() && ` from @${username.trim().replace("@", "")}`}
              </h2>
              <p className="text-sm text-gray-500">
                Scanned {result.total_comments} comments
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {result.stickers.map((sticker) => (
                <div
                  key={sticker.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square bg-gray-50 flex items-center justify-center p-3">
                    <img
                      src={sticker.url}
                      alt={sticker.name}
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    {sticker.comment_text && (
                      <p className="text-xs text-gray-500 truncate mb-1">
                        &ldquo;{sticker.comment_text}&rdquo;
                      </p>
                    )}
                    <p className="text-sm font-medium text-gray-800 truncate">
                      @{sticker.author_uid || sticker.author}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {sticker.is_animated && (
                        <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                          Animated
                        </span>
                      )}
                      {sticker.comment_likes > 0 && (
                        <span className="text-[10px] text-gray-400">
                          ♥ {sticker.comment_likes}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() => handleDownload(sticker.id, "wastickers")}
                        disabled={downloading === sticker.id}
                        className="flex-1 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors"
                      >
                        {downloading === sticker.id ? "..." : ".wastickers"}
                      </button>
                      <button
                        onClick={() => handleDownload(sticker.id, "webp")}
                        disabled={downloading === sticker.id}
                        className="flex-1 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
                      >
                        .webp
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 max-w-lg mx-auto space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-semibold text-blue-900 mb-2">How to get the sticker</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Open the TikTok video with sticker comments</li>
              <li>Note the <strong>username</strong> of the sticker commenter</li>
              <li>Tap <strong>Share → Copy link</strong> on the video</li>
              <li>Paste the link + username here</li>
            </ol>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <h3 className="font-semibold text-green-900 mb-2">Import to WhatsApp</h3>
            <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
              <li>Download the <strong>.wastickers</strong> file</li>
              <li>Open it on your phone → imports into Sticker Maker</li>
              <li>Tap <strong>&ldquo;Add to WhatsApp&rdquo;</strong></li>
            </ol>
            <p className="text-xs text-green-600 mt-2">
              WhatsApp Web: download .webp → drag into chat.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
