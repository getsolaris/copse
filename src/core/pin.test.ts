import { afterEach, describe, expect, it } from "bun:test";
import type { Worktree } from "./types.ts";
import { invalidateGitCache } from "./git.ts";
import { isPinned, listPinnedWorktrees, readPin, removePin, writePin } from "./pin.ts";
import { cleanupTempDirs, createTempDir, createTempRepo, runGit } from "./test-helpers.ts";

function createWorktree(path: string, branch: string | null, isMain = false): Worktree {
  return {
    path,
    branch,
    head: "",
    isMain,
    isDirty: false,
    isLocked: false,
    repoName: "repo",
    repoPath: path,
  };
}

afterEach(() => {
  cleanupTempDirs();
  invalidateGitCache();
});

describe("writePin and readPin", () => {
  it("writes and reads pin metadata for main worktree", async () => {
    const repoPath = await createTempRepo();

    writePin(repoPath, "important branch");
    const pin = readPin(repoPath);

    expect(pin).not.toBeNull();
    expect(pin?.branch).toBe("main");
    expect(pin?.reason).toBe("important branch");
    expect(Number.isNaN(Date.parse(pin?.pinnedAt ?? ""))).toBeFalse();
  });

  it("writes and reads pin metadata for linked worktree", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("copse-pin-linked-");
    await runGit(["worktree", "add", wtPath, "-b", "feature/pinned"], repoPath);

    writePin(wtPath, "linked");
    const pin = readPin(wtPath);

    expect(pin).not.toBeNull();
    expect(pin?.branch).toBe("feature/pinned");
    expect(pin?.reason).toBe("linked");
  });

  it("returns null when pin file does not exist", async () => {
    const repoPath = await createTempRepo();
    expect(readPin(repoPath)).toBeNull();
  });
});

describe("isPinned and removePin", () => {
  it("tracks pin state changes", async () => {
    const repoPath = await createTempRepo();

    expect(isPinned(repoPath)).toBeFalse();
    writePin(repoPath);
    expect(isPinned(repoPath)).toBeTrue();

    removePin(repoPath);
    expect(isPinned(repoPath)).toBeFalse();
  });

  it("supports double-pin by overwriting metadata", async () => {
    const repoPath = await createTempRepo();

    writePin(repoPath, "first");
    const first = readPin(repoPath);

    await new Promise((resolve) => setTimeout(resolve, 10));
    writePin(repoPath, "second");
    const second = readPin(repoPath);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second?.reason).toBe("second");
    expect(Date.parse(second?.pinnedAt ?? "")).toBeGreaterThan(
      Date.parse(first?.pinnedAt ?? ""),
    );
  });

  it("does not throw when removing non-existent pin", async () => {
    const repoPath = await createTempRepo();

    removePin(repoPath);
    expect(isPinned(repoPath)).toBeFalse();
  });
});

describe("listPinnedWorktrees", () => {
  it("returns only pinned worktrees for main and linked entries", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("copse-pin-list-linked-");
    const otherPath = createTempDir("copse-pin-list-other-");

    await runGit(["worktree", "add", wtPath, "-b", "feature/list"], repoPath);

    writePin(repoPath, "main");
    writePin(wtPath, "linked");

    const all = [
      createWorktree(repoPath, "main", true),
      createWorktree(wtPath, "feature/list"),
      createWorktree(otherPath, "feature/other"),
    ];

    const pinned = listPinnedWorktrees(all);
    expect(pinned.map((worktree) => worktree.path).sort()).toEqual([repoPath, wtPath].sort());
  });
});
