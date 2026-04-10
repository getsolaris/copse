import { afterEach, describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
import { cleanupTempDirs, createTempDir, createTempRepo, runGit } from "./test-helpers";
import {
  FocusNotFoundError,
  getFocusFilePath,
  hasFocus,
  readFocus,
  resolveFocusOpenTarget,
  writeFocus,
} from "./focus";

afterEach(cleanupTempDirs);

describe("getFocusFilePath", () => {
  it("returns .git/copse-focus for main worktree", async () => {
    const repoPath = await createTempRepo();
    const focusPath = getFocusFilePath(repoPath);
    expect(focusPath).toBe(join(repoPath, ".git", "copse-focus"));
  });

  it("returns git metadata dir path for linked worktree", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("copse-focus-wt-");
    await runGit(["worktree", "add", wtPath, "-b", "test-focus"], repoPath);

    const focusPath = getFocusFilePath(wtPath);
    expect(focusPath).not.toContain(join(wtPath, ".git"));
    expect(focusPath).toContain("copse-focus");
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
    const wtPath = createTempDir("copse-focus-rw-");
    await runGit(["worktree", "add", wtPath, "-b", "test-focus-rw"], repoPath);

    writeFocus(wtPath, ["apps/web", "apps/api"]);
    const result = readFocus(wtPath);
    expect(result).toEqual(["apps/web", "apps/api"]);

    expect(existsSync(join(wtPath, ".copse-focus"))).toBeFalse();
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

describe("resolveFocusOpenTarget", () => {
  it("returns root when no focus file exists", async () => {
    const repoPath = await createTempRepo();
    const result = resolveFocusOpenTarget(repoPath);
    expect(result).toEqual({ kind: "root", path: repoPath });
  });

  it("returns root when focus file is empty", async () => {
    const repoPath = await createTempRepo();
    writeFocus(repoPath, []);
    const result = resolveFocusOpenTarget(repoPath);
    expect(result).toEqual({ kind: "root", path: repoPath });
  });

  it("returns single focus when exactly one path is set", async () => {
    const repoPath = await createTempRepo();
    writeFocus(repoPath, ["apps/web"]);
    const result = resolveFocusOpenTarget(repoPath);
    expect(result).toEqual({
      kind: "single",
      path: join(repoPath, "apps/web"),
      focus: "apps/web",
    });
  });

  it("returns multiple when 2+ focus paths are set", async () => {
    const repoPath = await createTempRepo();
    writeFocus(repoPath, ["apps/web", "apps/api"]);
    const result = resolveFocusOpenTarget(repoPath);
    expect(result).toEqual({
      kind: "multiple",
      focusPaths: ["apps/web", "apps/api"],
      resolvedPaths: [join(repoPath, "apps/web"), join(repoPath, "apps/api")],
    });
  });

  it("forceRoot overrides focus and returns the worktree root", async () => {
    const repoPath = await createTempRepo();
    writeFocus(repoPath, ["apps/web", "apps/api"]);
    const result = resolveFocusOpenTarget(repoPath, { forceRoot: true });
    expect(result).toEqual({ kind: "root", path: repoPath });
  });

  it("explicitFocus selects the matching focus path", async () => {
    const repoPath = await createTempRepo();
    writeFocus(repoPath, ["apps/web", "apps/api"]);
    const result = resolveFocusOpenTarget(repoPath, { explicitFocus: "apps/api" });
    expect(result).toEqual({
      kind: "single",
      path: join(repoPath, "apps/api"),
      focus: "apps/api",
    });
  });

  it("explicitFocus throws FocusNotFoundError when path is not in focus list", async () => {
    const repoPath = await createTempRepo();
    writeFocus(repoPath, ["apps/web", "apps/api"]);
    expect(() =>
      resolveFocusOpenTarget(repoPath, { explicitFocus: "apps/mobile" }),
    ).toThrow(FocusNotFoundError);
  });

  it("explicitFocus error contains available focus paths", async () => {
    const repoPath = await createTempRepo();
    writeFocus(repoPath, ["apps/web", "apps/api"]);
    try {
      resolveFocusOpenTarget(repoPath, { explicitFocus: "apps/mobile" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(FocusNotFoundError);
      const focusErr = err as FocusNotFoundError;
      expect(focusErr.requested).toBe("apps/mobile");
      expect(focusErr.available).toEqual(["apps/web", "apps/api"]);
    }
  });

  it("forceRoot wins over explicitFocus", async () => {
    const repoPath = await createTempRepo();
    writeFocus(repoPath, ["apps/web"]);
    const result = resolveFocusOpenTarget(repoPath, {
      forceRoot: true,
      explicitFocus: "apps/web",
    });
    expect(result).toEqual({ kind: "root", path: repoPath });
  });

  it("explicitFocus throws when no focus is set on the worktree", async () => {
    const repoPath = await createTempRepo();
    expect(() =>
      resolveFocusOpenTarget(repoPath, { explicitFocus: "apps/web" }),
    ).toThrow(FocusNotFoundError);
  });

  it("explicitFocus error mentions empty focus list when worktree has none", async () => {
    const repoPath = await createTempRepo();
    try {
      resolveFocusOpenTarget(repoPath, { explicitFocus: "apps/web" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(FocusNotFoundError);
      const focusErr = err as FocusNotFoundError;
      expect(focusErr.available).toEqual([]);
      expect(focusErr.message).toContain("no focus paths are set");
    }
  });
});
