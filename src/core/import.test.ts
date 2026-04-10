import { afterEach, describe, expect, it } from "bun:test";
import { realpathSync } from "node:fs";
import { readPin } from "./pin.ts";
import { readFocus } from "./focus.ts";
import { cleanupTempDirs, createTempDir, createTempRepo, runGit } from "./test-helpers.ts";
import { getWorktreeGitDir, importWorktree, validateImportTarget } from "./import.ts";
import { ImportError } from "./types.ts";

async function runGitRead(args: string[], cwd?: string): Promise<string> {
  const proc = (Bun as any).spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...(Bun as any).env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`);
  }

  return stdout.trim();
}

afterEach(() => {
  cleanupTempDirs();
});

describe("validateImportTarget", () => {
  it("returns valid for linked git worktree and resolves branch", async () => {
    const repoPath = await createTempRepo();
    const worktreePath = createTempDir("copse-import-valid-");
    await runGit(["worktree", "add", worktreePath, "-b", "feature/import-valid"], repoPath);

    const result = validateImportTarget(worktreePath);

    expect(result.valid).toBeTrue();
    expect(result.branch).toBe("feature/import-valid");
  });

  it("rejects non-existent path", () => {
    const result = validateImportTarget("/tmp/does-not-exist-copse-import");

    expect(result.valid).toBeFalse();
    expect(result.reason).toContain("does not exist");
  });

  it("rejects standalone repository directory", async () => {
    const repoPath = await createTempRepo();

    const result = validateImportTarget(repoPath);

    expect(result.valid).toBeFalse();
    expect(result.reason).toContain("not a linked git worktree");
  });

  it("rejects non-git directory", () => {
    const dir = createTempDir("copse-import-not-git-");

    const result = validateImportTarget(dir);

    expect(result.valid).toBeFalse();
    expect(result.reason).toContain("missing .git");
  });
});

describe("getWorktreeGitDir", () => {
  it("resolves linked worktree .git file to metadata directory", async () => {
    const repoPath = await createTempRepo();
    const worktreePath = createTempDir("copse-import-gitdir-");
    await runGit(["worktree", "add", worktreePath, "-b", "feature/import-gitdir"], repoPath);

    const gitDir = getWorktreeGitDir(worktreePath);

    expect(gitDir).not.toBe(`${worktreePath}/.git`);
    expect(gitDir).toContain(repoPath);
  });
});

describe("importWorktree", () => {
  it("imports a valid linked worktree", async () => {
    const repoPath = await createTempRepo();
    const worktreePath = createTempDir("copse-import-worktree-");
    await runGit(["worktree", "add", worktreePath, "-b", "feature/import-me"], repoPath);

    const imported = await importWorktree(worktreePath);

    expect(imported.path).toBe(worktreePath);
    expect(imported.branch).toBe("feature/import-me");
    expect(imported.head.length).toBeGreaterThan(0);
    expect(imported.isMain).toBeFalse();
    expect(realpathSync(imported.repoPath)).toBe(realpathSync(repoPath));
    expect(imported.repoName).toBe((repoPath.split("/").pop() ?? ""));
  });

  it("throws ImportError when target is invalid", async () => {
    expect(importWorktree("/tmp/does-not-exist-copse-import-2")).rejects.toBeInstanceOf(ImportError);
  });

  it("writes focus metadata when focus is provided", async () => {
    const repoPath = await createTempRepo();
    const worktreePath = createTempDir("copse-import-focus-");
    await runGit(["worktree", "add", worktreePath, "-b", "feature/import-focus"], repoPath);

    const imported = await importWorktree(worktreePath, { focus: ["apps/web", "apps/api"] });

    expect(imported.branch).toBe("feature/import-focus");
    expect(readFocus(worktreePath)).toEqual(["apps/web", "apps/api"]);
  });

  it("writes pin metadata when pin option is enabled", async () => {
    const repoPath = await createTempRepo();
    const worktreePath = createTempDir("copse-import-pin-");
    await runGit(["worktree", "add", worktreePath, "-b", "feature/import-pin"], repoPath);

    await importWorktree(worktreePath, { pin: true });

    const pin = readPin(worktreePath);
    const currentBranch = await runGitRead(["rev-parse", "--abbrev-ref", "HEAD"], worktreePath);

    expect(pin).not.toBeNull();
    expect(pin?.branch).toBe(currentBranch);
  });
});
