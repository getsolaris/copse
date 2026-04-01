import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { cleanupTempDirs, createTempDir } from "./test-helpers";
import {
  detectMonorepoTools,
  discoverPackages,
  expandPackageGlobs,
  validateFocusPaths,
} from "./monorepo";

afterEach(cleanupTempDirs);

describe("detectMonorepoTools", () => {
  it("returns empty when no config files found", () => {
    const dir = createTempDir("omw-mono-empty-");
    const results = detectMonorepoTools(dir);
    expect(results).toHaveLength(0);
  });

  it("detects pnpm workspace", () => {
    const dir = createTempDir("omw-mono-pnpm-");
    writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
    mkdirSync(join(dir, "packages", "ui"), { recursive: true });
    mkdirSync(join(dir, "packages", "utils"), { recursive: true });

    const results = detectMonorepoTools(dir);
    const pnpm = results.find((r) => r.tool === "pnpm");
    expect(pnpm).toBeDefined();
    expect(pnpm!.packagePaths).toContain("packages/ui");
    expect(pnpm!.packagePaths).toContain("packages/utils");
  });

  it("detects nx workspace via project.json files", () => {
    const dir = createTempDir("omw-mono-nx-");
    writeFileSync(join(dir, "nx.json"), JSON.stringify({ version: 2 }));
    mkdirSync(join(dir, "apps", "web"), { recursive: true });
    writeFileSync(join(dir, "apps", "web", "project.json"), JSON.stringify({ name: "web" }));

    const results = detectMonorepoTools(dir);
    const nx = results.find((r) => r.tool === "nx");
    expect(nx).toBeDefined();
    expect(nx!.packagePaths).toContain("apps/web");
  });

  it("detects lerna workspace", () => {
    const dir = createTempDir("omw-mono-lerna-");
    writeFileSync(join(dir, "lerna.json"), JSON.stringify({ packages: ["packages/*"] }));
    mkdirSync(join(dir, "packages", "core"), { recursive: true });

    const results = detectMonorepoTools(dir);
    const lerna = results.find((r) => r.tool === "lerna");
    expect(lerna).toBeDefined();
    expect(lerna!.packagePaths).toContain("packages/core");
  });

  it("detects npm workspaces in package.json", () => {
    const dir = createTempDir("omw-mono-npm-");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    mkdirSync(join(dir, "packages", "shared"), { recursive: true });

    const results = detectMonorepoTools(dir);
    const npm = results.find((r) => r.tool === "npm-workspaces");
    expect(npm).toBeDefined();
    expect(npm!.packagePaths).toContain("packages/shared");
  });

  it("detects yarn workspaces when yarn.lock present", () => {
    const dir = createTempDir("omw-mono-yarn-");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    writeFileSync(join(dir, "yarn.lock"), "");
    mkdirSync(join(dir, "packages", "lib"), { recursive: true });

    const results = detectMonorepoTools(dir);
    const yarn = results.find((r) => r.tool === "yarn-workspaces");
    expect(yarn).toBeDefined();
    expect(yarn!.packagePaths).toContain("packages/lib");
  });

  it("detects turbo workspace with package.json workspaces", () => {
    const dir = createTempDir("omw-mono-turbo-");
    writeFileSync(join(dir, "turbo.json"), JSON.stringify({ pipeline: {} }));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ workspaces: ["apps/*"] }));
    mkdirSync(join(dir, "apps", "web"), { recursive: true });

    const results = detectMonorepoTools(dir);
    const turbo = results.find((r) => r.tool === "turbo");
    expect(turbo).toBeDefined();
    expect(turbo!.packagePaths).toContain("apps/web");
  });

  it("detects multiple tools in same repo", () => {
    const dir = createTempDir("omw-mono-multi-");
    writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
    writeFileSync(join(dir, "turbo.json"), JSON.stringify({}));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    mkdirSync(join(dir, "packages", "ui"), { recursive: true });

    const results = detectMonorepoTools(dir);
    const tools = results.map((r) => r.tool);
    expect(tools).toContain("pnpm");
    expect(tools).toContain("turbo");
  });
});

