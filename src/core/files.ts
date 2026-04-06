import * as fs from "fs";
import { join, resolve, dirname } from "path";

interface FsSyncCompat {
  copyFileSync(src: string, dst: string): void;
  cpSync(src: string, dst: string, options?: { recursive?: boolean }): void;
  existsSync(path: string): boolean;
  symlinkSync(target: string, path: string): void;
  unlinkSync(path: string): void;
  linkSync(existingPath: string, newPath: string): void;
  readdirSync(path: string, options?: { recursive?: boolean; withFileTypes?: boolean }): any[];
  statSync(path: string, options?: { throwIfNoEntry?: boolean }): any | undefined;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
}

const { copyFileSync, cpSync, existsSync, symlinkSync, unlinkSync, linkSync, readdirSync, statSync, mkdirSync } = fs as unknown as FsSyncCompat;

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
      mkdirSync(dirname(dst), { recursive: true });
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
      mkdirSync(dirname(dst), { recursive: true });
      symlinkSync(src, dst);
      result.linked.push(file);
    } catch (e) {
      result.skipped.push(file);
      result.warnings.push(`Failed to symlink ${file}: ${(e as Error).message}`);
    }
  }

  return result;
}

import type { SharedDepsConfig } from "./config.ts";

const MAX_HARDLINK_DEPTH = 30;

export function hardlinkDir(sourceDir: string, targetDir: string, depth = 0): { linked: number; errors: string[] } {
  let linked = 0;
  const errors: string[] = [];

  if (depth > MAX_HARDLINK_DEPTH) {
    return { linked: 0, errors: [`Max directory depth exceeded at ${sourceDir}`] };
  }

  const srcResolved = resolve(sourceDir);
  const dstResolved = resolve(targetDir);

  if (!existsSync(srcResolved)) {
    return { linked: 0, errors: [`Source not found: ${sourceDir}`] };
  }

  const srcStat = statSync(srcResolved, { throwIfNoEntry: false });
  if (!srcStat || !srcStat.isDirectory()) {
    try {
      mkdirSync(dirname(dstResolved), { recursive: true });
      linkSync(srcResolved, dstResolved);
      return { linked: 1, errors: [] };
    } catch (e) {
      return { linked: 0, errors: [`Failed to hardlink ${sourceDir}: ${(e as Error).message}`] };
    }
  }

  if (!existsSync(dstResolved)) {
    mkdirSync(dstResolved, { recursive: true });
  }

  try {
    const entries = readdirSync(srcResolved, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(srcResolved, entry.name);
      const dstPath = join(dstResolved, entry.name);

      if (entry.isDirectory()) {
        const sub = hardlinkDir(srcPath, dstPath, depth + 1);
        linked += sub.linked;
        if (sub.errors.length > 0) errors.push(...sub.errors);
      } else if (entry.isFile()) {
        if (existsSync(dstPath)) continue;
        try {
          linkSync(srcPath, dstPath);
          linked++;
        } catch (e) {
          try {
            copyFileSync(srcPath, dstPath);
            linked++;
          } catch (e2) {
            errors.push(`Failed to link/copy ${entry.name}: ${(e2 as Error).message}`);
          }
        }
      }
    }
  } catch (e) {
    errors.push(`Failed to read directory ${sourceDir}: ${(e as Error).message}`);
  }

  return { linked, errors };
}

export function applySharedDeps(
  sourceDir: string,
  targetDir: string,
  config: SharedDepsConfig,
): FilesResult {
  const result: FilesResult = { copied: [], linked: [], skipped: [], warnings: [] };
  const paths = config.paths ?? [];
  const strategy = config.strategy ?? "symlink";

  for (const depPath of paths) {
    const src = join(resolve(sourceDir), depPath);
    const dst = join(resolve(targetDir), depPath);

    if (!existsSync(src)) {
      result.skipped.push(depPath);
      result.warnings.push(`Source not found, skipping shared dep: ${depPath}`);
      continue;
    }

    if (existsSync(dst)) {
      result.skipped.push(depPath);
      continue;
    }

    try {
      if (strategy === "symlink") {
        mkdirSync(dirname(dst), { recursive: true });
        symlinkSync(src, dst);
        result.linked.push(depPath);
      } else if (strategy === "hardlink") {
        const hr = hardlinkDir(src, dst);
        if (hr.linked > 0) result.linked.push(depPath);
        for (const e of hr.errors) result.warnings.push(e);
      } else {
        mkdirSync(dirname(dst), { recursive: true });
        cpSync(src, dst, { recursive: true });
        result.copied.push(depPath);
      }
    } catch (e) {
      result.skipped.push(depPath);
      result.warnings.push(`Failed to share dep ${depPath}: ${(e as Error).message}`);
    }
  }

  return result;
}


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
