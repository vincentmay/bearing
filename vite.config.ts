import { defineConfig } from "vite-plus";

export default defineConfig({
  // Generated files are written by their tools in their own style.
  fmt: {
    ignorePatterns: [
      "**/routeTree.gen.ts",
      "**/convex/_generated/**",
      "**/.agents/**",
      "**/.claude/**",
      "**/AGENTS.md",
      "**/CLAUDE.md",
      "**/skills-lock.json",
      ".local/**",
    ],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
