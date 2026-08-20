import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: process.env.PORT ? Number(process.env.PORT) : 8080,
    strictPort: false,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-glossary": ["@stbr/solana-glossary"],
          // The `/i18n` subpath is a distinct module id from the bare
          // specifier above — without its own entry the ~1.1 MB of PT-BR + ES
          // term data lands in the eager entry chunk. It is dynamically
          // imported (src/i18n/glossary.ts), so this chunk stays lazy.
          "glossary-i18n": ["@stbr/solana-glossary/i18n"],
          "vendor-3d": ["gsap", "ogl"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
}));
