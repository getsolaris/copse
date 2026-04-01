import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

export function getFocusFilePath(worktreePath: string): string {
  const gitPath = join(worktreePath, '.git');
  const stat = statSync(gitPath, { throwIfNoEntry: false });

  if (!stat) {
    return join(gitPath, 'omw-focus');
  }

  if (stat.isDirectory()) {
    return join(gitPath, 'omw-focus');
  }

  const content = readFileSync(gitPath, 'utf-8').trim();
  const actualGitDir = content.replace(/^gitdir:\s*/, '').trim();
  const resolvedGitDir = resolve(worktreePath, actualGitDir);

  return join(resolvedGitDir, 'omw-focus');
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
