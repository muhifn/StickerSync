export type Locale = "en" | "id";

export interface HowStep {
  lead: string;
  body: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface Dict {
  nav: { openApp: string; howItWorks: string };
  hero: {
    eyebrow: string;
    title1: string;
    title2: string;
    title3: string;
    subtitle: string;
    cta: string;
    ctaSecondary: string;
    checks: string[];
  };
  marquee: string[];
  stats: { title: string; library: string; downloads: string; pool: string };
  feed: { title: string; empty: string; by: string; grabbed: string };
  how: { title: string; steps: HowStep[] };
  vs: {
    title: string;
    lead: string;
    us: string;
    them: string;
    usItems: string[];
    themItems: string[];
  };
  pricing: {
    title: string;
    lead: string;
    soon: string;
    popular: string;
    free: { name: string; price: string; desc: string; items: string[]; cta: string };
    starter: { name: string; price: string; desc: string; items: string[]; cta: string };
    bundle: { name: string; price: string; desc: string; items: string[]; cta: string };
    note: string;
  };
  safety: {
    title: string;
    lead: string;
    items: { title: string; body: string }[];
  };
  faq: { title: string; items: FaqItem[] };
  finalCta: { title: string; subtitle: string; button: string };
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
    nav: { openApp: "Open app", howItWorks: "How it works" },
    hero: {
      eyebrow: "TikTok comments → WhatsApp stickers",
      title1: "TikTok comments.",
      title2: "Scanned.",
      title3: "In your WhatsApp.",
      subtitle:
        "People drop animated stickers in TikTok comment sections. StickerSync finds every one of them from any public video — ready to import into WhatsApp in a single tap.",
      cta: "Start free — 3 downloads on us",
      ctaSecondary: "See how it works",
      checks: [
        "Works on any TikTok video",
        "No TikTok login needed",
        "3 free downloads on signup",
        "WhatsApp-ready packs",
      ],
    },
    marquee: [
      "Original animated WebP",
      "512×512 WhatsApp spec",
      "Username filter",
      "Referral bonus credits",
      "World pool drops",
      "Screenshot-free quality",
      "Free tier forever",
      "One-tap import",
    ],
    stats: {
      title: "Growing with every scan",
      library: "stickers collected",
      downloads: "stickers delivered",
      pool: "world pool credits",
    },
    feed: {
      title: "Live — stickers getting grabbed",
      empty:
        "No grabs yet. Be the first — scan a video and download a sticker, it shows up here.",
      by: "by",
      grabbed: "grabbed",
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
    vs: {
      title: "Why StickerSync wins",
      lead: "The old way is a screenshot. The screenshot loses the animation.",
      us: "StickerSync",
      them: "Manual screenshot",
      usItems: [
        "Original animated sticker file",
        "Exact 512×512 WhatsApp spec",
        "One-tap .wastickers import",
        "Find stickers from any video",
        "Free tier to start",
      ],
      themItems: [
        "Static image, animation gone",
        "Wrong size, gets compressed",
        "Crop, send, save — manually",
        "Scroll comments by hand",
        "Minutes of fiddling per sticker",
      ],
    },
    pricing: {
      title: "Start free. Top up when hooked.",
      lead: "No card needed to begin. Top-ups land soon — world pool drops with every purchase.",
      soon: "Top-up coming soon",
      popular: "Best value",
      free: {
        name: "Free",
        price: "$0",
        desc: "Try it on real videos before spending a cent.",
        items: [
          "3 free downloads on signup",
          "All scanning features",
          "Username filter",
          "Referral bonus credits",
        ],
        cta: "Start free",
      },
      starter: {
        name: "Starter",
        price: "Rp 500",
        desc: "An impulse buy cheaper than parking.",
        items: [
          "2 private credits",
          "+1 drops to the world pool",
          "Unlimited pool claims",
          "Supports the hunt",
        ],
        cta: "Get Starter",
      },
      bundle: {
        name: "Bundle",
        price: "Rp 10.000",
        desc: "For serial sticker hunters.",
        items: [
          "45 private credits (+5 bonus)",
          "+12 world pool drops",
          "Unlimited pool claims",
          "Best per-credit value",
        ],
        cta: "Get Bundle",
      },
      note: "Free tier stays free · Top-ups via QRIS · Cancel nothing, it's credits",
    },
    safety: {
      title: "Is it safe?",
      lead: "Yes. Here's exactly what we touch — and don't.",
      items: [
        {
          title: "We never ask for your TikTok login",
          body: "Scanning reads public comment sections through the same API your browser uses. No TikTok account, password, or session ever touches StickerSync.",
        },
        {
          title: "Original files, not screenshots",
          body: "Downloads come straight from the sticker's original animated WebP — the exact file the commenter posted, resized to WhatsApp spec.",
        },
        {
          title: "Stickers belong to their creators",
          body: "We don't host or claim ownership of any sticker. Creators can request removal of any sticker from our library and we'll take it down.",
        },
      ],
    },
    faq: {
      title: "Questions answered",
      items: [
        {
          q: "Why do I need the username filter?",
          a: "Popular videos can have dozens of sticker comments. If you're after one specific sticker, note the username of whoever posted it and filter — you get exactly that sticker in seconds.",
        },
        {
          q: "Why can't I get stickers from replies?",
          a: "TikTok keeps reply threads locked behind their app. Stickers posted as top-level comments are fully accessible — replies aren't, yet.",
        },
        {
          q: "What's the difference between .wastickers and .webp?",
          a: ".wastickers is a one-tap import package for the WhatsApp mobile app — open it and the sticker lands in your tray. .webp is for WhatsApp Web: download it, drag it into a chat.",
        },
        {
          q: "What is the world pool?",
          a: "Every purchase drops bonus credits into a shared world pool. Anyone logged in can grab from it — first come, first served. It refills every time someone buys.",
        },
        {
          q: "Is the free tier really free?",
          a: "Yes — 3 free downloads the moment you sign up, no card required. Scanning is always free. Top-ups exist for when you're hooked.",
        },
        {
          q: "Whose stickers are these?",
          a: "Stickers are created by TikTok users and belong to them. StickerSync finds and converts them — we don't host or sell the stickers themselves, and creators can request takedowns.",
        },
      ],
    },
    finalCta: {
      title: "That sticker won't screenshot itself.",
      subtitle: "Every comment section is hiding stickers. Start hunting — free.",
      button: "Start free",
    },
    footer: {
      rights: "StickerSync — stickers belong to their original creators on TikTok.",
      disclaimer: "Not affiliated with TikTok or WhatsApp.",
    },
  },

  id: {
    nav: { openApp: "Buka app", howItWorks: "Cara pakai" },
    hero: {
      eyebrow: "Komentar TikTok → Stiker WhatsApp",
      title1: "Komentar TikTok.",
      title2: "Discan.",
      title3: "Masuk WhatsApp.",
      subtitle:
        "Orang-orang menaruh stiker animasi di kolom komentar TikTok. StickerSync menemukan semuanya dari video publik mana pun — siap masuk ke WhatsApp dalam sekali tap.",
      cta: "Mulai gratis — 3 download buat kamu",
      ctaSecondary: "Lihat cara pakainya",
      checks: [
        "Jalan di video TikTok mana pun",
        "Tanpa login TikTok",
        "3 download gratis saat daftar",
        "Pack siap WhatsApp",
      ],
    },
    marquee: [
      "WebP animasi original",
      "Spesifikasi 512×512 WhatsApp",
      "Filter username",
      "Bonus credit referral",
      "Hujan world pool",
      "Kualitas tanpa screenshot",
      "Free tier selamanya",
      "Import sekali tap",
    ],
    stats: {
      title: "Tumbuh setiap kali ada yang scan",
      library: "stiker terkumpul",
      downloads: "stiker terkirim",
      pool: "credit world pool",
    },
    feed: {
      title: "Live — stiker sedang diambil orang",
      empty:
        "Belum ada yang mengambil. Jadi yang pertama — scan video dan unduh stiker, kamu muncul di sini.",
      by: "oleh",
      grabbed: "diambil",
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
    vs: {
      title: "Kenapa StickerSync menang",
      lead: "Cara lama: screenshot. Dan screenshot membunuh animasinya.",
      us: "StickerSync",
      them: "Screenshot manual",
      usItems: [
        "File stiker animasi original",
        "Pas spec WhatsApp 512×512",
        "Import .wastickers sekali tap",
        "Temukan stiker dari video mana pun",
        "Mulai gratis",
      ],
      themItems: [
        "Jadi gambar diam, animasi hilang",
        "Ukurannya salah, terkompres",
        "Crop, kirim, simpan — manual",
        "Scroll komentar pakai tangan",
        "Beribet menit-menit per stiker",
      ],
    },
    pricing: {
      title: "Mulai gratis. Isi kalau sudah ketagihan.",
      lead: "Tanpa kartu untuk mulai. Top-up segera hadir — setiap pembelian menetes ke world pool.",
      soon: "Top-up segera hadir",
      popular: "Paling hemat",
      free: {
        name: "Gratis",
        price: "Rp 0",
        desc: "Coba di video asli sebelum keluar uang sepeser pun.",
        items: [
          "3 download gratis saat daftar",
          "Semua fitur scanning",
          "Filter username",
          "Bonus credit referral",
        ],
        cta: "Mulai gratis",
      },
      starter: {
        name: "Starter",
        price: "Rp 500",
        desc: "Harga impulse, lebih murah dari parkir motor.",
        items: [
          "2 credit private",
          "+1 menetes ke world pool",
          "Klaim pool tanpa batas",
          "Dukung perburuan ini",
        ],
        cta: "Ambil Starter",
      },
      bundle: {
        name: "Bundle",
        price: "Rp 10.000",
        desc: "Buat pemburu stiker sejati.",
        items: [
          "45 credit private (bonus +5)",
          "+12 tetesan world pool",
          "Klaim pool tanpa batas",
          "Nilai per credit terbaik",
        ],
        cta: "Ambil Bundle",
      },
      note: "Free tier tetap gratis · Top-up via QRIS · Tanpa langganan, ini credit",
    },
    safety: {
      title: "Aman nggak?",
      lead: "Aman. Ini saja yang kami sentuh — dan yang tidak.",
      items: [
        {
          title: "Kami tidak pernah minta login TikTok kamu",
          body: "Scanning membaca kolom komentar publik lewat API yang sama dengan yang dipakai browser kamu. Tidak ada akun, password, atau sesi TikTok yang tersentuh StickerSync.",
        },
        {
          title: "File original, bukan screenshot",
          body: "Unduhan diambil langsung dari file WebP animasi asli stikernya — file yang sama persis dengan yang dikomentator kirim, di-resize ke spec WhatsApp.",
        },
        {
          title: "Stiker tetap milik kreatornya",
          body: "Kami tidak meng-host atau mengakui kepemilikan stiker apa pun. Kreator bisa minta penghapusan stikernya dari library kami, dan kami turunkan.",
        },
      ],
    },
    faq: {
      title: "Pertanyaan terjawab",
      items: [
        {
          q: "Buat apa sih filter username?",
          a: "Video populer bisa punya lusinan komentar stiker. Kalau kamu mengejar satu stiker spesifik, catat username pengirimnya lalu filter — stiker itu muncul dalam hitungan detik.",
        },
        {
          q: "Kenapa stiker di balasan (reply) tidak bisa?",
          a: "TikTok mengunci thread balasan di dalam aplikasi mereka. Stiker yang dikirim sebagai komentar utama bisa diakses penuh — reply belum.",
        },
        {
          q: "Beda .wastickers dan .webp apa?",
          a: ".wastickers adalah paket import sekali tap untuk aplikasi WhatsApp di HP — dibuka langsung masuk tray stiker. .webp untuk WhatsApp Web: unduh, lalu drag ke chat.",
        },
        {
          q: "World pool itu apa?",
          a: "Setiap pembelian meneteskan bonus credit ke world pool bersama. Siapa pun yang login bisa mengambil dari situ — siapa cepat dia dapat. Pool terisi ulang setiap ada yang beli.",
        },
        {
          q: "Free tier beneran gratis?",
          a: "Beneran — 3 download gratis begitu daftar, tanpa kartu. Scanning selalu gratis. Top-up itu buat kamu yang sudah ketagihan.",
        },
        {
          q: "Stiker ini milik siapa?",
          a: "Stiker dibuat oleh pengguna TikTok dan tetap milik mereka. StickerSync menemukan dan mengonversinya — kami tidak menjual stikernya, dan kreator bisa minta takedown.",
        },
      ],
    },
    finalCta: {
      title: "Stiker itu nggak akan screenshot dirinya sendiri.",
      subtitle: "Setiap kolom komentar menyimpan stiker. Mulai berburu — gratis.",
      button: "Mulai gratis",
    },
    footer: {
      rights: "StickerSync — stiker tetap milik kreator aslinya di TikTok.",
      disclaimer: "Tidak berafiliasi dengan TikTok maupun WhatsApp.",
    },
  },
};
