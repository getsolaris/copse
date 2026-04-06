import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { GitWorktree } from "./git.ts";
import { writeFocus } from "./focus.ts";
import { ImportError, type Worktree } from "./types.ts";
import { resolveGitDir } from "./metadata.ts";

interface ImportValidationResult {
  valid: boolean;
  reason?: string;
  branch?: string;
}

async function runGit(args: string[], cwd: string): Promise<string> {
  return GitWorktree.exec(args, cwd);
}

function getBranchFromGitDir(gitDir: string): string | null {
  const headPath = join(gitDir, "HEAD");

  if (!existsSync(headPath)) {
    return null;
  }

  const headContent = readFileSync(headPath, "utf-8").trim();
  const match = headContent.match(/^ref:\s+refs\/heads\/(.+)$/);
  return match ? match[1] : null;
}

export function getWorktreeGitDir(worktreePath: string): string {
  const resolvedPath = resolve(worktreePath);
  const gitPath = join(resolvedPath, ".git");
  const gitStat = statSync(gitPath, { throwIfNoEntry: false });

  if (!gitStat) {
    throw new Error(`Missing .git at ${gitPath}`);
  }

  return resolveGitDir(resolvedPath);
}

export function validateImportTarget(path: string): ImportValidationResult {
  const resolvedPath = resolve(path);
  const targetStat = statSync(resolvedPath, { throwIfNoEntry: false });

  if (!targetStat) {
    return { valid: false, reason: `Path does not exist: ${resolvedPath}` };
  }

  if (!targetStat.isDirectory()) {
    return { valid: false, reason: `Path is not a directory: ${resolvedPath}` };
  }

  const gitPath = join(resolvedPath, ".git");
  const gitStat = statSync(gitPath, { throwIfNoEntry: false });

  if (!gitStat) {
    return { valid: false, reason: `Target is missing .git: ${resolvedPath}` };
  }

  if (gitStat.isDirectory()) {
    return {
      valid: false,
      reason: `Target is not a linked git worktree (.git is a directory): ${resolvedPath}`,
    };
  }

  if (!gitStat.isFile()) {
    return { valid: false, reason: `Target has invalid .git entry: ${resolvedPath}` };
  }

  let gitDir = "";
  try {
    gitDir = getWorktreeGitDir(resolvedPath);
  } catch {
    return { valid: false, reason: `Cannot resolve gitdir from .git file: ${resolvedPath}` };
  }

  const gitDirStat = statSync(gitDir, { throwIfNoEntry: false });
  if (!gitDirStat?.isDirectory()) {
    return { valid: false, reason: `Resolved gitdir does not exist: ${gitDir}` };
  }

  const branch = getBranchFromGitDir(gitDir);
  if (!branch) {
    return { valid: false, reason: `Cannot resolve branch name from HEAD: ${resolvedPath}` };
  }

  return { valid: true, branch };
}

export async function importWorktree(
  path: string,
  opts?: { focus?: string[]; pin?: boolean },
): Promise<Worktree> {
  const resolvedPath = resolve(path);
  const validation = validateImportTarget(resolvedPath);

  if (!validation.valid) {
    throw new ImportError(
      `Cannot import worktree: ${validation.reason ?? "invalid target"}`,
      resolvedPath,
      validation.reason ?? "invalid target",
    );
  }

  const [head, status, commonDirRaw] = await Promise.all([
    runGit(["rev-parse", "HEAD"], resolvedPath),
    runGit(["status", "--porcelain"], resolvedPath),
    runGit(["rev-parse", "--git-common-dir"], resolvedPath),
  ]);

  const commonDir = resolve(resolvedPath, commonDirRaw);
  const repoPath = commonDir.endsWith("/.git") || commonDir.endsWith("\\.git")
    ? commonDir.slice(0, -5)
    : commonDir;
  const repoName = basename(repoPath);
  const isMain = resolve(resolvedPath) === resolve(repoPath);

  const gitDir = getWorktreeGitDir(resolvedPath);
  const lockFilePath = join(gitDir, "locked");
  const isLocked = existsSync(lockFilePath);
  const lockReason = isLocked ? readFileSync(lockFilePath, "utf-8").trim() || undefined : undefined;

  if (opts?.focus && opts.focus.length > 0) {
    writeFocus(resolvedPath, opts.focus);
  }

  if (opts?.pin) {
    try {
      const pinModule: { writePin: (worktreePath: string) => void } = await import("./pin.ts");
      pinModule.writePin(resolvedPath);
    } catch (err) {
      console.warn(`Warning: failed to pin worktree: ${(err as Error).message}`);
    }
  }

  return {
    path: resolvedPath,
    branch: validation.branch ?? null,
    head,
    isMain,
    isDirty: status.length > 0,
    isLocked,
    lockReason,
    repoName,
    repoPath,
  };
}
