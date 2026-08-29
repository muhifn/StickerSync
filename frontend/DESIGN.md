# Design

> Auto-generated and maintained by frontend-god-mode.
> Source of truth for typography, color, motion, layout, and component tokens.
> Read this BEFORE touching the UI in any subsequent session.

## Aesthetic direction

Playful sticker-studio — warm cream canvas, charcoal ink, single emerald accent (a nod to WhatsApp, the destination), Outfit Heavy display type, sticker cards that sit slightly askew like real stickers slapped on a page.

## Dials

- DESIGN_VARIANCE: 8 / 10  (1 = perfect symmetry, 10 = artsy chaos)
- MOTION_INTENSITY:  6 / 10  (1 = static, 10 = cinematic physics)
- VISUAL_DENSITY:    4 / 10  (1 = airy gallery, 10 = cockpit)

## Type stack

- Display: Outfit (weights 500–800) — `--font-display`
- Body: Plus Jakarta Sans (weights 400–600) — `--font-body`
- Mono (inline code only): system mono fallback
- Loaded via: `next/font/google` in `layout.tsx`

Banned in this project: Inter, Roboto, Arial, system-ui, Geist (previous stack, replaced).

## Color tokens (OKLCH)

```css
:root {
  --bg:          oklch(0.985 0.008 85);  /* warm cream */
  --bg-raised:   oklch(0.955 0.012 85);  /* card surface */
  --fg:          oklch(0.2 0.012 85);    /* warm charcoal */
  --fg-muted:    oklch(0.48 0.014 85);
  --border:      oklch(0.9 0.012 85);
  --accent:      oklch(0.58 0.135 155); /* emerald — the only accent */
  --accent-fg:   oklch(0.99 0.008 85);
  --accent-soft: oklch(0.94 0.04 155);
  --success:     oklch(0.6 0.14 150);
  --error:       oklch(0.55 0.17 15);
  --error-soft:  oklch(0.95 0.03 15);
  --warn-soft:   oklch(0.95 0.05 90);
}
```

Banned in this project:
- Pure #000 / #FFF
- Purple-to-blue gradients (previous violet-fuchsia gradient removed)
- More than ONE accent color

## Shadows

```css
--shadow-lift:    0 1px 2px oklch(0.4 0.02 85 / 0.06), 0 12px 32px -12px oklch(0.4 0.02 85 / 0.18);
--shadow-sticker: 0 2px 4px oklch(0.4 0.02 85 / 0.05), 0 18px 40px -16px oklch(0.35 0.03 85 / 0.22);
```

Always tinted warm (hue 85). No pure-black drops.

## Motion

CSS-only (no framer-motion — keep bundle lean):
- Entrance: `rise-in 0.7s cubic-bezier(0.16, 1, 0.3, 1)` with `--index * 70ms` stagger
- Perpetual float: `float-gentle 4s ease-in-out infinite` — isolated in memoized `FloatSticker` leaf
- Card hover: `transform` only (translate + un-rotate), 0.35s easeOutExpo
- Active press: `translateY(1px) scale(0.98)`
- Skeleton shimmer: `linear` easing (allowed for loops)
- Banned: linear on entrance/hover, bounce/elastic, animating width/height, `useScroll`/GSAP

## Layout

- Container: `max-w-[1400px] mx-auto px-4 md:px-10`
- Hero: asymmetric `md:grid-cols-[3fr_2fr]`, left-aligned copy, floating sticker visual right, collapses to single column below `md`
- Search bar: raised panel `rounded-[2.5rem]`, grid `md:grid-cols-[2fr_1fr_auto]`, single column + `grid-cols-1` on mobile
- Sticker grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`, cards rotate ±1.25deg alternating, un-tilt on hover
- How-to: `divide-y` numbered rows — NOT cards
- Radii: `rounded-[2rem]` cards, `rounded-[2.5rem]` panels, `rounded-full` buttons

## Component inventory

Custom only (no shadcn/21st.dev in this build):
- `FloatSticker` — memoized perpetual float, hero visual
- `StickerSkeleton` — shimmer grid matching card layout (loading state)
- `StickerCard` (inline) — askew card, animated preview, per-card `.wastickers`/`.webp` download
- States: inline error (rose, actionable retry), empty (dashed border), notice (warn, wrong username), saved feedback (button morphs to "Saved")

## Project-specific bans

- No generic placeholder data — use real samples (`@billybatzon` video, `@niko_000444`)
- No emojis (Phosphor icons only, stroke 1.5 / fill)
- No `h-screen` (always `min-h-[100dvh]`)
- No spinner for loading (skeleton grid only)
- Body copy max `max-w-[65ch]`, line-height ≥ 1.5

## Brand voice (copy)

- Tone: direct, warm, slightly playful — not chirpy
- Banned: elevate, seamless, unleash, next-gen, game-changing
- Headline pattern: concrete action ("Steal stickers straight from the comments.")
- Button labels: specific verbs ("Find stickers", not "Submit")
- Loading copy sets time expectations ("usually takes 5–15 seconds")

## Accessibility floor

- WCAG 2.2 AA contrast on all body copy (≥ 4.5:1)
- Focus-visible rings on every interactive element
- `prefers-reduced-motion` respected (kills all animation)
- 44×44px minimum touch targets on mobile (`min-h-[44px]` buttons)
- Real `<label htmlFor>` on both inputs

## Last updated

2026-08-30 by full v3 production redesign — replaced violet-fuchsia default with warm cream + emerald sticker-studio aesthetic, Outfit/Jakarta type stack, skeleton loading, designed empty/error states.
