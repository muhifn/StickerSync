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
  nav: {
    howItWorks: string;
    pricing: string;
    safety: string;
    faq: string;
    signIn: string;
    openApp: string;
    backHome: string;
    menu: string;
  };
  hero: {
    eyebrow: string;
    title1: string;
    title2: string;
    title3: string;
    subtitle: string;
    cta: string;
    ctaSecondary: string;
    checks: string[];
    note: string;
    noteLink: string;
  };
  marquee: string[];
  statsTag: string;
  stats: {
    title: string;
    library: string;
    librarySub: string;
    downloads: string;
    downloadsSub: string;
    pool: string;
    poolSub: string;
  };
  bento: {
    pipelineTag: string;
    pipelineTitle: string;
    pipelineStep1: string;
    pipelineStep2: string;
    pipelineStep3: string;
    pipelineCaption: string;
    filterTag: string;
    filterTitle: string;
    filterLine1: string;
    filterLine2: string;
    startTag: string;
    startTitle: string;
    startBody: string;
    startBadge: string;
    quickTag: string;
    quickTitle: string;
    quickSteps: string[];
  };
  terminal: {
    title: string;
    prompt: string;
    live: string;
    boot1: string;
    boot2: string;
    boot3: string;
    verbs: { scan: string; download: string; sync: string };
    scanLine: string;
    syncLine: string;
    progress: string;
    empty: string;
  };
  trending: {
    tag: string;
    title: string;
    lead: string;
    cta: string;
  };
  library: {
    tag: string;
    title: string;
    searchPlaceholder: string;
    sortTrending: string;
    sortRecent: string;
    sortDownloads: string;
    empty: string;
  };
  howTag: string;
  how: { title: string; steps: HowStep[] };
  vsTag: string;
  vs: {
    title: string;
    lead: string;
    us: string;
    them: string;
    usItems: string[];
    themItems: string[];
  };
  pricingTag: string;
  pricing: {
    title: string;
    lead: string;
    founderNote: string;
    founderSub: string;
    codeTag: string;
    codeHint: string;
    soon: string;
    popular: string;
    free: { name: string; price: string; priceUnit: string; desc: string; items: string[]; cta: string };
    starter: { name: string; price: string; priceUnit: string; desc: string; items: string[]; cta: string };
    bundle: { name: string; price: string; priceUnit: string; desc: string; items: string[]; cta: string };
    note: string;
  };
  safetyTag: string;
  safety: {
    title: string;
    lead: string;
    items: { step: string; title: string; body: string }[];
  };
  faqTag: string;
  faq: { title: string; items: FaqItem[] };
  finalCta: {
    title: string;
    subtitle: string;
    button: string;
    note: string;
  };
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
      howItWorks: "How it works",
      pricing: "Pricing",
      safety: "Is it safe?",
      faq: "FAQ",
      signIn: "Sign in",
      openApp: "Open app",
      backHome: "Back to home",
      menu: "Menu",
    },
    hero: {
      eyebrow: "Sticker hunter — live now",
      title1: "TikTok comments.",
      title2: "Scanned.",
      title3: "In your chats.",
      subtitle:
        "StickerSync finds every animated sticker people drop in TikTok comment sections — from any public video. One-tap import to WhatsApp, or the raw .webp for Telegram, Discord, and any chat app.",
      cta: "Start free",
      ctaSecondary: "See how it works",
      checks: [
        "Works on any TikTok video",
        "No TikTok login needed",
        "3 free downloads on signup",
        "WhatsApp, Telegram & more",
      ],
      note: "Stickers come straight from the original animated WebP — never a screenshot.",
      noteLink: "See why that matters →",
    },
    marquee: [
      "Original animated WebP",
      "512×512 sticker spec",
      "Username filter",
      "Referral bonus credits",
      "World pool drops",
      "Screenshot-free quality",
      "Free tier forever",
      "One-tap import",
      ".webp for any chat",
    ],
    statsTag: "The numbers",
    stats: {
      title: "Growing with every scan",
      library: "stickers collected",
      librarySub: "Every sticker ever grabbed by hunters — the shared library.",
      downloads: "stickers delivered",
      downloadsSub: "Delivered straight into chats.",
      pool: "world pool credits",
      poolSub: "Free credits waiting to be claimed. First come, first served.",
    },
    bento: {
      pipelineTag: "From comment to chat",
      pipelineTitle: "The pipeline",
      pipelineStep1: "TikTok comment",
      pipelineStep2: "Sticker file",
      pipelineStep3: "Your chat",
      pipelineCaption: "Original animated file — not a screenshot. Works anywhere.",
      filterTag: "Username filter",
      filterTitle: "Only their stickers",
      filterLine1: "@sticker_poster",
      filterLine2: "→ 1 sticker found in 3s",
      startTag: "To get started",
      startTitle: "$0",
      startBody: "Free tier included. Try it on real videos before you spend a cent.",
      startBadge: "3 free downloads on signup",
      quickTag: "Up in minutes",
      quickTitle: "Three taps and done",
      quickSteps: [
        "Paste the TikTok link",
        "Note the sticker's username",
        "Import to your chat",
      ],
    },
    terminal: {
      title: "StickerSync — Hunt Terminal",
      prompt: "sticker@sync:~$ hunt --live",
      live: "LIVE",
      boot1: "> initializing hunter...",
      boot2: "> connecting to tiktok comment stream...",
      boot3: "> ready.",
      verbs: { scan: "SCAN", download: "DOWNLOAD", sync: "SYNC" },
      scanLine: "video %s — %s stickers found",
      syncLine: "pack delivered → your chat",
      progress: "processing %s%%",
      empty: "No hunts yet. Be the first — scan a video and grab a sticker.",
    },
    trending: {
      tag: "Live watch",
      title: "Trending now.\nNo search needed.",
      lead: "The stickers everyone is hunting right now — most viewed and downloaded in the last 72 hours. Grab them straight from here.",
      cta: "Get it free",
    },
    library: {
      tag: "The library",
      title: "Every sticker ever found",
      searchPlaceholder: "Search comments… e.g. \"true friend\"",
      sortTrending: "Trending",
      sortRecent: "Newest",
      sortDownloads: "Most downloaded",
      empty: "Nothing matches that search. Try another keyword — or scan a video and add new stickers to the library.",
    },
    howTag: "How it works",
    how: {
      title: "Three steps.\nInfinite stickers.",
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
          lead: "Import to your chat.",
          body: "Grab the .wastickers for a one-tap WhatsApp import, or the raw .webp for Telegram, Discord, and any chat app.",
        },
      ],
    },
    vsTag: "The comparison",
    vs: {
      title: "Why StickerSync\nwins every time.",
      lead: "The old way is a screenshot. The screenshot loses the animation.",
      us: "StickerSync",
      them: "Manual screenshot",
      usItems: [
        "Original animated sticker file",
        "Exact 512×512 sticker spec",
        "One-tap .wastickers import",
        "Works in any chat app",
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
    pricingTag: "Pricing",
    pricing: {
      title: "Start free.\nScale when hooked.",
      lead: "No credit card required to start. Top-ups land soon.",
      founderNote: "Founder pricing — lock in Rp 500 Starter / Rp 10.000 Bundle for life.",
      founderSub:
        "Top-ups land soon via QRIS. Subscribe early and you're grandfathered at today's rate for as long as the site lives.",
      codeTag: "Referral code?",
      codeHint: "Apply at signup for bonus credits",
      soon: "Coming soon",
      popular: "Popular",
      free: {
        name: "Free",
        price: "$0",
        priceUnit: "",
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
        priceUnit: "",
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
        priceUnit: "",
        desc: "For serial sticker hunters.",
        items: [
          "45 private credits (+5 bonus)",
          "+12 world pool drops",
          "Unlimited pool claims",
          "Best per-credit value",
        ],
        cta: "Get Bundle",
      },
      note: "✓ Free tier stays free  ·  ✓ Top-ups via QRIS  ·  ✓ No subscription, it's credits",
    },
    safetyTag: "Is it safe?",
    safety: {
      title: "Yes.\nHere's what we touch.",
      lead: "And exactly what we don't.",
      items: [
        {
          step: "Step 1",
          title: "We never ask for your TikTok login",
          body: "Scanning reads public comment sections through the same API your browser uses. No TikTok account, password, or session ever touches StickerSync.",
        },
        {
          step: "Step 2",
          title: "Original files, not screenshots",
          body: "Downloads come straight from the sticker's original animated WebP — the exact file the commenter posted, resized to sticker spec.",
        },
        {
          step: "Step 3",
          title: "Stickers belong to their creators",
          body: "We don't host or claim ownership of any sticker. Creators can request removal of any sticker from our library and we'll take it down.",
        },
      ],
    },
    faqTag: "FAQ",
    faq: {
      title: "Questions\nanswered.",
      items: [
        {
          q: "Can I use these outside WhatsApp?",
          a: "Yes. Every sticker downloads as the original animated .webp — drag it into Telegram, Discord, LINE, or any chat that accepts images. For WhatsApp mobile there's also the .wastickers one-tap import.",
        },
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
          a: ".wastickers is a one-tap import package for the WhatsApp mobile app — open it and the sticker lands in your tray. .webp is the raw file that works everywhere: Telegram, Discord, WhatsApp Web, or anywhere you drag it.",
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
      note: "Free tier available · Works in WhatsApp, Telegram, Discord & more",
    },
    footer: {
      rights: "StickerSync — stickers belong to their original creators on TikTok.",
      disclaimer: "Not affiliated with TikTok, WhatsApp, or Telegram.",
    },
  },

  id: {
    nav: {
      howItWorks: "Cara pakai",
      pricing: "Harga",
      safety: "Aman nggak?",
      faq: "FAQ",
      signIn: "Masuk",
      openApp: "Buka app",
      backHome: "Kembali ke home",
      menu: "Menu",
    },
    hero: {
      eyebrow: "Pemburu stiker — live sekarang",
      title1: "Komentar TikTok.",
      title2: "Discan.",
      title3: "Masuk chat kamu.",
      subtitle:
        "StickerSync menemukan semua stiker animasi yang orang drop di kolom komentar TikTok — dari video publik mana pun. Import satu-tap ke WhatsApp, atau file .webp mentah untuk Telegram, Discord, dan aplikasi chat apa pun.",
      cta: "Mulai gratis",
      ctaSecondary: "Lihat cara pakainya",
      checks: [
        "Jalan di video TikTok mana pun",
        "Tanpa login TikTok",
        "3 download gratis saat daftar",
        "WhatsApp, Telegram & lainnya",
      ],
      note: "Stiker diambil langsung dari WebP animasi original — bukan screenshot.",
      noteLink: "Lihat kenapa itu penting →",
    },
    marquee: [
      "WebP animasi original",
      "Spesifikasi stiker 512×512",
      "Filter username",
      "Bonus credit referral",
      "Hujan world pool",
      "Kualitas tanpa screenshot",
      "Free tier selamanya",
      "Import sekali tap",
      ".webp untuk chat mana pun",
    ],
    statsTag: "Angkanya",
    stats: {
      title: "Tumbuh setiap kali ada yang scan",
      library: "stiker terkumpul",
      librarySub: "Semua stiker yang pernah diambil para pemburu — library bersama.",
      downloads: "stiker terkirim",
      downloadsSub: "Terkirim langsung ke chat-chat.",
      pool: "credit world pool",
      poolSub: "Credit gratis menunggu diambil. Siapa cepat, dia dapat.",
    },
    bento: {
      pipelineTag: "Dari komentar ke chat",
      pipelineTitle: "Pipanya",
      pipelineStep1: "Komentar TikTok",
      pipelineStep2: "File stiker",
      pipelineStep3: "Chat kamu",
      pipelineCaption: "File animasi original — bukan screenshot. Jalan di mana saja.",
      filterTag: "Filter username",
      filterTitle: "Stikernya dia saja",
      filterLine1: "@sticker_poster",
      filterLine2: "→ 1 stiker ketemu dalam 3 detik",
      startTag: "Buat mulai",
      startTitle: "Rp 0",
      startBody: "Free tier sudah termasuk. Coba di video asli sebelum keluar uang sepeser pun.",
      startBadge: "3 download gratis saat daftar",
      quickTag: "Selesai dalam hitungan menit",
      quickTitle: "Tiga tap, beres",
      quickSteps: [
        "Tempel link TikTok",
        "Catat username stikernya",
        "Import ke chat kamu",
      ],
    },
    terminal: {
      title: "StickerSync — Hunt Terminal",
      prompt: "sticker@sync:~$ hunt --live",
      live: "LIVE",
      boot1: "> menghidupkan pemburu...",
      boot2: "> menyambung ke stream komentar tiktok...",
      boot3: "> siap.",
      verbs: { scan: "SCAN", download: "DOWNLOAD", sync: "SYNC" },
      scanLine: "video %s — %s stiker ketemu",
      syncLine: "pack terkirim → chat kamu",
      progress: "memproses %s%%",
      empty: "Belum ada perburuan. Jadi yang pertama — scan video dan ambil satu stiker.",
    },
    trending: {
      tag: "Live watch",
      title: "Sedang tren.\nTanpa perlu search.",
      lead: "Stiker yang sedang diburu semua orang — paling banyak dilihat dan diunduh dalam 72 jam terakhir. Ambil langsung dari sini.",
      cta: "Ambil gratis",
    },
    library: {
      tag: "Library-nya",
      title: "Semua stiker yang pernah ditemukan",
      searchPlaceholder: "Cari komentar… mis. \"true friend\"",
      sortTrending: "Tren",
      sortRecent: "Terbaru",
      sortDownloads: "Terbanyak diunduh",
      empty: "Tidak ada yang cocok dengan pencarian itu. Coba kata lain — atau scan video dan tambahkan stiker baru ke library.",
    },
    howTag: "Cara pakai",
    how: {
      title: "Tiga langkah.\nStiker tak terbatas.",
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
          lead: "Pindahkan ke chat kamu.",
          body: "Ambil .wastickers untuk import satu-tap ke WhatsApp, atau file .webp mentah untuk Telegram, Discord, dan aplikasi chat apa pun.",
        },
      ],
    },
    vsTag: "Perbandingannya",
    vs: {
      title: "Kenapa StickerSync\nmenang selalu.",
      lead: "Cara lama: screenshot. Dan screenshot membunuh animasinya.",
      us: "StickerSync",
      them: "Screenshot manual",
      usItems: [
        "File stiker animasi original",
        "Pas spec stiker 512×512",
        "Import .wastickers sekali tap",
        "Jalan di aplikasi chat mana pun",
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
    pricingTag: "Harga",
    pricing: {
      title: "Mulai gratis.\nNaikin kalau sudah ketagihan.",
      lead: "Tanpa kartu kredit untuk mulai. Top-up segera hadir.",
      founderNote: "Founder pricing — kunci Rp 500 Starter / Rp 10.000 Bundle selamanya.",
      founderSub:
        "Top-up segera hadir via QRIS. Daftar lebih awal dan harga kamu terkunci selama site ini hidup.",
      codeTag: "Kode referral?",
      codeHint: "Masukkan saat daftar untuk bonus credit",
      soon: "Segera hadir",
      popular: "Populer",
      free: {
        name: "Gratis",
        price: "Rp 0",
        priceUnit: "",
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
        priceUnit: "",
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
        priceUnit: "",
        desc: "Buat pemburu stiker sejati.",
        items: [
          "45 credit private (bonus +5)",
          "+12 tetesan world pool",
          "Klaim pool tanpa batas",
          "Nilai per credit terbaik",
        ],
        cta: "Ambil Bundle",
      },
      note: "✓ Free tier tetap gratis  ·  ✓ Top-up via QRIS  ·  ✓ Tanpa langganan, ini credit",
    },
    safetyTag: "Aman nggak?",
    safety: {
      title: "Aman.\nIni yang kami sentuh.",
      lead: "Dan yang tidak kami sentuh.",
      items: [
        {
          step: "Langkah 1",
          title: "Kami tidak pernah minta login TikTok kamu",
          body: "Scanning membaca kolom komentar publik lewat API yang sama dengan yang dipakai browser kamu. Tidak ada akun, password, atau sesi TikTok yang tersentuh StickerSync.",
        },
        {
          step: "Langkah 2",
          title: "File original, bukan screenshot",
          body: "Unduhan diambil langsung dari file WebP animasi asli stikernya — file yang sama persis dengan yang dikomentator kirim, di-resize ke spec stiker.",
        },
        {
          step: "Langkah 3",
          title: "Stiker tetap milik kreatornya",
          body: "Kami tidak meng-host atau mengakui kepemilikan stiker apa pun. Kreator bisa minta penghapusan stikernya dari library kami, dan kami turunkan.",
        },
      ],
    },
    faqTag: "FAQ",
    faq: {
      title: "Pertanyaan\nterjawab.",
      items: [
        {
          q: "Bisa dipakai di luar WhatsApp?",
          a: "Bisa. Setiap stiker diunduh sebagai .webp animasi original — drag ke Telegram, Discord, LINE, atau chat mana pun yang terima gambar. Untuk WhatsApp di HP ada juga import satu-tap .wastickers.",
        },
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
          a: ".wastickers adalah paket import sekali tap untuk aplikasi WhatsApp di HP — dibuka langsung masuk tray stiker. .webp adalah file mentah yang jalan di mana saja: Telegram, Discord, WhatsApp Web, atau di mana pun kamu drag dia.",
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
      note: "Free tier tersedia · Jalan di WhatsApp, Telegram, Discord & lainnya",
    },
    footer: {
      rights: "StickerSync — stiker tetap milik kreator aslinya di TikTok.",
      disclaimer: "Tidak berafiliasi dengan TikTok, WhatsApp, maupun Telegram.",
    },
  },
};
