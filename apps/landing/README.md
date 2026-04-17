# @peopleclaw/landing

Astro static landing page for [PeopleClaw](https://peopleclaw.vercel.app).

Target deploy: https://peopleclaw.rollersoft.com.au

## Stack
- Astro 5 (static output)
- Tailwind CSS 3 (via `@astrojs/tailwind`)
- Inter (Google Fonts)

## Dev

```bash
cd apps/landing
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to dist/
npm run preview  # preview built site
```

## Deploy

Vercel project (separate from the SPA at `peopleclaw.vercel.app`):
- Root directory: `apps/landing`
- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: Astro

Custom domain: `peopleclaw.rollersoft.com.au` (point CNAME to Vercel).

## Layout

```
src/
  layouts/Base.astro       # HTML shell, SEO, OG, fonts
  pages/index.astro        # Single landing route, composes sections
  components/
    Nav.astro              # Sticky nav with Try POC CTA
    Hero.astro             # Hero + dual CTA
    Features.astro         # 3 core features (workflow / case / agent)
    Audience.astro         # SME vs freelance IT pitch
    Comparison.astro       # vs traditional BPM table
    Pricing.astro          # 3 tiers (Free / Team / Agency)
    CTA.astro              # Final conversion section
    Footer.astro           # Links + copyright
  styles/global.css        # Tailwind + theme tokens
public/
  favicon.svg
```

## Theming

Dark theme with amber→cyan gradient accents. Matches the SPA's visual identity but warmer (amber + cyan instead of indigo/purple).
