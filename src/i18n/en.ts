/** English UI strings — default language */
const en = {
  // Index page
  "index.subtitle": "Interactive Glossary",

  // Search bar
  "search.placeholder": "Search {count} terms...",
  "search.random": "Random term",
  "layer.loaded": "Showing {shown} of {total} terms",
  "search.truncated": "Showing {shown} of {total} matches — keep typing to narrow",

  // Nav dropdown
  "nav.depth": "Depth",
  "nav.category": "Category",
  "nav.tag": "Tags",
  "nav.clearFilters": "Clear filters",
  "nav.clear": "Clear",

  // Layer view
  "layer.filterPlaceholder": "Filter terms...",
  "layer.termCount": "{matched} of {total} terms",

  // Term view
  "term.aka": "aka",
  "term.depth.surface": "Surface",
  "term.depth.shallow": "Shallow",
  "term.depth.deep": "Deep",
  "term.depth.abyss": "Abyss",
  "term.depth.bottom": "Bottom",
  "term.relatedSingular": "related",
  "term.relatedPlural": "related",

  // Iceberg SVG (on-iceberg term count labels)
  "iceberg.terms": "terms",
  "iceberg.termsFiltered": "terms",

  // Hamburger menu
  "hamburger.layers": "Layers",

  // Footer
  "footer.copyright": "© {year} Superteam Brazil. All rights reserved.",
  "footer.builtBy": "Built by Superteam Brazil",

  // About section — expandable panel under the "Trenches" band
  "about.pearlAria": "Learn about Solana Iceberg",
  "about.title": "Built on",
  "about.brandShiny": "solana-glossary",
  "about.tagline":
    "Solana Iceberg is a fun project by Superteam Brazil to help developers visualize and explore Solana, powered by the open-source solana-glossary SDK — 1,059 terms across 14 categories, 5 depth levels, and full i18n.",
  "about.step1.title": "What is solana-glossary",
  "about.step1.body":
    "The most comprehensive Solana glossary ever built. 1,059 terms, 14 categories, cross-references via a knowledge graph, 5-level depth rating, and built-in Portuguese & Spanish translations. Designed for developer onboarding, LLM context injection, and ecosystem education.",
  "about.step2.title": "Install the SDK",
  "about.step2.body":
    "Add the npm package to any JavaScript or TypeScript project.",
  "about.step3.title": "Install the MCP server",
  "about.step3.body":
    "Drop this snippet into your Claude Desktop or Claude Code MCP config to unlock 10 tools: lookup_term, search_glossary, browse_category, filter_by_depth, filter_by_tag, get_related, inject_context, glossary_stats, list_categories, list_tags. All tools accept an optional locale parameter.",
  "about.step4.title": "Install the AI skill",
  "about.step4.body":
    "Gives your agent instructions on when and how to use the glossary tools. Install via skills-npm or copy the SKILL.md into your project's .claude/skills/ directory.",
  "about.step5.title": "Contribute a new term",
  "about.step5.body":
    "Missing a term? Open a PR on the repo. Each GlossaryTerm has an id, display term, definition, category, depth (1-5), plus optional related, aliases, and tags arrays. Check CONTRIBUTING.md and submit against main.",
  "about.step5.cta": "Open an issue on GitHub",
  "about.footer":
    "Made with ♥ by Superteam Brazil · github.com/solanabr/solana-glossary",
  "about.copy": "Copy",
  "about.copied": "Copied",

  // Category labels
  "category.token-ecosystem": "Token Ecosystem",
  "category.solana-ecosystem": "Solana Ecosystem",
  "category.web3": "Web3",
  "category.defi": "DeFi",
  "category.blockchain-general": "Blockchain General",
  "category.core-protocol": "Core Protocol",
  "category.network": "Network",
  "category.ai-ml": "AI & ML",
  "category.infrastructure": "Infrastructure",
  "category.security": "Security",
  "category.zk-compression": "ZK Compression",
  "category.programming-model": "Programming Model",
  "category.programming-fundamentals": "Programming Fundamentals",
  "category.dev-tools": "Dev Tools",

  // Depth layer names (uppercase for iceberg display)
  "depth.surface": "SURFACE",
  "depth.shallow": "SHALLOW",
  "depth.deep": "DEEP",
  "depth.abyss": "ABYSS",
  "depth.bottom": "BOTTOM",
} as const;

export type TranslationKey = keyof typeof en;
export default en;
