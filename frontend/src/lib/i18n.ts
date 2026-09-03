export type Locale = "en" | "id";

export interface HowStep {
  lead: string;
  body: string;
}

export interface Dict {
  nav: { openApp: string; howItWorks: string };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cta: string;
    ctaSecondary: string;
    poolLabel: string;
    poolWarming: string;
  };
  how: { title: string; steps: HowStep[] };
  stats: { title: string; library: string; downloads: string; pool: string };
  footer: { rights: string; disclaimer: string };
}

const LANG_KEY = "stickersync_lang";

export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(LANG_KEY);
  if (saved === "en" || saved === "id") return saved;
  return navigator.language?.toLowerCase().startsWith("id") ? "id" : "en";
}

export function persistLocale(locale: Locale) {
  window.localStorage.setItem(LANG_KEY, locale);
}

export const dict: Record<Locale, Dict> = {
  en: {
    nav: {
      openApp: "Open app",
      howItWorks: "How it works",
    },
    hero: {
      eyebrow: "TikTok comments → WhatsApp stickers",
      title: "Steal stickers straight from the comments.",
      subtitle:
        "People drop animated stickers in TikTok comment sections. Paste the video link, find every sticker, and import them into WhatsApp in a single tap.",
      cta: "Start free — 3 downloads on us",
      ctaSecondary: "See how it works",
      poolLabel: "credits raining in the world pool",
      poolWarming: "World pool warming up…",
    },
    how: {
      title: "From comment to chat in three steps",
      steps: [
        {
          lead: "Spot a sticker you like.",
          body: "Open a TikTok video and long-press the sticker comment to see who posted it — note that username.",
        },
        {
          lead: "Paste the link in the app.",
          body: "Share the video, copy the link, drop it in the search box — add the username if you want only theirs.",
        },
        {
          lead: "Import to WhatsApp.",
          body: "Download the .wastickers file, open it on your phone, and it lands in your sticker tray.",
        },
      ],
    },
    stats: {
      title: "Growing with every scan",
      library: "stickers collected",
      downloads: "stickers delivered",
      pool: "world pool credits",
    },
    footer: {
      rights: "StickerSync — stickers belong to their original creators on TikTok.",
      disclaimer: "Not affiliated with TikTok or WhatsApp.",
    },
  },
  id: {
    nav: {
      openApp: "Buka app",
      howItWorks: "Cara pakai",
    },
    hero: {
      eyebrow: "Komentar TikTok → Stiker WhatsApp",
      title: "Curi stiker langsung dari kolom komentar.",
      subtitle:
        "Orang-orang sering menaruh stiker animasi di kolom komentar TikTok. Tempel link videonya, temukan semua stikernya, lalu pindahkan ke WhatsApp dalam sekali tap.",
      cta: "Mulai gratis — 3 download buat kamu",
      ctaSecondary: "Lihat cara pakainya",
      poolLabel: "credit siang bermalam di world pool",
      poolWarming: "World pool sedang disiapkan…",
    },
    how: {
      title: "Dari komentar ke chat dalam tiga langkah",
      steps: [
        {
          lead: "Temukan stiker yang kamu suka.",
          body: "Buka video TikTok, tekan-tahan komentar stikernya untuk melihat siapa yang mengirim — catat username-nya.",
        },
        {
          lead: "Tempel linknya di app.",
          body: "Share video, salin linknya, tempel di kolom pencarian — tambahkan username kalau mau stiker dari dia saja.",
        },
        {
          lead: "Pindahkan ke WhatsApp.",
          body: "Unduh file .wastickers, buka di HP kamu, dan stikernya langsung masuk ke tray stiker WhatsApp.",
        },
      ],
    },
    stats: {
      title: "Tumbuh setiap kali ada yang scan",
      library: "stiker terkumpul",
      downloads: "stiker terkirim",
      pool: "credit world pool",
    },
    footer: {
      rights: "StickerSync — stiker tetap milik kreator aslinya di TikTok.",
      disclaimer: "Tidak berafiliasi dengan TikTok maupun WhatsApp.",
    },
  },
};
