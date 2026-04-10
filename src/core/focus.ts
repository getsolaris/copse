import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { getMetadataFilePath } from "./metadata.ts";

export function getFocusFilePath(worktreePath: string): string {
  return getMetadataFilePath(worktreePath, "copse-focus");
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

export type FocusOpenTarget =
  | { kind: "root"; path: string }
  | { kind: "single"; path: string; focus: string }
  | { kind: "multiple"; focusPaths: string[]; resolvedPaths: string[] };

export class FocusNotFoundError extends Error {
  constructor(
    public readonly requested: string,
    public readonly available: string[],
  ) {
    const detail =
      available.length === 0
        ? "no focus paths are set on this worktree."
        : `available: ${available.join(", ")}.`;
    super(`Focus path '${requested}' is not set; ${detail}`);
    this.name = "FocusNotFoundError";
  }
}

export function resolveFocusOpenTarget(
  worktreePath: string,
  options?: { explicitFocus?: string; forceRoot?: boolean },
): FocusOpenTarget {
  if (options?.forceRoot) {
    return { kind: "root", path: worktreePath };
  }

  const focusPaths = readFocus(worktreePath) ?? [];

  if (options?.explicitFocus) {
    if (!focusPaths.includes(options.explicitFocus)) {
      throw new FocusNotFoundError(options.explicitFocus, focusPaths);
    }
    return {
      kind: "single",
      path: join(worktreePath, options.explicitFocus),
      focus: options.explicitFocus,
    };
  }

  if (focusPaths.length === 0) {
    return { kind: "root", path: worktreePath };
  }

  if (focusPaths.length === 1) {
    return {
      kind: "single",
      path: join(worktreePath, focusPaths[0]!),
      focus: focusPaths[0]!,
    };
  }

  return {
    kind: "multiple",
    focusPaths,
    resolvedPaths: focusPaths.map((p) => join(worktreePath, p)),
  };
}
