import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { basename, join, resolve } from "path";
import { cleanupTempDirs, createTempDir, createTempRepo, runGit } from "./test-helpers";
import { isTmuxAvailable } from "./session";

const cliPath = resolve(import.meta.dir, "../index.ts");
const tmuxSessionsToCleanup = new Set<string>();

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runCommand(
  command: string[],
  cwd?: string,
  env?: Record<string, string | undefined>,
): Promise<CommandResult> {
  const proc = (Bun as any).spawn(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...(Bun as any).env,
      ...env,
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

  return {
    stdout: stdout.trimEnd(),
    stderr: stderr.trimEnd(),
    exitCode,
  };
}

async function runCli(
  args: string[],
  cwd: string,
  env?: Record<string, string | undefined>,
): Promise<CommandResult> {
  return runCommand(["bun", "run", cliPath, ...args], cwd, env);
}

async function runTmux(args: string[]): Promise<CommandResult> {
  return runCommand(["tmux", ...args]);
}

afterEach(async () => {
  for (const sessionName of tmuxSessionsToCleanup) {
    await runTmux(["kill-session", "-t", sessionName]).catch(() => undefined);
  }
  tmuxSessionsToCleanup.clear();
  cleanupTempDirs();
});

describe("CLI regressions", () => {
  it("doctor --fix exits cleanly after removing orphaned directories from configured worktreeDir", async () => {
    const repoPath = await createTempRepo("copse-cli-doctor-");
    const root = createTempDir("copse-cli-doctor-env-");
    const xdgConfigHome = join(root, "xdg");
    const configDir = join(xdgConfigHome, "copse");
    const customWorktreeBase = join(root, "custom-worktrees");
    const orphanPath = join(customWorktreeBase, `${basename(repoPath)}-orphan`);

    mkdirSync(configDir, { recursive: true });
    mkdirSync(orphanPath, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify(
        {
          version: 1,
          defaults: {
            worktreeDir: `${customWorktreeBase}/{repo}-{branch}`,
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const result = await runCli(["doctor", "--fix"], repoPath, {
      XDG_CONFIG_HOME: xdgConfigHome,
      HOME: root,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("All checks now pass.");
    expect(existsSync(orphanPath)).toBeFalse();
  });

  it("clean --dry-run does not prune prunable worktree metadata", async () => {
    const repoPath = await createTempRepo("copse-cli-clean-");
    const worktreePath = createTempDir("copse-cli-clean-wt-");

    await runGit(["worktree", "add", worktreePath, "-b", "feature/test"], repoPath);
    rmSync(worktreePath, { recursive: true, force: true });

    const before = await runCommand(["git", "worktree", "list", "--porcelain"], repoPath);
    const result = await runCli(["clean", "--dry-run"], repoPath);
    const after = await runCommand(["git", "worktree", "list", "--porcelain"], repoPath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Would remove:");
    expect(before.stdout).toContain("prunable");
    expect(after.stdout).toContain("prunable");
  });

  it("config rejects activating a missing profile", async () => {
    const root = createTempDir("copse-cli-config-");
    const xdgConfigHome = join(root, "xdg");
    const configDir = join(xdgConfigHome, "copse");

    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify(
        {
          version: 1,
          defaults: {
            autoUpstream: true,
          },
          profiles: {
            work: {
              defaults: {
                autoUpstream: false,
              },
            },
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const result = await runCli(["config", "--profile", "missing", "--activate"], resolve(import.meta.dir, "../.."), {
      XDG_CONFIG_HOME: xdgConfigHome,
      HOME: root,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("profile 'missing' does not exist");
  });

  it("copse (TUI) launches without crashing when started outside a git repo with no configured repos", async () => {
    const nonGitDir = createTempDir("copse-cli-non-git-");
    const root = createTempDir("copse-cli-non-git-env-");
    const xdgConfigHome = join(root, "xdg");
    mkdirSync(xdgConfigHome, { recursive: true });

    const proc = (Bun as any).spawn(["bun", "run", cliPath], {
      cwd: nonGitDir,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...(Bun as any).env,
        XDG_CONFIG_HOME: xdgConfigHome,
        HOME: root,
      },
    });

    await new Promise((r) => setTimeout(r, 1500));

    const exitedEarly = proc.exitCode !== null && proc.exitCode !== undefined;
    proc.kill("SIGKILL");
    await proc.exited;

    const stderr = await new Response(proc.stderr).text();

    expect(exitedEarly).toBe(false);
    expect(stderr).not.toContain("[KeyHandler]");
    expect(stderr).not.toContain("Error in global keypress handler");
    expect(stderr).not.toContain("GitError");
    expect(stderr).not.toContain("TypeError");
    expect(stderr).not.toContain("UnhandledPromiseRejection");
  });

  it("session --kill-all kills orphan sessions for the configured prefix", async () => {
    if (!(await isTmuxAvailable())) {
      return;
    }

    const repoPath = await createTempRepo("copse-cli-session-");
    const root = createTempDir("copse-cli-session-env-");
    const xdgConfigHome = join(root, "xdg");
    const configDir = join(xdgConfigHome, "copse");
    const prefix = `copqa${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const sessionName = `${prefix}_orphan`;

    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify(
        {
          version: 1,
          sessions: {
            prefix,
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const createResult = await runTmux(["new-session", "-d", "-s", sessionName]);
    expect(createResult.exitCode).toBe(0);
    tmuxSessionsToCleanup.add(sessionName);

    const before = await runTmux(["list-sessions", "-F", "#{session_name}"]);
    const result = await runCli(["session", "--kill-all"], repoPath, {
      XDG_CONFIG_HOME: xdgConfigHome,
      HOME: root,
    });
    const after = await runTmux(["list-sessions", "-F", "#{session_name}"]);

    expect(before.stdout.split("\n")).toContain(sessionName);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Killed ${sessionName}`);
    expect(after.stdout.split("\n")).not.toContain(sessionName);

    tmuxSessionsToCleanup.delete(sessionName);
  });
});
