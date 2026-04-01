#!/usr/bin/env bun
/// <reference types="bun-types" />
import { readFileSync, mkdirSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as { version: string };

console.log(`Building oh-my-worktree v${pkg.version}...`);

mkdirSync("dist", { recursive: true });

const result = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  target: "bun",
  minify: true,
  naming: "omw.js",
  external: [
    "@opentui/core",
    "@opentui/solid",
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
