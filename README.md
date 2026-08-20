# Solana Iceberg — Interactive Glossary

[![License: MIT](https://img.shields.io/badge/license-MIT-14F195)](./LICENSE)
[![npm: @stbr/solana-glossary](https://img.shields.io/npm/v/@stbr/solana-glossary?label=%40stbr%2Fsolana-glossary&color=9945FF)](https://www.npmjs.com/package/@stbr/solana-glossary)
[![Terms](https://img.shields.io/badge/terms-1%2C059-14F195)](https://github.com/solanabr/solana-glossary)
[![i18n](https://img.shields.io/badge/i18n-EN%20%7C%20PT--BR%20%7C%20ES-9945FF)](#interaction-model)
[![Built by Superteam Brazil](https://img.shields.io/badge/built%20by-Superteam%20Brazil-14F195)](https://github.com/solanabr)

### **→ [solanaiceberg.com](https://solanaiceberg.com)** · [mirror](https://solana-iceberg.vercel.app)

An immersive, ocean-themed interactive glossary that visualizes Solana knowledge as layers of an iceberg. Surface-level slang floats near the top while deep protocol internals sink to the abyss.

Originally created by **Front Andy**, winner of the **Glossary bounty on [Superteam Earn](https://earn.superteam.fun)**, and now maintained under [SuperteamBR](https://github.com/solanabr).

**Data source**: the [`@stbr/solana-glossary`](https://www.npmjs.com/package/@stbr/solana-glossary) npm package (from [solanabr/solana-glossary](https://github.com/solanabr/solana-glossary)) — 1,059 terms in English, Portuguese, and Spanish, loaded live at runtime. No static term data lives in this repo.

## Live Experience

A single-page vertical scroll that transitions from a night sky above the waterline into progressively deeper ocean zones. Explore Solana terminology by clicking iceberg layers or individual terms.

### Visual Zones

| Zone | Description |
|------|-------------|
| **Sky** | Soft aurora borealis, twinkling stars, shooting stars, Solana Iceberg title |
| **Waterline** | Animated wave divider, rocking sailboat |
| **Shallow water** | Swimming fish, rising bubbles, upper iceberg layers |
| **Deep ocean** | Bioluminescent lanternfish, sharks, jellyfish, submarine, kraken, leviathan |
| **Abyss** | Darkest gradient, deepest protocol concepts |

Ambient extras: a scroll-following diver that tracks your viewport depth, a sleeping polar bear on the summit, a clickable glowing **Pearl** that opens the About section, a blob cursor, and click sparks.

### Iceberg Layers (5 depth tiers)

Terms are assigned a depth (1–5) by the glossary SDK; the app maps them onto five layers:

| Layer | Depth | Terms* | Flavor |
|-------|-------|--------|--------|
| **Surface** | 1 | 110 | Everyday concepts and CT slang — Wallet, NFT, Rug Pull, BONK |
| **Shallow** | 2 | 272 | Developer basics — Validator, RPC Node, Program, Devnet, Lamport |
| **Deep** | 3 | 414 | Protocol internals — Sealevel, Gulf Stream, Turbine, PoH, CPI, PDA |
| **Abyss** | 4 | 207 | Core architecture — Runtime, Syscall, Slot, Epoch, Tower BFT, Shred |
| **Bottom** | 5 | 56 | Low-level details — Entrypoint, Relocatable ELF, LLVM BPF Backend, Bank |

\* Counts as of `@stbr/solana-glossary` 1.1.x (1,059 terms total) — they grow with package releases.

## Interaction Model

- **Iceberg click** — Opens the **Layer View**, a fullscreen overlay showing that depth's terms as floating, animated bubbles
- **Term click** — Opens the **Term View**: the definition in a glowing card with related terms orbiting around it, connected by dashed SVG lines
- **Search** — Top-right search bar with instant filtering across all terms
- **Random** — Shuffle button jumps to a random term
- **Depth / Category / Tags dropdowns** — Top-left nav: jump to a layer, or filter the iceberg by the SDK's 14 categories and 16 tags
- **Language toggle** — EN / PT-BR / ES, auto-detected and persisted in `localStorage`; glossary translations lazy-load per language
- **Pearl** — Click the glowing orb to open the About section (with `npm i @stbr/solana-glossary` install snippets)
- **Back navigation** — Back button or backdrop click returns to the previous view (the layer view stays mounted under a stacked term modal)
- **Deep links** — Every term and layer has a shareable URL: `/t/proof-of-history`, `/l/abyss`, with locale prefixes for Portuguese and Spanish (`/pt/t/...`, `/es/l/...`)

## Tech Stack

| Tool | Purpose |
|------|---------|
| **React 18 + TypeScript** | UI framework |
| **Vite 5 (SWC)** | Build tool + dev server |
| **Tailwind CSS 3** + tailwindcss-animate | Utility-first styling |
| **@stbr/solana-glossary** | Glossary terms, depths, categories, tags, i18n overlays |
| **Framer Motion** | View enter/exit transitions |
| **GSAP + OGL** | Animation primitives (reactbits components only) |
| **Radix UI Tooltip** | Accessible tooltip primitive |
| **Lucide React** | Icons |
| **React Router** | Client-side routing + deep links (`/t/:termId`, `/l/:layerId`, locale prefixes) |
| **Space Grotesk** | Primary font (Google Fonts) |
| **Vitest + Testing Library** | Unit testing |

## Project Structure

```
src/
├── assets/
│   └── solanaWordMark.svg      # Solana logo
├── components/
│   ├── reactbits/              # Third-party — adapted from ReactBits (see THIRD_PARTY.md)
│   │   ├── AnimatedList, BlobCursor, BorderGlow, ClickSpark,
│   │   ├── CountUp, DecryptedText, ShinyText, SoftAurora,
│   │   └── TextType, TiltedCard
│   ├── ui/tooltip.tsx          # Radix tooltip wrapper
│   ├── AboutSection.tsx        # About overlay (opened via the Pearl)
│   ├── AmbientCreatures.tsx    # Randomized swimming creatures
│   ├── Bubbles.tsx             # Rising bubbles
│   ├── DeepSeaCreatures.tsx    # Lanternfish + squid SVGs
│   ├── Diver.tsx               # Scroll-following diver
│   ├── ErrorBoundary.tsx       # Top-level error boundary
│   ├── Fish.tsx                # Swimming fish
│   ├── Footer.tsx              # Solana branding + social links
│   ├── IcebergSVG.tsx          # Main iceberg visualization
│   ├── LanguageToggle.tsx      # EN / PT-BR / ES picker
│   ├── LayerView.tsx           # Fullscreen layer overlay (lazy)
│   ├── NavDropdown.tsx         # Depth / Category / Tags nav
│   ├── Pearl.tsx               # Glowing orb → About section
│   ├── Sailboat.tsx            # Rocking sailboat
│   ├── SearchBar.tsx           # Global search + random button
│   ├── ShootingStars.tsx       # Periodic shooting stars
│   ├── Stars.tsx               # Twinkling stars
│   ├── TermView.tsx            # Term card + orbiting related terms (lazy)
│   └── WaveDivider.tsx         # Animated wave transition
├── data/
│   ├── glossaryAdapter.ts      # ONLY module that imports the glossary SDK
│   └── categoryDepthMap.ts     # Layer ids, order, and visual metadata
├── i18n/
│   ├── context.tsx             # LanguageProvider + useTranslation
│   ├── en.ts / pt-BR.ts / es.ts# UI strings
│   └── glossary.ts             # Lazy-loaded glossary translation overlays
├── pages/
│   ├── Index.tsx               # View state machine: home / layer / term
│   └── NotFound.tsx            # 404 page
├── test/                       # Vitest setup + tests
├── App.tsx                     # Router + providers + error boundary
├── index.css                   # Theme variables, keyframes, base styles
└── main.tsx                    # Entry point

public/creatures/               # Creature SVGs loaded by URL
scripts/generate-favicon.mjs    # Favicon generation (sharp)
```

## Architecture Notes

- **`src/data/glossaryAdapter.ts` is the single bridge to `@stbr/solana-glossary`.** Components never import the SDK directly — the adapter maps SDK depths to layer ids, sorts terms, derives per-layer categories, and exposes search/related-term helpers.
- **`src/pages/Index.tsx`** drives a view state machine (`home` → `layer` → `term`) and documents the z-index hierarchy in a comment — keep it current when adding overlays. `LayerView`, `TermView`, and `AboutSection` are lazy-loaded.
- **Vendor chunking** is configured in `vite.config.ts` (`manualChunks`: react, motion, glossary, gsap/ogl).

## Design Details

### Color System (CSS Custom Properties)

```
--background:  hsl(240, 33%, 7%)   — Near-black base
--primary:     hsl(263, 100%, 63%) — Solana purple (#9945FF)
--secondary:   hsl(160, 93%, 51%)  — Solana green (#14F195)
--accent:      hsl(190, 80%, 50%)  — Cyan accent
```

Layer colors progress from light blue-white (surface) to near-black navy (bottom), matching real ocean depth zones. Ambient animation is CSS-keyframe-first (see `index.css`); Framer Motion handles view transitions; GSAP/OGL stay inside `reactbits/`.

## Getting Started

```bash
# Install dependencies (lockfile is authoritative)
npm ci

# Start dev server (http://localhost:8080, PORT env overrides)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Lint + typecheck
npm run lint
npm run typecheck
```

`VITE_SITE_URL` sets the absolute origin used in canonical, Open Graph, and JSON-LD tags. It is committed in `.env.production` and `.env.development` — no secrets are required to build or run this project.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

**Adding or translating a term?** That belongs in [solanabr/solana-glossary](https://github.com/solanabr/solana-glossary) — this repo holds no term data.

## Roadmap

- More languages via the glossary SDK
- Accessibility pass (reduced motion, keyboard navigation through layers)
- Performance: code-split the main bundle further

## License

MIT — with one carve-out. Files under `src/components/reactbits/` are third-party and are **not** covered by this project's MIT grant. See [LICENSE](./LICENSE) and [THIRD_PARTY.md](./THIRD_PARTY.md) before forking or shipping commercially.

## Credits

First made by **Front Andy** — winner of the Glossary bounty on [Superteam Earn](https://earn.superteam.fun). Maintained by [SuperteamBR](https://github.com/solanabr). Powered by the Solana ecosystem.

Animation components in `src/components/reactbits/` are adapted from **[ReactBits](https://github.com/DavidHDev/react-bits)** by David Haz ([@DavidHDev](https://github.com/DavidHDev)), MIT + Commons Clause. Full attribution in [THIRD_PARTY.md](./THIRD_PARTY.md).
