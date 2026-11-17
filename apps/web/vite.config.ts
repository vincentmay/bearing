import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite-plus";
import { defineConfig } from "vite-plus";

/**
 * The chess engine is two files that have to sit side by side under their own names: a
 * script, and the WebAssembly it loads from next to itself. They are served as they come in
 * the package, at /engine/, in development and in a build alike.
 */
function engine(): Plugin {
  const bin = join(
    dirname(createRequire(import.meta.url).resolve("stockfish/package.json")),
    "bin",
  );
  const files = ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"];
  return {
    name: "bearing-engine",
    configureServer(server) {
      server.middlewares.use("/engine", (request, response, next) => {
        const name = request.url?.split("?")[0]?.slice(1);
        if (!name || !files.includes(name)) return next();
        response.setHeader(
          "Content-Type",
          name.endsWith(".wasm") ? "application/wasm" : "text/javascript",
        );
        response.end(readFileSync(join(bin, name)));
      });
    },
    generateBundle() {
      for (const name of files)
        this.emitFile({
          type: "asset",
          fileName: `engine/${name}`,
          source: readFileSync(join(bin, name)),
        });
    },
  };
}

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), engine()],
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