describe("expandPackageGlobs", () => {
  it("expands single-level glob", () => {
    const dir = createTempDir("omw-glob-");
    mkdirSync(join(dir, "apps", "web"), { recursive: true });
    mkdirSync(join(dir, "apps", "api"), { recursive: true });

    const result = expandPackageGlobs(dir, ["apps/*"]);
    expect(result).toContain("apps/web");
    expect(result).toContain("apps/api");
  });

  it("expands two-level glob for msa-style structure", () => {
    const dir = createTempDir("omw-glob-2-");
    mkdirSync(join(dir, "apps", "core", "auth"), { recursive: true });
    mkdirSync(join(dir, "apps", "domain", "coupon"), { recursive: true });

    const result = expandPackageGlobs(dir, ["apps/*/*"]);
    expect(result).toContain("apps/core/auth");
    expect(result).toContain("apps/domain/coupon");
  });

  it("returns empty for non-matching patterns", () => {
    const dir = createTempDir("omw-glob-empty-");
    const result = expandPackageGlobs(dir, ["nonexistent/*"]);
    expect(result).toHaveLength(0);
  });

  it("returns sorted results", () => {
    const dir = createTempDir("omw-glob-sort-");
    mkdirSync(join(dir, "packages", "zlib"), { recursive: true });
    mkdirSync(join(dir, "packages", "alpha"), { recursive: true });

    const result = expandPackageGlobs(dir, ["packages/*"]);
    expect(result[0]).toBe("packages/alpha");
    expect(result[1]).toBe("packages/zlib");
  });

  it("handles multiple patterns", () => {
    const dir = createTempDir("omw-glob-multi-");
    mkdirSync(join(dir, "apps", "web"), { recursive: true });
    mkdirSync(join(dir, "packages", "ui"), { recursive: true });

    const result = expandPackageGlobs(dir, ["apps/*", "packages/*"]);
    expect(result).toContain("apps/web");
    expect(result).toContain("packages/ui");
  });

  it("skips files, only returns directories", () => {
    const dir = createTempDir("omw-glob-files-");
    mkdirSync(join(dir, "packages", "ui"), { recursive: true });
    writeFileSync(join(dir, "packages", "README.md"), "# readme");

    const result = expandPackageGlobs(dir, ["packages/*"]);
    expect(result).toContain("packages/ui");
    expect(result).not.toContain("packages/README.md");
  });
});

describe("discoverPackages", () => {
  it("combines auto-detected and extra patterns (msa-style)", () => {
    const dir = createTempDir("omw-discover-");
    writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
    mkdirSync(join(dir, "packages", "ui"), { recursive: true });
    mkdirSync(join(dir, "apps", "core", "auth"), { recursive: true });
    mkdirSync(join(dir, "apps", "domain", "coupon"), { recursive: true });

    const result = discoverPackages(dir, ["apps/*/*"]);
    expect(result.all).toContain("packages/ui");
    expect(result.all).toContain("apps/core/auth");
    expect(result.all).toContain("apps/domain/coupon");
  });

  it("deduplicates when same path in auto-detect and extra", () => {
    const dir = createTempDir("omw-dedup-");
    writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
    mkdirSync(join(dir, "packages", "ui"), { recursive: true });

    const result = discoverPackages(dir, ["packages/*"]);
    const uiCount = result.all.filter((p) => p === "packages/ui").length;
    expect(uiCount).toBe(1);
  });

  it("returns detected results separately", () => {
    const dir = createTempDir("omw-discover-det-");
    writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
    mkdirSync(join(dir, "packages", "ui"), { recursive: true });

    const result = discoverPackages(dir);
    expect(result.detected).toHaveLength(1);
    expect(result.detected[0].tool).toBe("pnpm");
    expect(result.extra).toHaveLength(0);
  });

  it("returns extra patterns separately", () => {
    const dir = createTempDir("omw-discover-extra-");
    mkdirSync(join(dir, "services", "api"), { recursive: true });

    const result = discoverPackages(dir, ["services/*"]);
    expect(result.detected).toHaveLength(0);
    expect(result.extra).toContain("services/api");
    expect(result.all).toContain("services/api");
  });
});

describe("validateFocusPaths", () => {
  it("separates valid from invalid paths", () => {
    const dir = createTempDir("omw-validate-");
    mkdirSync(join(dir, "apps", "web"), { recursive: true });

    const result = validateFocusPaths(dir, ["apps/web", "apps/nonexistent"]);
    expect(result.valid).toContain("apps/web");
    expect(result.invalid).toContain("apps/nonexistent");
  });

  it("returns all valid when all paths exist", () => {
    const dir = createTempDir("omw-validate-all-");
    mkdirSync(join(dir, "packages", "ui"), { recursive: true });

    const result = validateFocusPaths(dir, ["packages/ui"]);
    expect(result.valid).toEqual(["packages/ui"]);
    expect(result.invalid).toHaveLength(0);
  });

  it("marks empty strings as invalid", () => {
    const dir = createTempDir("omw-validate-empty-");
    const result = validateFocusPaths(dir, ["", "  "]);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(2);
  });

  it("marks files (not directories) as invalid", () => {
    const dir = createTempDir("omw-validate-file-");
    writeFileSync(join(dir, "somefile.txt"), "content");

    const result = validateFocusPaths(dir, ["somefile.txt"]);
    expect(result.invalid).toContain("somefile.txt");
    expect(result.valid).toHaveLength(0);
  });
});
