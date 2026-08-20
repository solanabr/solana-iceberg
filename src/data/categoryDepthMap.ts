/**
 * Layer visual metadata for the iceberg's 5 depth levels.
 * Category type is re-exported from the SDK for local use.
 */

import type { Category } from "@stbr/solana-glossary";

export type { Category };

export type DepthId = "surface" | "shallow" | "deep" | "abyss" | "bottom";

export const depthOrder: DepthId[] = [
  "surface",
  "shallow",
  "deep",
  "abyss",
  "bottom",
];

export interface DepthMeta {
  id: DepthId;
  name: string;
  color: string;
  bgGradient: string;
  categories: Category[];
}

export const depthMeta: DepthMeta[] = [
  {
    id: "surface",
    name: "SURFACE",
    color: "hsl(200, 30%, 90%)",
    bgGradient: "linear-gradient(180deg, #1a2a4a 0%, #0f1f3a 100%)",
    categories: ["token-ecosystem", "solana-ecosystem", "web3"],
  },
  {
    id: "shallow",
    name: "SHALLOW",
    color: "hsl(210, 25%, 65%)",
    bgGradient: "linear-gradient(180deg, #0f1f3a 0%, #0a1628 100%)",
    categories: ["defi", "blockchain-general"],
  },
  {
    id: "deep",
    name: "DEEP",
    color: "hsl(215, 30%, 45%)",
    bgGradient: "linear-gradient(180deg, #0a1628 0%, #060e1a 100%)",
    categories: ["core-protocol", "network", "ai-ml"],
  },
  {
    id: "abyss",
    name: "ABYSS",
    color: "hsl(220, 40%, 25%)",
    bgGradient: "linear-gradient(180deg, #060e1a 0%, #030810 100%)",
    categories: ["infrastructure", "security", "zk-compression"],
  },
  {
    id: "bottom",
    name: "BOTTOM",
    color: "hsl(225, 50%, 12%)",
    bgGradient: "linear-gradient(180deg, #030810 0%, #020408 100%)",
    categories: ["programming-model", "programming-fundamentals", "dev-tools"],
  },
];

/** Human-readable labels for SDK categories */
export const categoryLabels: Record<Category, string> = {
  "token-ecosystem": "Token Ecosystem",
  "solana-ecosystem": "Solana Ecosystem",
  web3: "Web3",
  defi: "DeFi",
  "blockchain-general": "Blockchain General",
  "core-protocol": "Core Protocol",
  network: "Network",
  "ai-ml": "AI & ML",
  infrastructure: "Infrastructure",
  security: "Security",
  "zk-compression": "ZK Compression",
  "programming-model": "Programming Model",
  "programming-fundamentals": "Programming Fundamentals",
  "dev-tools": "Dev Tools",
};

/**
 * Per-depth colors used for related-term pills in TermView and the layer
 * title glow in LayerView. Colors progress from warm-green (surface, near
 * the top) through cyan, sky blue, indigo, to Solana purple (bottom, the
 * deepest). Consumers can apply transparency via `<color>55` alpha.
 */
export const depthPillColors: Record<DepthId, string> = {
  surface: "#14F195", // Solana green — top of the iceberg, cultural
  shallow: "#22D3EE", // cyan — transitional
  deep: "#38BDF8", // sky blue — infrastructure / protocol
  abyss: "#818CF8", // indigo — advanced internals
  bottom: "#9945FF", // Solana purple — deepest tier
};

/**
 * Branded color tokens for each category. Values are picked so the 14
 * categories are visually distinct while staying inside the Solana brand
 * palette (purple #9945FF + teal #14F195) and its natural extensions
 * (cyan, violet, pink, amber, etc.).
 *
 * Each entry is a hex string; consumers apply transparency via CSS on
 * top of it (`<color>15` for a 15/255 alpha fill, `<color>60` for border,
 * etc.) so the same value powers background, border, and text treatments.
 */
export const categoryColors: Record<Category, string> = {
  "core-protocol": "#9945FF", // Solana purple — the protocol core
  defi: "#14F195", // Solana teal — defi core
  "solana-ecosystem": "#00D1C1", // aqua — Solana-native projects
  "token-ecosystem": "#A3E635", // lime — tokens & assets
  web3: "#EC4899", // magenta — culture / memes / web3 slang
  "blockchain-general": "#F59E0B", // amber — foundational blockchain
  network: "#38BDF8", // sky — networking / consensus routing
  "ai-ml": "#C084FC", // light violet — AI bridge
  infrastructure: "#60A5FA", // blue — validators, RPC, infra
  security: "#F43F5E", // rose — security / auditing
  "zk-compression": "#22D3EE", // cyan — ZK / compression
  "programming-model": "#818CF8", // indigo — program architecture
  "programming-fundamentals": "#FB923C", // orange — fundamentals
  "dev-tools": "#FACC15", // gold — tooling
};
