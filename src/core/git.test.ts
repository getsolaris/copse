import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, realpathSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { GitWorktree } from "./git";
import { GitError } from "./types";
import { cleanupTempDirs, createTempDir, createTempRepo } from "./test-helpers";

afterEach(() => {
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
    testDir = await createTempRepo("omw-test-");
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
    const worktreePath = join(testDir, "..", `omw-wt-${Date.now()}`);
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
    const worktreePath = join(testDir, "..", `omw-add-${Date.now()}`);
    try {
      await GitWorktree.add("feature/add", worktreePath, { createBranch: true }, testDir);
      expect(existsSync(worktreePath)).toBeTrue();
    } finally {
      rmSync(worktreePath, { recursive: true, force: true });
    }
  });

  it("remove() removes worktree directory", async () => {
    const worktreePath = join(testDir, "..", `omw-remove-${Date.now()}`);
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
    const nonGitDir = createTempDir("omw-non-git-");
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
