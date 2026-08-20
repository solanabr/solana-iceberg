# Solana Iceberg — Interactive Glossary

An immersive, ocean-themed interactive glossary that visualizes Solana blockchain concepts as layers of an iceberg. Surface-level terms float near the top while deep protocol internals sink to the abyss.

**Data source**: [solanabr/solana-glossary](https://github.com/solanabr/solana-glossary) (not yet integrated — currently uses static local data)

## Live Experience

The app is a single-page vertical scroll that transitions from a night sky above the waterline into progressively deeper ocean zones. Users explore Solana terminology by clicking iceberg layers or individual terms.

### Visual Zones

| Zone | Description |
|------|-------------|
| **Sky** | Aurora borealis, twinkling stars, shooting stars, Solana wordmark title |
| **Waterline** | Animated wave divider, rocking sailboat |
| **Shallow water** | Swimming fish, rising bubbles, upper iceberg layers |
| **Deep ocean** | Bioluminescent lanternfish, giant squids with animated tentacles |
| **Abyss** | Darkest gradient, deepest protocol concepts |

### Iceberg Layers (5 depth tiers)

| Layer | Depth | Example Terms |
|-------|-------|---------------|
| **Surface** | Everyday concepts | Wallet, NFT, SOL, Token, Staking |
| **Shallow** | Developer basics | Validator, RPC Node, Program, Devnet, Lamport |
| **Deep** | Protocol internals | Sealevel, Gulf Stream, Turbine, PoH, CPI, PDA |
| **Abyss** | Core architecture | Runtime, Syscall, Slot, Epoch, Tower BFT, Shred |
| **Bottom** | Low-level details | Account Model, Entrypoint, Relocatable ELF, LLVM BPF Backend, Bank, Fork Graph |

Each layer contains 8 terms with definitions. Total: **40 Solana terms**.

## Interaction Model

### Navigation

- **Iceberg click** — Click any iceberg layer to open the **Layer View**, a fullscreen overlay showing all terms for that depth as floating, animated bubbles
- **Term click** — Click a term (on the iceberg or in the layer view) to open the **Term View**, showing the definition in a glowing card with related terms orbiting around it (connected by dashed SVG lines)
- **Search** — Top-right search bar with instant filtering across all 40 terms
- **Random** — Shuffle button picks a random term
- **Depth dropdown** — Top-left nav lets you jump directly to any layer
- **Category filter** — Multi-select dropdown for future category-based filtering (DeFi, NFTs, Gaming, etc.)
- **Back navigation** — Arrow button or click backdrop to go back

### Cursor Effect

A neon green/purple glow follows the mouse cursor with eased interpolation (`requestAnimationFrame` loop at 0.15 lerp factor).

## Tech Stack

| Tool | Purpose |
|------|---------|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool + dev server |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | Component library (Radix primitives) |
| **Framer Motion** | View transition animations (enter/exit overlays) |
| **Lucide React** | Icons (ArrowLeft, Search, Shuffle, ChevronDown, etc.) |
| **React Router** | Client-side routing (single route `/` + 404 catch-all) |
| **TanStack React Query** | Data fetching infrastructure (ready for API integration) |
| **Space Grotesk** | Primary font (Google Fonts) |
| **Vitest** | Unit testing |
| **Playwright** | E2E testing |

## Project Structure

```
src/
├── assets/
│   └── solanaWordMark.svg          # Solana logo
├── components/
│   ├── ui/                         # shadcn/ui primitives (~40 components)
│   ├── Aurora.tsx                   # Animated aurora borealis (8 bands + curtain streaks)
│   ├── Bubbles.tsx                  # 15 rising bubbles with randomized positions
│   ├── DeepSeaCreatures.tsx         # Bioluminescent lanternfish + giant squids (SVG)
│   ├── Fish.tsx                     # 7 swimming fish with bidirectional animation
│   ├── Footer.tsx                   # Solana branding, social links, copyright
│   ├── HamburgerMenu.tsx            # Mobile menu (unused currently)
│   ├── IcebergSVG.tsx               # Main iceberg visualization (1200x2800 viewBox)
│   ├── LayerView.tsx                # Fullscreen layer overlay with floating term bubbles
│   ├── NavDropdown.tsx              # Top-left nav: Depth selector + Category filter
│   ├── NavLink.tsx                  # Navigation link component
│   ├── NeonCursor.tsx               # Mouse-following neon glow effect
│   ├── Sailboat.tsx                 # Rocking sailboat SVG at waterline
│   ├── SearchBar.tsx                # Global term search + random button
│   ├── ShootingStars.tsx            # Periodic shooting stars (12-30s interval)
│   ├── Stars.tsx                    # 60 twinkling stars
│   ├── TermView.tsx                 # Term definition card with orbiting related terms
│   └── WaveDivider.tsx              # Animated multi-layer wave transition
├── data/
│   └── icebergData.ts               # 5 layers × 8 terms = 40 glossary entries
├── hooks/
│   ├── use-mobile.tsx               # Mobile breakpoint hook
│   └── use-toast.ts                 # Toast notification hook
├── lib/
│   └── utils.ts                     # cn() utility (clsx + tailwind-merge)
├── pages/
│   ├── Index.tsx                    # Main page — view state machine (home/layer/term)
│   └── NotFound.tsx                 # 404 page
├── test/
│   ├── example.test.ts              # Example test
│   └── setup.ts                     # Test setup (jsdom)
├── App.tsx                          # Router + providers
├── App.css                          # (minimal)
├── index.css                        # Theme variables, keyframe animations, base styles
├── main.tsx                         # Entry point
└── vite-env.d.ts                    # Vite type declarations
```

## Design Details

### Color System (CSS Custom Properties)

```
--background:  hsl(240, 33%, 7%)   — Near-black base
--primary:     hsl(263, 100%, 63%) — Solana purple (#9945FF)
--secondary:   hsl(160, 93%, 51%)  — Solana green (#14F195)
--accent:      hsl(190, 80%, 50%)  — Cyan accent
```

Layer colors progress from light blue-white (surface) to near-black navy (bottom), matching real ocean depth zones.

### Animations (CSS Keyframes)

| Animation | Element | Duration |
|-----------|---------|----------|
| `aurora-drift` | Aurora bands | 10-22s |
| `aurora-pulse` | Aurora brightness | 7-15s |
| `aurora-curtain` | Vertical light streaks | 8s |
| `twinkle` | Stars | 2-5s |
| `rock-boat` | Sailboat | 4s |
| `wave-move` | Wave divider | 8-14s |
| `swim-right` / `swim-left` | Fish + deep sea creatures | 10-30s |
| `bubble-rise` | Bubbles | 6-14s |
| `float-term` | Term bubbles in layer view | 3-6s |
| `shooting-star` | Shooting stars | 0.6-1.2s |

### SVG Iceberg Architecture

The iceberg is a single `<svg>` with viewBox `0 0 1200 2800`. Each layer is defined by:

- **Path geometry** — Hand-crafted SVG paths that widen with depth
- **Clip paths** — Terms and connecting lines are clipped to their layer boundaries
- **Term positioning** — Grid-based algorithm with pseudo-random jitter for organic feel
- **Hover states** — Layer brightness + green glow on hover, individual term highlighting
- **Float animation** — SVG `<animateTransform>` for subtle vertical bobbing

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Lint
npm run lint
```

## Future Work

- Integrate with [solanabr/solana-glossary](https://github.com/solanabr/solana-glossary) API/data
- Category filtering (UI exists, logic not wired)
- Mobile hamburger menu integration
- More terms per layer
- Deep-link support (URL-based term navigation)
- i18n (Portuguese first, given SuperteamBR origin)

## Credits

Built by [SuperteamBR](https://github.com/solanabr). Powered by the Solana ecosystem.
