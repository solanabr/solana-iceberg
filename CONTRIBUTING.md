# Contributing

## Adding, fixing, or translating a term? You're in the wrong repo.

**This repository contains no term data.** Not one definition, not one
translation. Every term is fetched at runtime from the
[`@stbr/solana-glossary`](https://www.npmjs.com/package/@stbr/solana-glossary)
npm package.

To add a term, fix a definition, correct a depth or category, or contribute a
Portuguese/Spanish translation, open your PR here instead:

### → **https://github.com/solanabr/solana-glossary**

Changes there ship to this site automatically on the next package release.
A term PR filed against this repo will be closed and redirected.

## What *does* belong here

The frontend: the iceberg visualization, animations, routing, i18n UI strings,
accessibility, performance, and build config.

## Development loop

```bash
npm ci                 # do not use `npm install` — the lockfile is authoritative
npm run dev            # http://localhost:8080 (PORT env overrides)
```

Before opening a PR, all four must pass:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Guidelines

- Keep PRs focused — one concern per PR.
- `src/data/glossaryAdapter.ts` is the **only** module allowed to import the
  glossary SDK. Components go through the adapter.
- New UI strings belong in all three locales (`src/i18n/en.ts`, `pt-BR.ts`,
  `es.ts`), not just English.
- Respect `prefers-reduced-motion` when adding animation.
- Do not edit `src/components/reactbits/` beyond what's needed — those files are
  third-party (see `THIRD_PARTY.md`).

Questions? Open an issue or find Superteam Brazil at
[github.com/solanabr](https://github.com/solanabr).
