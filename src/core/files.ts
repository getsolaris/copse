import * as fs from "fs";
import { join, resolve } from "path";

interface FsSyncCompat {
  copyFileSync(src: string, dst: string): void;
  existsSync(path: string): boolean;
  symlinkSync(target: string, path: string): void;
  unlinkSync(path: string): void;
}

const { copyFileSync, existsSync, symlinkSync, unlinkSync } = fs as unknown as FsSyncCompat;

export interface FilesResult {
  copied: string[];
  linked: string[];
  skipped: string[];
  warnings: string[];
}

/**
 * Copy files from sourceDir to targetDir.
 * Missing source files are skipped with a warning (not an error).
 * Existing target files are skipped with a warning (not overwritten).
 */
export function copyFiles(
  sourceDir: string,
  targetDir: string,
  files: string[],
): FilesResult {
  const result: FilesResult = { copied: [], linked: [], skipped: [], warnings: [] };

  for (const file of files) {
    const src = join(resolve(sourceDir), file);
    const dst = join(resolve(targetDir), file);

    if (!existsSync(src)) {
      result.skipped.push(file);
      result.warnings.push(`Source not found, skipping copy: ${file}`);
      continue;
    }
    if (existsSync(dst)) {
      result.skipped.push(file);
      result.warnings.push(`Target already exists, skipping copy: ${file}`);
      continue;
    }
    try {
      copyFileSync(src, dst);
      result.copied.push(file);
    } catch (e) {
      result.skipped.push(file);
      result.warnings.push(`Failed to copy ${file}: ${(e as Error).message}`);
    }
  }

  return result;
}

/**
 * Create symlinks in targetDir pointing to sourceDir entries.
 * Missing source files/dirs are skipped with a warning.
 * Existing target paths are skipped with a warning.
 */
export function linkFiles(
  sourceDir: string,
  targetDir: string,
  files: string[],
): FilesResult {
  const result: FilesResult = { copied: [], linked: [], skipped: [], warnings: [] };

  for (const file of files) {
    const src = resolve(join(resolve(sourceDir), file));
    const dst = join(resolve(targetDir), file);

    if (!existsSync(src)) {
      result.skipped.push(file);
      result.warnings.push(`Source not found, skipping symlink: ${file}`);
      continue;
    }
    if (existsSync(dst)) {
      result.skipped.push(file);
      result.warnings.push(`Target already exists, skipping symlink: ${file}`);
      continue;
    }
    try {
      symlinkSync(src, dst);
      result.linked.push(file);
    } catch (e) {
      result.skipped.push(file);
      result.warnings.push(`Failed to symlink ${file}: ${(e as Error).message}`);
    }
  }

  return result;
}

/**
 * Remove files/symlinks from targetDir (for rollback on failed worktree creation).
 * Does not throw if files don't exist.
 */
export function cleanupFiles(targetDir: string, files: string[]): void {
  for (const file of files) {
    const target = join(resolve(targetDir), file);
    try {
      if (existsSync(target)) {
        unlinkSync(target);
      }
    } catch {
    }
  }
}
