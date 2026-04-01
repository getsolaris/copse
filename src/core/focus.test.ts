import { afterEach, describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
import { cleanupTempDirs, createTempDir, createTempRepo, runGit } from "./test-helpers";
import { getFocusFilePath, hasFocus, readFocus, writeFocus } from "./focus";

afterEach(cleanupTempDirs);

describe("getFocusFilePath", () => {
  it("returns .git/omw-focus for main worktree", async () => {
    const repoPath = await createTempRepo();
    const focusPath = getFocusFilePath(repoPath);
    expect(focusPath).toBe(join(repoPath, ".git", "omw-focus"));
  });

  it("returns git metadata dir path for linked worktree", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("omw-focus-wt-");
    await runGit(["worktree", "add", wtPath, "-b", "test-focus"], repoPath);

    const focusPath = getFocusFilePath(wtPath);
    expect(focusPath).not.toContain(join(wtPath, ".git"));
    expect(focusPath).toContain("omw-focus");
    expect(focusPath).toContain(repoPath);
  });
});

describe("writeFocus and readFocus", () => {
  it("writes and reads focus for main worktree", async () => {
    const repoPath = await createTempRepo();
    writeFocus(repoPath, ["apps/web", "apps/api"]);
    const result = readFocus(repoPath);
    expect(result).toEqual(["apps/web", "apps/api"]);
  });

  it("writes and reads focus for linked worktree", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("omw-focus-rw-");
    await runGit(["worktree", "add", wtPath, "-b", "test-focus-rw"], repoPath);

    writeFocus(wtPath, ["apps/web", "apps/api"]);
    const result = readFocus(wtPath);
    expect(result).toEqual(["apps/web", "apps/api"]);

    expect(existsSync(join(wtPath, ".omw-focus"))).toBeFalse();
  });

  it("returns null when no focus file exists", async () => {
    const repoPath = await createTempRepo();
    expect(readFocus(repoPath)).toBeNull();
  });

  it("returns empty array for empty focus file", async () => {
    const repoPath = await createTempRepo();
    writeFocus(repoPath, []);
    const result = readFocus(repoPath);
    expect(result).toEqual([]);
  });
});

describe("hasFocus", () => {
  it("returns false when no focus file", async () => {
    const repoPath = await createTempRepo();
    expect(hasFocus(repoPath)).toBeFalse();
  });

  it("returns true after writing focus", async () => {
    const repoPath = await createTempRepo();
    writeFocus(repoPath, ["apps/web"]);
    expect(hasFocus(repoPath)).toBeTrue();
  });
});
