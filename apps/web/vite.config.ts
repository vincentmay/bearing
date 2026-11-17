import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite-plus";
import { defineConfig } from "vite-plus";

/**
 * The chess engine is two files that have to sit side by side under their own names: a
 * script, and the WebAssembly it loads from next to itself. They are served as they come in
 * the package, at /stockfish/, in development and in a build alike.
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
      server.middlewares.use("/stockfish", (request, response, next) => {
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
          fileName: `stockfish/${name}`,
          source: readFileSync(join(bin, name)),
        });
    },
  };
}

/**
 * A copy of the page under the name Cloudflare Pages answers unknown addresses with. With it
 * there, an address that is nothing is answered "not found" and not with the page as if all
 * were well; the addresses that are something are listed in `public/_redirects`.
 */
function notFound(): Plugin {
  return {
    name: "bearing-not-found",
    apply: "build",
    closeBundle() {
      const out = join(import.meta.dirname, "dist");
      if (existsSync(join(out, "index.html")))
        copyFileSync(join(out, "index.html"), join(out, "404.html"));
    },
  };
}

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    engine(),
    notFound(),
  ],
  // Each build knows itself by the moment it was made; what a browser kept from another
  // build is then told apart from this one's.
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) },
  // Where the built code goes. Not `assets`: see `public/_headers` for why that address is
  // not used again.
  build: { assetsDir: "static" },
  server: { port: 5810, strictPort: true },
  preview: { port: 5811, strictPort: true },
  // The backend's functions are tested in the runtime they run in.
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
