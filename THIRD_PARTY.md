# Third-Party Code

This repository vendors code that Superteam Brazil does not own. The MIT
`LICENSE` at the root of this repo does **not** extend to the files listed
below — see the "Third-Party Code — Scope Limitation" section of `LICENSE`.

## ReactBits

| | |
|---|---|
| **Project** | ReactBits |
| **Author** | David Haz ([@DavidHDev](https://github.com/DavidHDev)) |
| **Repository** | https://github.com/DavidHDev/react-bits |
| **Website** | https://reactbits.dev |
| **License** | MIT License **+ Commons Clause Restriction v1.0** |
| **Location in this repo** | `src/components/reactbits/` |
| **Status** | Modified TypeScript adaptations (~1,042 lines) |

### Vendored files

All nine files in `src/components/reactbits/` originate from ReactBits:

| File | Notes |
|------|-------|
| `AnimatedList.tsx` | Adapted for framer-motion v11 |
| `BlobCursor.tsx` | GSAP-driven cursor; adapted |
| `BorderGlow.tsx` | Simplified, dependency-free rewrite |
| `ClickSpark.tsx` | Adapted; dependency-free |
| `DecryptedText.tsx` | Adapted for framer-motion v11 |
| `ShinyText.tsx` | Adapted for framer-motion v11 |
| `SoftAurora.tsx` | Aurora background; OGL/WebGL, adapted |
| `TextType.tsx` | Adapted; dependency-free |
| `TiltedCard.tsx` | Adapted for framer-motion v11 |

Each file has been converted to TypeScript, retyped, and modified to fit this
project's props, theming, and animation library versions. They are derivative
works of the upstream components.

### What the Commons Clause means for you

ReactBits' license is MIT with the Commons Clause Restriction v1.0 layered on
top. The Commons Clause removes the right to "Sell" the software, and defines
Sell to include selling, sublicensing, hosting, or distributing the software
for a fee — expressly including doing so "whether alone, in a bundle, or as a
ported version."

Practical consequences:

- **Using this site / running this code** — fine.
- **Forking for non-commercial or internal use** — fine.
- **Selling, sublicensing, or offering a paid product whose value derives
  substantially from these components** — not permitted by the upstream
  license, and not something this repository can grant.

If your use case falls in the third bucket, either obtain terms directly from
the ReactBits author or replace `src/components/reactbits/` with your own
implementations. The rest of this project remains MIT.

## Glossary data

Term data is **not** vendored. It is fetched at runtime from the
[`@stbr/solana-glossary`](https://www.npmjs.com/package/@stbr/solana-glossary)
npm package ([solanabr/solana-glossary](https://github.com/solanabr/solana-glossary)),
which is maintained by Superteam Brazil under its own license.

Other runtime dependencies (React, Vite, Tailwind CSS, Framer Motion, GSAP,
OGL, Radix UI, Lucide, React Router) are consumed from npm under their own
permissive licenses and are not vendored into this repository. Run
`npm ls --all` or check `package-lock.json` for the full dependency tree.
