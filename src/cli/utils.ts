import * as readline from "node:readline";
import { GitWorktree } from "../core/git.ts";
import { GitError, type Worktree } from "../core/types.ts";

export async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

export async function resolveMainRepo(): Promise<string> {
  return GitWorktree.getMainRepoPath().catch(() => process.cwd());
}

export function findWorktreeOrExit(worktrees: Worktree[], branchOrPath: string): Worktree {
  const target = worktrees.find(
    (wt) => wt.branch === branchOrPath || wt.path === branchOrPath || wt.path.endsWith("/" + branchOrPath),
  );
  if (!target) {
    console.error(`Error: no worktree found for '${branchOrPath}'`);
    process.exit(1);
  }
  return target;
}

export function handleCliError(err: unknown): never {
  if (err instanceof GitError) {
    console.error(`Git error: ${err.message}`);
  } else {
    console.error(`Error: ${(err as Error).message}`);
  }
  process.exit(1);
}
