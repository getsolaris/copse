import { resolve, dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import { GitError, GitVersionError, type Worktree } from "./types";

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const DEFAULT_CACHE_TTL = 3_000;
const gitCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | undefined {
  const entry = gitCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    gitCache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttl = DEFAULT_CACHE_TTL): T {
  gitCache.set(key, { data, expires: Date.now() + ttl });
  return data;
}

export function invalidateGitCache(): void {
  gitCache.clear();
}

export class GitWorktree {
  private static gitVersionChecked = false;

  private static async run(args: string[], cwd?: string): Promise<string> {
    const proc = (Bun as any).spawn(["git", ...args], {
      cwd: cwd ?? (Bun as any).cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...(Bun as any).env,
        LC_ALL: "C",
        LANG: "C",
      },
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    if (exitCode !== 0) {
      throw new GitError(
        `git ${args[0]} failed: ${stderr.trim()}`,
        exitCode,
        stderr.trim(),
        `git ${args.join(" ")}`,
      );
    }

    return stdout.trim();
  }

  static async checkVersion(): Promise<void> {
    if (this.gitVersionChecked) return;

    const output = await this.run(["--version"]);
    const match = output.match(/git version (\d+)\.(\d+)\.?((\d+)?)/);

    if (!match) {
      throw new Error("Cannot parse git version");
    }

    const [, major, minor] = match.map(Number);

    if (major < 2 || (major === 2 && minor < 17)) {
      throw new GitVersionError(`${major}.${minor}`, "2.17");
    }

    this.gitVersionChecked = true;
  }

  static async list(cwd?: string): Promise<Worktree[]> {
    await this.checkVersion();
    const baseDir = cwd ?? (Bun as any).cwd;
    const repoPath = await this.getMainRepoPath(baseDir).catch(() => baseDir);

    const cacheKey = `list:${repoPath}`;
    const cached = getCached<Worktree[]>(cacheKey);
    if (cached) return cached;

    const repoName = repoPath.split("/").pop() ?? "";
    const output = await this.run(["worktree", "list", "--porcelain"], baseDir);
    const worktrees = this.parsePorcelain(output, repoName, repoPath);

    const withDirty = await Promise.all(
      worktrees.map(async (wt) => ({
        ...wt,
        isDirty: await this.isDirty(wt.path).catch(() => false),
      })),
    );

    return setCache(cacheKey, withDirty);
  }

  static async listAll(repoPaths: string[]): Promise<Worktree[]> {
    await this.checkVersion();

    const seen = new Set<string>();
    const uniquePaths: string[] = [];
    for (const p of repoPaths) {
      const resolved = resolve(p);
      if (!seen.has(resolved)) {
        seen.add(resolved);
        uniquePaths.push(resolved);
      }
    }

    const results = await Promise.all(
      uniquePaths.map(async (repoPath) => {
        try {
          return await this.list(repoPath);
        } catch {
          return [];
        }
      }),
    );

    return results.flat();
  }

  private static parsePorcelain(output: string, repoName: string, repoPath: string): Worktree[] {
    const normalized = output.trim();
    if (!normalized) return [];

    const blocks = normalized.split(/\n\n+/).filter(Boolean);

    return blocks.map((block, index) => {
      const lines = block.split("\n");
      const pathLine = lines.find((line) => line.startsWith("worktree "));
      const headLine = lines.find((line) => line.startsWith("HEAD "));
      const branchLine = lines.find((line) => line.startsWith("branch "));
      const lockedLine = lines.find((line) => line.startsWith("locked"));

      const path = pathLine?.slice("worktree ".length) ?? "";
      const head = headLine?.slice("HEAD ".length) ?? "";

      let branch: string | null = null;
      if (branchLine) {
        const ref = branchLine.slice("branch ".length);
        branch = ref.replace(/^refs\/heads\//, "");
      }

      const lockReason =
        lockedLine && lockedLine.startsWith("locked ")
          ? lockedLine.slice("locked ".length)
          : undefined;

      return {
        path,
        branch,
        head,
        isMain: index === 0,
        isDirty: false,
        isLocked: Boolean(lockedLine),
        lockReason,
        repoName,
        repoPath,
      };
    });
  }

  static async add(
    branch: string,
    worktreePath: string,
    opts?: { createBranch?: boolean; base?: string },
    cwd?: string,
  ): Promise<void> {
    await this.checkVersion();

    const parentDir = dirname(worktreePath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    let args = ["worktree", "add", worktreePath, branch];

    if (opts?.createBranch) {
      args = [
        "worktree",
        "add",
        "-b",
        branch,
        worktreePath,
        opts.base ?? "HEAD",
      ];
    }

    await this.run(args, cwd);
  }

  static async remove(
    worktreePath: string,
    opts?: { force?: boolean },
    cwd?: string,
  ): Promise<void> {
    await this.checkVersion();

    const args = ["worktree", "remove", worktreePath];
    if (opts?.force) args.push("--force");

    await this.run(args, cwd);
  }

  static async move(source: string, dest: string, cwd?: string): Promise<void> {
    await this.checkVersion();
    await this.run(["worktree", "move", source, dest], cwd);
  }

  static async prune(cwd?: string): Promise<void> {
    await this.checkVersion();
    await this.run(["worktree", "prune"], cwd);
  }

  static async isWorktree(dir?: string): Promise<boolean> {
    const checkDir = dir ?? (Bun as any).cwd;

    try {
      const gitDir = await this.run(["rev-parse", "--git-dir"], checkDir);
      const commonDir = await this.run(["rev-parse", "--git-common-dir"], checkDir);
      return gitDir !== commonDir && !gitDir.endsWith("/.git") && !gitDir.endsWith("\\.git");
    } catch {
      return false;
    }
  }

  static async getMainRepoPath(cwd?: string): Promise<string> {
    const baseDir = cwd ?? (Bun as any).cwd;
    const commonDir = await this.run(["rev-parse", "--git-common-dir"], baseDir);
    const resolvedCommonDir = resolve(baseDir, commonDir);

    return resolvedCommonDir.endsWith("/.git")
      ? resolvedCommonDir.slice(0, -5)
      : resolvedCommonDir;
  }

  static async getBranchForWorktree(worktreePath: string): Promise<string | null> {
    try {
      const branch = await this.run(["rev-parse", "--abbrev-ref", "HEAD"], worktreePath);
      return branch === "HEAD" ? null : branch;
    } catch {
      return null;
    }
  }

  static async isDirty(cwd?: string): Promise<boolean> {
    try {
      const status = await this.run(["status", "--porcelain"], cwd ?? (Bun as any).cwd);
      return status.length > 0;
    } catch {
      return false;
    }
  }

  static async getAheadBehind(
    branch: string,
    cwd?: string,
  ): Promise<{ ahead: number; behind: number }> {
    const dir = cwd ?? (Bun as any).cwd;
    const cacheKey = `ahead-behind:${dir}:${branch}`;
    const cached = getCached<{ ahead: number; behind: number }>(cacheKey);
    if (cached) return cached;

    try {
      const upstream = await this.run(
        ["rev-parse", "--abbrev-ref", `${branch}@{upstream}`],
        dir,
      );

      const output = await this.run(
        ["rev-list", "--left-right", "--count", `${upstream}...${branch}`],
        dir,
      );

      const [behind, ahead] = output.split(/\s+/).map(Number);
      return setCache(cacheKey, { ahead: ahead ?? 0, behind: behind ?? 0 });
    } catch {
      return setCache(cacheKey, { ahead: 0, behind: 0 });
    }
  }

  static async getLastCommit(
    cwd?: string,
  ): Promise<{ hash: string; message: string; relativeDate: string } | null> {
    const dir = cwd ?? (Bun as any).cwd;
    const cacheKey = `last-commit:${dir}`;
    const cached = getCached<{ hash: string; message: string; relativeDate: string } | null>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const output = await this.run(
        ["log", "-1", "--format=%h\x1f%s\x1f%cr"],
        dir,
      );

      if (!output) return setCache(cacheKey, null);

      const [hash, message, relativeDate] = output.split("\x1f");
      return setCache(cacheKey, {
        hash: hash ?? "",
        message: message ?? "",
        relativeDate: relativeDate ?? "",
      });
    } catch {
      return setCache(cacheKey, null);
    }
  }

  static async getDirtyCount(cwd?: string): Promise<number> {
    const dir = cwd ?? (Bun as any).cwd;
    const cacheKey = `dirty-count:${dir}`;
    const cached = getCached<number>(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const status = await this.run(["status", "--porcelain"], dir);
      if (!status) return setCache(cacheKey, 0);
      return setCache(cacheKey, status.split("\n").filter(Boolean).length);
    } catch {
      return setCache(cacheKey, 0);
    }
  }

  static async unlock(worktreePath: string, cwd?: string): Promise<void> {
    await this.checkVersion();
    await this.run(["worktree", "unlock", worktreePath], cwd);
  }

  static async isMergedInto(branch: string, target: string, cwd?: string): Promise<boolean> {
    try {
      const merged = await this.run(["branch", "--merged", target], cwd ?? (Bun as any).cwd);
      return merged
        .split("\n")
        .some((item) => item.trim().replace(/^[*+] /, "") === branch);
    } catch {
      return false;
    }
  }

  static async getDefaultRemote(cwd?: string): Promise<string> {
    try {
      const remote = await this.run(["config", "checkout.defaultRemote"], cwd ?? (Bun as any).cwd);
      return remote || "origin";
    } catch {
      return "origin";
    }
  }

  static async remoteBranchExists(branch: string, remote?: string, cwd?: string): Promise<boolean> {
    const effectiveRemote = remote ?? (await this.getDefaultRemote(cwd));
    try {
      await this.run(
        ["rev-parse", "--verify", `refs/remotes/${effectiveRemote}/${branch}`],
        cwd ?? (Bun as any).cwd,
      );
      return true;
    } catch {
      return false;
    }
  }

  static async setUpstream(branch: string, remote?: string, cwd?: string): Promise<void> {
    const effectiveRemote = remote ?? (await this.getDefaultRemote(cwd));
    const dir = cwd ?? (Bun as any).cwd;

    try {
      const existing = await this.run(["config", `branch.${branch}.remote`], dir);
      if (existing) return;
    } catch {
      // No existing upstream configured — proceed to set one
    }

    await this.run(["branch", `--set-upstream-to=${effectiveRemote}/${branch}`, branch], dir);
  }
}
