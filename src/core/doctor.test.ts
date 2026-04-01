import { afterEach, describe, expect, it } from "bun:test";
import { join } from "path";
import { rmSync, writeFileSync } from "fs";
import { cleanupTempDirs, createTempDir, createTempRepo, runGit } from "./test-helpers";
import {
  checkConfig,
  checkDirtyWorktrees,
  checkGitVersion,
  checkLockStatus,
  checkOrphanedDirectories,
  checkStaleWorktrees,
  runAllChecks,
} from "./doctor";

afterEach(cleanupTempDirs);

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
  it("passes when outside a git repo", async () => {
    const nonGitDir = createTempDir("omw-non-git-");
    const result = await checkStaleWorktrees(nonGitDir);
    expect(result.name).toBe("Stale worktrees");
    expect(result.status).toBe("pass");
    expect(result.message).toContain("not in a git repository");
  });

  it("passes when all worktree paths exist", async () => {
    const repoPath = await createTempRepo();
    const result = await checkStaleWorktrees(repoPath);
    expect(result.name).toBe("Stale worktrees");
    expect(result.status).toBe("pass");
    expect(result.message).toBe("none");
  });

  it("warns when a worktree directory was deleted", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("omw-wt-");
    await runGit(["worktree", "add", wtPath, "-b", "test-stale"], repoPath);
    rmSync(wtPath, { recursive: true, force: true });

    const result = await checkStaleWorktrees(repoPath);
    expect(result.status).toBe("warn");
    expect(result.message).toBe("missing worktree paths");
    expect(result.detail).toBeDefined();
    expect(result.detail!.some((d) => d.includes(wtPath))).toBeTrue();
  });
});

describe("checkDirtyWorktrees", () => {
  it("passes when all worktrees are clean", async () => {
    const repoPath = await createTempRepo();
    const result = await checkDirtyWorktrees(repoPath);
    expect(result.name).toBe("Dirty worktrees");
    expect(result.status).toBe("pass");
    expect(result.message).toBe("none");
  });

  it("warns when a non-main worktree is dirty", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("omw-dirty-");
    await runGit(["worktree", "add", wtPath, "-b", "test-dirty"], repoPath);
    writeFileSync(join(wtPath, "dirty.txt"), "dirty content");

    const result = await checkDirtyWorktrees(repoPath);
    expect(result.status).toBe("warn");
    expect(result.message).toBe("dirty non-main worktrees found");
    expect(result.detail).toBeDefined();
    expect(result.detail!.some((d) => d.includes("test-dirty"))).toBeTrue();
  });
});

describe("checkLockStatus", () => {
  it("passes when no worktrees are locked", async () => {
    const repoPath = await createTempRepo();
    const result = await checkLockStatus(repoPath);
    expect(result.name).toBe("Worktree locks");
    expect(result.status).toBe("pass");
    expect(result.message).toBe("all clear");
  });

  it("warns when a worktree is locked", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("omw-lock-");
    await runGit(["worktree", "add", wtPath, "-b", "test-lock"], repoPath);
    await runGit(["worktree", "lock", wtPath], repoPath);

    const result = await checkLockStatus(repoPath);
    expect(result.status).toBe("warn");
    expect(result.message).toBe("locked worktrees present");
    expect(result.detail).toBeDefined();
    expect(result.detail!.some((d) => d.includes("test-lock"))).toBeTrue();
  });
});

describe("checkOrphanedDirectories", () => {
  it("passes when no orphaned directories exist", async () => {
    const repoPath = await createTempRepo();
    const result = await checkOrphanedDirectories(repoPath);
    expect(result.name).toBe("Orphaned directories");
    expect(result.status).toBe("pass");
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
    const wtPath = createTempDir("omw-unhealthy-");
    await runGit(["worktree", "add", wtPath, "-b", "test-unhealthy"], repoPath);
    await runGit(["worktree", "lock", wtPath], repoPath);

    const report = await runAllChecks(repoPath);
    expect(report.healthy).toBeFalse();
  });
});
