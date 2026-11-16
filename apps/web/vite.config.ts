import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  server: { port: 5810, strictPort: true },
  // Three.js (~150 kB gzip) loads lazily in its own chunk, only behind Arena pages.
  build: { chunkSizeWarningLimit: 650 },
  preview: { port: 5811, strictPort: true },
});
