import { existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { loadConfig } from "./config";
import { GitWorktree } from "./git";
import { GitVersionError } from "./types";

export type DoctorSeverity = "pass" | "warn" | "fail";

export interface DoctorCheckResult {
  name: string;
  status: DoctorSeverity;
  message: string;
  detail?: string[];
}

export interface DoctorReport {
  checks: DoctorCheckResult[];
  healthy: boolean;
}

async function getGitVersionString(): Promise<string | null> {
  const proc = (Bun as any).spawn(["git", "--version"], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...(Bun as any).env,
      LC_ALL: "C",
      LANG: "C",
    },
  });

  const [stdout, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) return null;

  const match = stdout.trim().match(/git version (\d+\.\d+(?:\.\d+)?)/);
  return match?.[1] ?? null;
}

export async function checkGitVersion(): Promise<DoctorCheckResult> {
  const name = "Git version";

  try {
    await GitWorktree.checkVersion();
    const version = await getGitVersionString();

    return {
      name,
      status: "pass",
      message: `${version ?? "unknown"} (>= 2.17 required)`,
    };
  } catch (err) {
    if (err instanceof GitVersionError) {
      return { name, status: "fail", message: err.message };
    }

    return { name, status: "fail", message: `Check failed: ${(err as Error).message}` };
  }
}

export async function checkConfig(): Promise<DoctorCheckResult> {
  const name = "Configuration";

  try {
    const config = loadConfig();
    const missingPaths = (config.repos ?? [])
      .map((repo) => repo.path)
      .filter((repoPath) => !existsSync(repoPath));

    if (missingPaths.length > 0) {
      return {
        name,
        status: "warn",
        message: "missing repository paths",
        detail: missingPaths,
      };
    }

    return { name, status: "pass", message: "valid" };
  } catch (err) {
    return { name, status: "fail", message: `Check failed: ${(err as Error).message}` };
  }
}

export async function checkStaleWorktrees(cwd?: string): Promise<DoctorCheckResult> {
  const name = "Stale worktrees";

  try {
    const worktrees = await GitWorktree.list(cwd);
    const missingPaths = worktrees.map((wt) => wt.path).filter((worktreePath) => !existsSync(worktreePath));

    if (missingPaths.length > 0) {
      return {
        name,
        status: "warn",
        message: "missing worktree paths",
        detail: missingPaths,
      };
    }

    return { name, status: "pass", message: "none" };
  } catch {
    return { name, status: "pass", message: "not in a git repository" };
  }
}

export async function checkOrphanedDirectories(cwd?: string): Promise<DoctorCheckResult> {
  const name = "Orphaned directories";

  try {
    const home = Bun.env.HOME ?? "~";
    const worktreeBase = join(home, ".omw", "worktrees");

    if (!existsSync(worktreeBase)) {
      return { name, status: "pass", message: "no worktree directory" };
    }

    const localDirs = readdirSync(worktreeBase, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(join(worktreeBase, entry.name)));

    const trackedPaths = new Set((await GitWorktree.list(cwd)).map((wt) => resolve(wt.path)));
    const orphaned = localDirs.filter((dirPath) => !trackedPaths.has(dirPath));

    if (orphaned.length > 0) {
      return {
        name,
        status: "warn",
        message: "orphaned worktree directories found",
        detail: orphaned,
      };
    }

    return { name, status: "pass", message: "none" };
  } catch (err) {
    return { name, status: "fail", message: `Check failed: ${(err as Error).message}` };
  }
}

export async function checkLockStatus(cwd?: string): Promise<DoctorCheckResult> {
  const name = "Worktree locks";

  try {
    const worktrees = await GitWorktree.list(cwd);
    const locked = worktrees.filter((wt) => wt.isLocked);

    if (locked.length === 0) {
      return { name, status: "pass", message: "all clear" };
    }

    const detail = locked.map((wt) => {
      const branch = wt.branch ?? "detached";
      if (!wt.lockReason) {
        return `${branch} - ${wt.path} (potential stale lock: no reason)`;
      }

      return `${branch} - ${wt.path} (reason: ${wt.lockReason})`;
    });

    return {
      name,
      status: "warn",
      message: "locked worktrees present",
      detail,
    };
  } catch (err) {
    return { name, status: "fail", message: `Check failed: ${(err as Error).message}` };
  }
}

export async function checkDirtyWorktrees(cwd?: string): Promise<DoctorCheckResult> {
  const name = "Dirty worktrees";

  try {
    const worktrees = await GitWorktree.list(cwd);
    const dirtyNonMain = worktrees.filter((wt) => wt.isDirty && !wt.isMain);

    if (dirtyNonMain.length === 0) {
      return { name, status: "pass", message: "none" };
    }

    return {
      name,
      status: "warn",
      message: "dirty non-main worktrees found",
      detail: dirtyNonMain.map((wt) => `${wt.branch ?? "detached"} - ${wt.path}`),
    };
  } catch (err) {
    return { name, status: "fail", message: `Check failed: ${(err as Error).message}` };
  }
}

export async function runAllChecks(cwd?: string): Promise<DoctorReport> {
  const checksToRun: Array<() => Promise<DoctorCheckResult>> = [
    () => checkGitVersion(),
    () => checkConfig(),
    () => checkStaleWorktrees(cwd),
    () => checkOrphanedDirectories(cwd),
    () => checkLockStatus(cwd),
    () => checkDirtyWorktrees(cwd),
  ];

  const checks = await Promise.all(
    checksToRun.map(async (runCheck, index) => {
      try {
        return await runCheck();
      } catch (err) {
        const fallbackNames = [
          "Git version",
          "Configuration",
          "Stale worktrees",
          "Orphaned directories",
          "Worktree locks",
          "Dirty worktrees",
        ];

        return {
          name: fallbackNames[index] ?? "Unknown check",
          status: "fail" as const,
          message: `Check failed: ${(err as Error).message}`,
        };
      }
    }),
  );

  return {
    checks,
    healthy: checks.every((check) => check.status === "pass"),
  };
}
