import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, realpathSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { GitWorktree, invalidateGitCache } from "./git";
import { GitError } from "./types";
import {
  cleanupTempDirs,
  createTempDir,
  createTempRepo,
  createTempRepoWithRemote,
  runGit,
} from "./test-helpers";

afterEach(() => {
  invalidateGitCache();
  cleanupTempDirs();
});

describe("GitWorktree.parsePorcelain", () => {
  it("parses normal worktree output", () => {
    const output = [
      "worktree /repo/main",
      "HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "branch refs/heads/main",
      "",
      "worktree /repo/wt-feature",
      "HEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "branch refs/heads/feature/test",
    ].join("\n");

    const parsed = (GitWorktree as any).parsePorcelain(output);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      path: "/repo/main",
      branch: "main",
      head: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      isMain: true,
      isLocked: false,
      isDirty: false,
    });
    expect(parsed[1]).toMatchObject({
      path: "/repo/wt-feature",
      branch: "feature/test",
      head: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      isMain: false,
      isLocked: false,
      isDirty: false,
    });
  });

  it("parses detached HEAD worktree", () => {
    const output = [
      "worktree /repo/main",
      "HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "branch refs/heads/main",
      "",
      "worktree /repo/wt-detached",
      "HEAD cccccccccccccccccccccccccccccccccccccccc",
      "detached",
    ].join("\n");

    const parsed = (GitWorktree as any).parsePorcelain(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[1].branch).toBeNull();
    expect(parsed[1].head).toBe("cccccccccccccccccccccccccccccccccccccccc");
  });

  it("parses locked worktree with reason", () => {
    const output = [
      "worktree /repo/main",
      "HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "branch refs/heads/main",
      "",
      "worktree /repo/wt-locked",
      "HEAD dddddddddddddddddddddddddddddddddddddddd",
      "branch refs/heads/feature/locked",
      "locked migration-in-progress",
    ].join("\n");

    const parsed = (GitWorktree as any).parsePorcelain(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[1].isLocked).toBeTrue();
    expect(parsed[1].lockReason).toBe("migration-in-progress");
  });
});

describe("GitWorktree integration", () => {
  let testDir = "";

  beforeEach(async () => {
    testDir = await createTempRepo("copse-test-");
  });

  afterEach(() => {
    cleanupTempDirs();
  });

  it("list() returns main repo as first entry", async () => {
    const list = await GitWorktree.list(testDir);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].isMain).toBeTrue();
    expect(realpathSync(list[0].path)).toBe(realpathSync(testDir));
  });

  it("list() with a linked worktree returns 2 entries", async () => {
    const worktreePath = join(testDir, "..", `copse-wt-${Date.now()}`);
    try {
      await GitWorktree.add("feature/list", worktreePath, { createBranch: true }, testDir);

      const list = await GitWorktree.list(testDir);
      expect(list).toHaveLength(2);
      expect(realpathSync(list[1].path)).toBe(realpathSync(worktreePath));
    } finally {
      rmSync(worktreePath, { recursive: true, force: true });
    }
  });

  it("add() creates worktree directory", async () => {
    const worktreePath = join(testDir, "..", `copse-add-${Date.now()}`);
    try {
      await GitWorktree.add("feature/add", worktreePath, { createBranch: true }, testDir);
      expect(existsSync(worktreePath)).toBeTrue();
    } finally {
      rmSync(worktreePath, { recursive: true, force: true });
    }
  });

  it("add() creates a missing branch without createBranch option", async () => {
    const worktreePath = join(testDir, "..", `copse-auto-create-${Date.now()}`);
    try {
      await GitWorktree.add("feature/auto-create", worktreePath, undefined, testDir);

      expect(existsSync(worktreePath)).toBeTrue();
      expect(await GitWorktree.localBranchExists("feature/auto-create", testDir)).toBeTrue();
    } finally {
      rmSync(worktreePath, { recursive: true, force: true });
    }
  });

  it("add() uses base only when creating a new branch", async () => {
    const createdPath = join(testDir, "..", `copse-base-created-${Date.now()}`);
    const existingPath = join(testDir, "..", `copse-base-existing-${Date.now()}`);

    try {
      await runGit(["checkout", "-b", "develop"], testDir);
      writeFileSync(join(testDir, "develop.txt"), "from develop\n");
      await runGit(["add", "develop.txt"], testDir);
      await runGit(["commit", "-m", "develop commit"], testDir);
      await runGit(["checkout", "main"], testDir);

      await GitWorktree.add("feature/from-develop", createdPath, { base: "develop" }, testDir);
      expect(existsSync(join(createdPath, "develop.txt"))).toBeTrue();

      await runGit(["branch", "feature/existing", "main"], testDir);
      await GitWorktree.add("feature/existing", existingPath, { createBranch: true, base: "develop" }, testDir);
      expect(existsSync(join(existingPath, "develop.txt"))).toBeFalse();
    } finally {
      rmSync(createdPath, { recursive: true, force: true });
      rmSync(existingPath, { recursive: true, force: true });
    }
  });

  it("remove() removes worktree directory", async () => {
    const worktreePath = join(testDir, "..", `copse-remove-${Date.now()}`);
    await GitWorktree.add("feature/remove", worktreePath, { createBranch: true }, testDir);
    expect(existsSync(worktreePath)).toBeTrue();

    await GitWorktree.remove(worktreePath, undefined, testDir);
    expect(existsSync(worktreePath)).toBeFalse();
  });

  it("isDirty() returns false on clean repo", async () => {
    const dirty = await GitWorktree.isDirty(testDir);
    expect(dirty).toBeFalse();
  });

  it("isDirty() returns true after creating untracked file", async () => {
    writeFileSync(join(testDir, "untracked.txt"), "content");
    const dirty = await GitWorktree.isDirty(testDir);
    expect(dirty).toBeTrue();
  });

  it("list() from non-git directory throws GitError with not a git repository", async () => {
    const nonGitDir = createTempDir("copse-non-git-");
    try {
      await expect(GitWorktree.list(nonGitDir)).rejects.toBeInstanceOf(GitError);

      try {
        await GitWorktree.list(nonGitDir);
      } catch (error) {
        expect(error).toBeInstanceOf(GitError);
        expect((error as GitError).stderr).toContain("not a git repository");
      }
    } finally {
      rmSync(nonGitDir, { recursive: true, force: true });
    }
  });

  it("checkVersion() passes for supported git versions", async () => {
    await expect(GitWorktree.checkVersion()).resolves.toBeUndefined();
  });
});

