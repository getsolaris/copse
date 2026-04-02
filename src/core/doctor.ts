import { existsSync, readdirSync, rmSync } from "fs";
import { join, resolve } from "path";
import { loadConfig } from "./config";
import { GitWorktree } from "./git";
import { GitVersionError, type Worktree } from "./types";

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

export interface FixResult {
  action: string;
  success: boolean;
  detail?: string;
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

export function checkStaleWorktrees(worktrees: Worktree[]): DoctorCheckResult {
  const name = "Stale worktrees";
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
}

export function checkOrphanedDirectories(worktrees: Worktree[]): DoctorCheckResult {
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

    const trackedPaths = new Set(worktrees.map((wt) => resolve(wt.path)));
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

export function checkLockStatus(worktrees: Worktree[]): DoctorCheckResult {
  const name = "Worktree locks";
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
}

export function checkDirtyWorktrees(worktrees: Worktree[]): DoctorCheckResult {
  const name = "Dirty worktrees";
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
}

export async function runAllChecks(cwd?: string): Promise<DoctorReport> {
  const worktrees = await GitWorktree.list(cwd).catch((): Worktree[] => []);

  const checks: DoctorCheckResult[] = [
    await checkGitVersion(),
    await checkConfig(),
    checkStaleWorktrees(worktrees),
    checkOrphanedDirectories(worktrees),
    checkLockStatus(worktrees),
    checkDirtyWorktrees(worktrees),
  ];

  return {
    checks,
    healthy: checks.every((check) => check.status === "pass"),
  };
}

export async function fixStaleWorktrees(cwd?: string): Promise<FixResult> {
  try {
    await GitWorktree.prune(cwd);
    return { action: "Prune stale worktrees", success: true };
  } catch (err) {
    return {
      action: "Prune stale worktrees",
      success: false,
      detail: (err as Error).message,
    };
  }
}

export async function fixOrphanedDirectories(cwd?: string): Promise<FixResult[]> {
  const results: FixResult[] = [];

  try {
    const home = Bun.env.HOME ?? "~";
    const worktreeBase = join(home, ".omw", "worktrees");

    if (!existsSync(worktreeBase)) {
      return results;
    }

    const localDirs = readdirSync(worktreeBase, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(join(worktreeBase, entry.name)));

    const trackedPaths = new Set(
      (await GitWorktree.list(cwd).catch(() => [])).map((wt) => resolve(wt.path)),
    );

    const orphaned = localDirs.filter((dirPath) => !trackedPaths.has(dirPath));

    for (const dirPath of orphaned) {
      try {
        rmSync(dirPath, { recursive: true, force: true });
        results.push({
          action: `Remove orphaned directory`,
          success: true,
          detail: dirPath,
        });
      } catch (err) {
        results.push({
          action: `Remove orphaned directory`,
          success: false,
          detail: `${dirPath}: ${(err as Error).message}`,
        });
      }
    }
  } catch (err) {
    results.push({
      action: "Remove orphaned directories",
      success: false,
      detail: (err as Error).message,
    });
  }

  return results;
}

export async function fixStaleLocks(cwd?: string): Promise<FixResult[]> {
  const results: FixResult[] = [];

  try {
    const worktrees = await GitWorktree.list(cwd);
    const staleLocked = worktrees.filter((wt) => wt.isLocked && !wt.lockReason);

    for (const wt of staleLocked) {
      try {
        await GitWorktree.unlock(wt.path, cwd);
        results.push({
          action: `Unlock stale lock`,
          success: true,
          detail: `${wt.branch ?? "detached"} - ${wt.path}`,
        });
      } catch (err) {
        results.push({
          action: `Unlock stale lock`,
          success: false,
          detail: `${wt.path}: ${(err as Error).message}`,
        });
      }
    }
  } catch (err) {
    results.push({
      action: "Fix stale locks",
      success: false,
      detail: (err as Error).message,
    });
  }

  return results;
}

export async function runFixes(cwd?: string): Promise<FixResult[]> {
  const results: FixResult[] = [];

  results.push(await fixStaleWorktrees(cwd));
  results.push(...(await fixOrphanedDirectories(cwd)));
  results.push(...(await fixStaleLocks(cwd)));

  return results;
}
