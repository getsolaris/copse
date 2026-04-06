import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { getMetadataFilePath } from "./metadata.ts";

export function getFocusFilePath(worktreePath: string): string {
  return getMetadataFilePath(worktreePath, "omw-focus");
}

export function writeFocus(worktreePath: string, focusPaths: string[]): void {
  const focusFilePath = getFocusFilePath(worktreePath);
  mkdirSync(dirname(focusFilePath), { recursive: true });
  writeFileSync(focusFilePath, focusPaths.join('\n'), { encoding: 'utf-8', mode: 0o600 });
}

export function readFocus(worktreePath: string): string[] | null {
  const focusFilePath = getFocusFilePath(worktreePath);

  if (!existsSync(focusFilePath)) {
    return null;
  }

  const content = readFileSync(focusFilePath, 'utf-8');
  return content.split(/\r?\n/).filter(Boolean);
}

export function hasFocus(worktreePath: string): boolean {
  return existsSync(getFocusFilePath(worktreePath));
}
