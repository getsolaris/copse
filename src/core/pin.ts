import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { PinMetadata, Worktree } from "./types.ts";
import { getMetadataFilePath } from "./metadata.ts";

function getPinFilePath(worktreePath: string): string {
  return getMetadataFilePath(worktreePath, "omw-pin");
}

function getCurrentBranch(worktreePath: string): string {
  const pinFilePath = getPinFilePath(worktreePath);
  const gitDir = dirname(pinFilePath);
  const headFile = join(gitDir, "HEAD");
  const headContent = readFileSync(headFile, "utf-8").trim();
  const match = headContent.match(/^ref:\s+refs\/heads\/(.+)$/);
  return match ? match[1] : headContent;
}

export function writePin(worktreePath: string, reason?: string): void {
  const pinFilePath = getPinFilePath(worktreePath);
  const metadata: PinMetadata = {
    branch: getCurrentBranch(worktreePath),
    pinnedAt: new Date().toISOString(),
    ...(reason ? { reason } : {}),
  };

  mkdirSync(dirname(pinFilePath), { recursive: true });
  writeFileSync(pinFilePath, JSON.stringify(metadata), { encoding: "utf-8", mode: 0o600 });
}

export function readPin(worktreePath: string): PinMetadata | null {
  const pinFilePath = getPinFilePath(worktreePath);
  if (!existsSync(pinFilePath)) {
    return null;
  }

  return JSON.parse(readFileSync(pinFilePath, "utf-8")) as PinMetadata;
}

export function removePin(worktreePath: string): void {
  const pinFilePath = getPinFilePath(worktreePath);
  if (!existsSync(pinFilePath)) {
    return;
  }

  unlinkSync(pinFilePath);
}

export function isPinned(worktreePath: string): boolean {
  return existsSync(getPinFilePath(worktreePath));
}

export function listPinnedWorktrees(worktrees: Worktree[]): Worktree[] {
  return worktrees.filter((worktree) => isPinned(worktree.path));
}
