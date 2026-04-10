import { afterEach, describe, expect, it } from "bun:test";
import { basename, join } from "path";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { cleanupTempDirs, createTempDir, createTempRepo, runGit } from "./test-helpers";
import {
  checkConfig,
  checkDirtyWorktrees,
  checkGitVersion,
  checkLockStatus,
  checkOrphanedDirectories,
  checkStaleWorktrees,
  fixOrphanedDirectories,
  runAllChecks,
} from "./doctor";
import { GitWorktree } from "./git";
import { invalidateGitCache } from "./git";

const originalXdgConfigHome = Bun.env.XDG_CONFIG_HOME;
const originalHome = Bun.env.HOME;

afterEach(() => {
  invalidateGitCache();

  if (originalXdgConfigHome === undefined) {
    delete Bun.env.XDG_CONFIG_HOME;
  } else {
    Bun.env.XDG_CONFIG_HOME = originalXdgConfigHome;
  }

  if (originalHome === undefined) {
    delete Bun.env.HOME;
  } else {
    Bun.env.HOME = originalHome;
  }

  cleanupTempDirs();
});

describe("checkGitVersion", () => {
  it("passes with installed git version", async () => {
    const result = await checkGitVersion();
    expect(result.name).toBe("Git version");
    expect(result.status).toBe("pass");
    expect(result.message).toMatch(/\d+\.\d+/);
  });
});

describe("checkConfig", () => {
  it("passes when config is missing (default config)", async () => {
    const result = await checkConfig();
    expect(result.name).toBe("Configuration");
    expect(result.status).toBe("pass");
    expect(result.message).toBe("valid");
  });
});

describe("checkStaleWorktrees", () => {
  it("passes with empty worktree list", () => {
    const result = checkStaleWorktrees([]);
    expect(result.name).toBe("Stale worktrees");
    expect(result.status).toBe("pass");
    expect(result.message).toBe("none");
  });

  it("passes when all worktree paths exist", async () => {
    const repoPath = await createTempRepo();
    const worktrees = await GitWorktree.list(repoPath);
    const result = checkStaleWorktrees(worktrees);
    expect(result.name).toBe("Stale worktrees");
    expect(result.status).toBe("pass");
    expect(result.message).toBe("none");
  });

  it("warns when a worktree directory was deleted", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("copse-wt-");
    await runGit(["worktree", "add", wtPath, "-b", "test-stale"], repoPath);
    rmSync(wtPath, { recursive: true, force: true });

    invalidateGitCache();
    const worktrees = await GitWorktree.list(repoPath);
    const result = checkStaleWorktrees(worktrees);
    expect(result.status).toBe("warn");
    expect(result.message).toBe("missing worktree paths");
    expect(result.detail).toBeDefined();
    expect(result.detail!.some((d) => d.includes(wtPath))).toBeTrue();
  });
});

describe("checkDirtyWorktrees", () => {
  it("passes when all worktrees are clean", async () => {
    const repoPath = await createTempRepo();
    const worktrees = await GitWorktree.list(repoPath);
    const result = checkDirtyWorktrees(worktrees);
    expect(result.name).toBe("Dirty worktrees");
    expect(result.status).toBe("pass");
    expect(result.message).toBe("none");
  });

  it("warns when a non-main worktree is dirty", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("copse-dirty-");
    await runGit(["worktree", "add", wtPath, "-b", "test-dirty"], repoPath);
    writeFileSync(join(wtPath, "dirty.txt"), "dirty content");

    invalidateGitCache();
    const worktrees = await GitWorktree.list(repoPath);
    const result = checkDirtyWorktrees(worktrees);
    expect(result.status).toBe("warn");
    expect(result.message).toBe("dirty non-main worktrees found");
    expect(result.detail).toBeDefined();
    expect(result.detail!.some((d) => d.includes("test-dirty"))).toBeTrue();
  });
});

describe("checkLockStatus", () => {
  it("passes when no worktrees are locked", async () => {
    const repoPath = await createTempRepo();
    const worktrees = await GitWorktree.list(repoPath);
    const result = checkLockStatus(worktrees);
    expect(result.name).toBe("Worktree locks");
    expect(result.status).toBe("pass");
    expect(result.message).toBe("all clear");
  });

  it("warns when a worktree is locked", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("copse-lock-");
    await runGit(["worktree", "add", wtPath, "-b", "test-lock"], repoPath);
    await runGit(["worktree", "lock", wtPath], repoPath);

    invalidateGitCache();
    const worktrees = await GitWorktree.list(repoPath);
    const result = checkLockStatus(worktrees);
    expect(result.status).toBe("warn");
    expect(result.message).toBe("locked worktrees present");
    expect(result.detail).toBeDefined();
    expect(result.detail!.some((d) => d.includes("test-lock"))).toBeTrue();
  });
});

