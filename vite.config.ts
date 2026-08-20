import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const r = (p: string) => path.resolve(__dirname, p);

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
          "vendor-3d": ["gsap", "ogl"],
          // Eager glossary payload: ids, names, depths, categories, tags,
          // aliases and related ids — everything the iceberg, the layer cards
          // and the search list render, and nothing they don't. Kept in its
          // own chunk so shipping app code does not invalidate term data.
          //
          // Definitions are NOT listed here on purpose: they reach the browser
          // through the dynamic import in src/data/definitionStore.ts, which is
          // what keeps them off the critical path.
          "glossary-meta": [r("src/data/generated/glossaryMeta.ts")],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": r("./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
}));
