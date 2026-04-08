#!/usr/bin/env bun
/// <reference types="bun-types" />
import { readFileSync, mkdirSync } from "node:fs";
import type { BunPlugin } from "bun";
import solidPlugin from "@opentui/solid/bun-plugin";

const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as { version: string };

console.log(`Building oh-my-worktree v${pkg.version}...`);

mkdirSync("dist", { recursive: true });

const PRELOAD_IMPORT_REGEX = /^import "@opentui\/solid\/preload";\s*$/m;

const stripRuntimePreloadPlugin: BunPlugin = {
  name: "strip-runtime-preload",
  setup(build) {
    build.onLoad({ filter: /[\\/]src[\\/]index\.ts$/ }, async (args) => {
      const src = await Bun.file(args.path).text();
      if (!PRELOAD_IMPORT_REGEX.test(src)) {
        throw new Error(
          "strip-runtime-preload: expected `import \"@opentui/solid/preload\";` " +
            "in src/index.ts but none found. The Homebrew regression guard in " +
            "src/index.ts may have been removed — see git 41cc2d3. Restore it or " +
            "remove this plugin.",
        );
      }
      return { contents: src.replace(PRELOAD_IMPORT_REGEX, ""), loader: "ts" };
    });
  },
};

const result = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  target: "bun",
  minify: true,
  naming: "omw.js",
  plugins: [stripRuntimePreloadPlugin, solidPlugin],
  external: [
    "@opentui/core",
    "@opentui/core-darwin-arm64",
    "@opentui/core-darwin-x64",
    "@opentui/core-linux-arm64",
    "@opentui/core-linux-x64",
  ],
});

if (!result.success) {
  console.error("Build failed:", result.logs);
  process.exit(1);
}

const size = result.outputs[0]?.size ?? 0;

console.log("✓ Built dist/omw.js");
console.log(`  Size: ${(size / 1024).toFixed(1)} KB`);
console.log("\nTo install globally:");
console.log("  bun install -g .");