describe("checkOrphanedDirectories", () => {
  it("passes when no orphaned directories exist", async () => {
    const repoPath = await createTempRepo();
    const worktrees = await GitWorktree.list(repoPath);
    const result = checkOrphanedDirectories(worktrees);
    expect(result.name).toBe("Orphaned directories");
    expect(result.status).toBe("pass");
  });

  it("detects orphaned directories under configured custom worktreeDir", async () => {
    const repoPath = await createTempRepo();
    const configRoot = createTempDir("copse-doctor-config-");
    const xdgConfigHome = join(configRoot, "xdg");
    const configDir = join(xdgConfigHome, "copse");
    const customWorktreeBase = join(configRoot, "custom-worktrees");
    const orphanPath = join(customWorktreeBase, `${basename(repoPath)}-orphan`);

    Bun.env.XDG_CONFIG_HOME = xdgConfigHome;
    Bun.env.HOME = configRoot;

    mkdirSync(configDir, { recursive: true });
    mkdirSync(orphanPath, { recursive: true });
    writeFileSync(join(configDir, "config.json"), JSON.stringify({
      version: 1,
      defaults: {
        worktreeDir: `${customWorktreeBase}/{repo}-{branch}`,
      },
    }, null, 2), "utf-8");
    writeFileSync(join(orphanPath, "marker.txt"), "orphan");

    const worktrees = await GitWorktree.list(repoPath);
    const result = checkOrphanedDirectories(worktrees);

    expect(result.status).toBe("warn");
    expect(result.detail).toContain(orphanPath);
  });
});

describe("fixOrphanedDirectories", () => {
  it("removes orphaned directories under configured custom worktreeDir", async () => {
    const repoPath = await createTempRepo();
    const configRoot = createTempDir("copse-doctor-fix-");
    const xdgConfigHome = join(configRoot, "xdg");
    const configDir = join(xdgConfigHome, "copse");
    const customWorktreeBase = join(configRoot, "custom-worktrees");
    const orphanPath = join(customWorktreeBase, `${basename(repoPath)}-orphan`);

    Bun.env.XDG_CONFIG_HOME = xdgConfigHome;
    Bun.env.HOME = configRoot;

    mkdirSync(configDir, { recursive: true });
    mkdirSync(orphanPath, { recursive: true });
    writeFileSync(join(configDir, "config.json"), JSON.stringify({
      version: 1,
      defaults: {
        worktreeDir: `${customWorktreeBase}/{repo}-{branch}`,
      },
    }, null, 2), "utf-8");
    writeFileSync(join(orphanPath, "marker.txt"), "orphan");

    const results = await fixOrphanedDirectories(repoPath);

    expect(results.some((result) => result.success && result.detail === orphanPath)).toBeTrue();
    expect(existsSync(orphanPath)).toBeFalse();
  });
});

describe("runAllChecks", () => {
  it("returns report with all 6 checks", async () => {
    const repoPath = await createTempRepo();
    const report = await runAllChecks(repoPath);
    expect(report.checks).toHaveLength(6);
    expect(report.checks.every((c) => c.name)).toBeTrue();

    const names = report.checks.map((c) => c.name);
    expect(names).toContain("Git version");
    expect(names).toContain("Configuration");
    expect(names).toContain("Stale worktrees");
    expect(names).toContain("Orphaned directories");
    expect(names).toContain("Worktree locks");
    expect(names).toContain("Dirty worktrees");
  });

  it("returns healthy=true on clean repo", async () => {
    const repoPath = await createTempRepo();
    const report = await runAllChecks(repoPath);
    expect(report.healthy).toBeDefined();
    expect(typeof report.healthy).toBe("boolean");
  });

  it("returns healthy=false when issues exist", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("copse-unhealthy-");
    await runGit(["worktree", "add", wtPath, "-b", "test-unhealthy"], repoPath);
    await runGit(["worktree", "lock", wtPath], repoPath);

    const report = await runAllChecks(repoPath);
    expect(report.healthy).toBeFalse();
  });
});
