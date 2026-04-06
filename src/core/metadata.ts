import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export function resolveGitDir(worktreePath: string): string {
  const gitPath = join(worktreePath, ".git");
  const stat = statSync(gitPath, { throwIfNoEntry: false });

  if (!stat || stat.isDirectory()) {
    return gitPath;
  }

  const content = readFileSync(gitPath, "utf-8").trim();
  const actualGitDir = content.replace(/^gitdir:\s*/, "").trim();
  return resolve(worktreePath, actualGitDir);
}

export function getMetadataFilePath(worktreePath: string, filename: string): string {
  return join(resolveGitDir(worktreePath), filename);
}
