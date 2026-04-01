import { resolve, dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import { GitError, GitVersionError, type Worktree } from "./types";

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
    const repoName = repoPath.split("/").pop() ?? "";
    const output = await this.run(["worktree", "list", "--porcelain"], baseDir);
    const worktrees = this.parsePorcelain(output, repoName, repoPath);

    const withDirty = await Promise.all(
      worktrees.map(async (wt) => ({
        ...wt,
        isDirty: await this.isDirty(wt.path).catch(() => false),
      })),
    );

    return withDirty;
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
}