describe("GitWorktree upstream methods", () => {
  let testDir = "";
  let remoteDir = "";

  beforeEach(async () => {
    const result = await createTempRepoWithRemote("copse-upstream-");
    testDir = result.repoPath;
    remoteDir = result.remotePath;
  });

  afterEach(() => {
    cleanupTempDirs();
  });

  it("remoteBranchExists() returns true for existing remote branch", async () => {
    const branch = await GitWorktree.getBranchForWorktree(testDir);
    expect(branch).not.toBeNull();

    const exists = await GitWorktree.remoteBranchExists(branch as string, "origin", testDir);
    expect(exists).toBeTrue();
  });

  it("remoteBranchExists() returns false for non-existent branch", async () => {
    const exists = await GitWorktree.remoteBranchExists("feature/does-not-exist", "origin", testDir);
    expect(exists).toBeFalse();
  });

  it("remoteBranchExists() works with slash-containing branch names", async () => {
    await runGit(["checkout", "-b", "feature/auth"], testDir);
    await runGit(["push", "origin", "feature/auth"], testDir);
    await runGit(["checkout", "-"], testDir);

    const exists = await GitWorktree.remoteBranchExists("feature/auth", "origin", testDir);
    expect(exists).toBeTrue();
  });

  it("setUpstream() sets upstream successfully", async () => {
    const branch = (await GitWorktree.getBranchForWorktree(testDir)) as string;

    await GitWorktree.setUpstream(branch, "origin", testDir);

    const remote = await (GitWorktree as any).run(["config", `branch.${branch}.remote`], testDir);
    expect(remote).toBe("origin");
  });

  it("setUpstream() does not overwrite existing upstream", async () => {
    const branch = (await GitWorktree.getBranchForWorktree(testDir)) as string;
    const backupRemote = createTempDir("copse-backup-remote-");

    await runGit(["init", "--bare"], backupRemote);
    await runGit(["remote", "add", "backup", backupRemote], testDir);
    await (GitWorktree as any).run(["config", `branch.${branch}.remote`, "backup"], testDir);
    await (GitWorktree as any).run(["config", `branch.${branch}.merge`, `refs/heads/${branch}`], testDir);

    await GitWorktree.setUpstream(branch, "origin", testDir);

    const remote = await (GitWorktree as any).run(["config", `branch.${branch}.remote`], testDir);
    expect(remote).toBe("backup");
  });

  it("getDefaultRemote() returns origin by default", async () => {
    const remote = await GitWorktree.getDefaultRemote(testDir);
    expect(remote).toBe("origin");
    expect(existsSync(remoteDir)).toBeTrue();
  });

  it("getDefaultRemote() returns configured checkout.defaultRemote", async () => {
    await runGit(["config", "checkout.defaultRemote", "upstream"], testDir);

    const remote = await GitWorktree.getDefaultRemote(testDir);
    expect(remote).toBe("upstream");
  });
});
