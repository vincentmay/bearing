import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react()],
  // Each build knows itself by the moment it was made; what a browser kept from another
  // build is then told apart from this one's.
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) },
  server: { port: 5810, strictPort: true },
  preview: { port: 5811, strictPort: true },
  // The backend's functions are tested in the runtime they run in.
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
