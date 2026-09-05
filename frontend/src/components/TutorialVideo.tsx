"use client";

import { memo, useState } from "react";
import { Play } from "@phosphor-icons/react";

/**
 * Lite YouTube embed: poster thumbnail + play button first,
 * real iframe only injected on click (fast page, no heavy iframe upfront).
 */
export const TutorialVideo = memo(function TutorialVideo({
  videoId,
  credit,
}: {
  videoId: string;
  credit?: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="die-cut relative overflow-hidden bg-[#0d0d0d]">
      {playing ? (
        <div className="relative aspect-video w-full">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title="Sticker tutorial video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      ) : (
        <button
          onClick={() => setPlaying(true)}
          aria-label="Play tutorial video"
          className="group relative block aspect-video w-full"
        >
          {/* slight zoom to fit the die-cut rounded frame */}
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt="Tutorial video thumbnail"
            className="absolute inset-0 h-full w-full scale-[1.35] object-cover"
            loading="lazy"
          />
          <span className="absolute inset-0 bg-black/40 transition-colors group-hover:bg-black/25" />
          <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent transition-transform group-hover:scale-110 md:h-16 md:w-16">
            <Play size={26} weight="fill" className="translate-x-0.5 text-accent-fg" />
          </span>
          {credit && (
            <span className="absolute bottom-2.5 right-3 rounded-md bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white/60 backdrop-blur">
              {credit}
            </span>
          )}
        </button>
      )}
    </div>
  );
});
