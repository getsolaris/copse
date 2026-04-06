import { existsSync, readdirSync, rmSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { getConfigPath, loadConfig } from "./config";
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

function expandHomePath(path: string): string {
  const home = Bun.env.HOME ?? "~";
  return path.replace(/^~(?=\/|$)/, home);
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface WorktreeBaseMatcher {
  path: string;
  matches(name: string): boolean;
}

function getConfiguredWorktreeBases(worktrees: Worktree[]): WorktreeBaseMatcher[] {
  if (!existsSync(getConfigPath())) {
    return [];
  }

  const mainWorktree = worktrees.find((wt) => wt.isMain);
  if (!mainWorktree) {
    return [];
  }

  const config = loadConfig();
  const mainRepoPath = resolve(mainWorktree.path);
  const repoName = basename(mainRepoPath);
  const repoOverride = config.repos?.find((repo) => resolve(repo.path) === mainRepoPath);
  const templates = [repoOverride?.worktreeDir ?? config.defaults?.worktreeDir]
    .filter((template): template is string => typeof template === "string");

  return templates
    .map((template) => expandHomePath(template))
    .filter((template) => !dirname(template).includes("{") && basename(template).includes("{"))
    .map((template) => {
      const baseName = basename(template);
      const pattern = `^${escapeRegex(baseName)
        .replace(/\\\{repo\\\}/g, escapeRegex(repoName))
        .replace(/\\\{branch\\\}/g, ".+")}$`;

      const regex = new RegExp(pattern);
      return {
        path: resolve(dirname(template)),
        matches: (name: string) => regex.test(name),
      };
    });
}

function getTrackedWorktreeBaseDirs(worktrees: Worktree[]): string[] {
  const bases = new Set<string>();

  for (const wt of worktrees) {
    if (!wt.isMain) {
      bases.add(resolve(dirname(wt.path)));
    }
  }

  return [...bases];
}

function collectOrphansFromDir(
  basePath: string,
  trackedPaths: Set<string>,
  orphaned: Set<string>,
  matcher?: (name: string) => boolean,
): void {
  if (!existsSync(basePath)) return;

  const entries = readdirSync(basePath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (matcher && !matcher(entry.name)) continue;
    const dirPath = resolve(join(basePath, entry.name));
    if (!trackedPaths.has(dirPath)) {
      orphaned.add(dirPath);
    }
  }
}

function findOrphanedDirectories(worktrees: Worktree[]): string[] {
  const trackedPaths = new Set(worktrees.map((wt) => resolve(wt.path)));
  const orphaned = new Set<string>();
  const scannedBases = new Set<string>();

  for (const worktreeBase of getConfiguredWorktreeBases(worktrees)) {
    scannedBases.add(worktreeBase.path);
    collectOrphansFromDir(worktreeBase.path, trackedPaths, orphaned, worktreeBase.matches);
  }

  for (const worktreeBase of getTrackedWorktreeBaseDirs(worktrees)) {
    if (scannedBases.has(worktreeBase)) continue;
    collectOrphansFromDir(worktreeBase, trackedPaths, orphaned);
  }

  return [...orphaned];
}

function hasAnyWorktreeBase(worktrees: Worktree[]): boolean {
  return getConfiguredWorktreeBases(worktrees).some((worktreeBase) => existsSync(worktreeBase.path))
    || getTrackedWorktreeBaseDirs(worktrees).some((worktreeBase) => existsSync(worktreeBase));
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
    const orphaned = findOrphanedDirectories(worktrees);

    if (orphaned.length === 0) {
      return {
        name,
        status: "pass",
        message: hasAnyWorktreeBase(worktrees) ? "none" : "no worktree directory",
      };
    }

    return {
      name,
      status: "warn",
      message: "orphaned worktree directories found",
      detail: orphaned,
    };
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
    const orphaned = findOrphanedDirectories(await GitWorktree.list(cwd).catch(() => []));

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
