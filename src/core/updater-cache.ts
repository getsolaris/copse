import { randomUUID } from "crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { StandaloneUpdateAsset } from "./updater-install.ts";
import type { UpdateCacheEntry, UpdateCheckResult, UpdateCheckSource, UpdateFailureReason, UpdateStatePathEnv, WriteUpdateCacheOptions } from "./updater-types.ts";

const SUCCESS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 60 * 60 * 1000;
const STALE_LOCK_MS = 5 * 60 * 1000;

class UpdateCacheError extends Error {
  readonly name = "UpdateCacheError";
}

export function getUpdateStatePath(env: UpdateStatePathEnv = Bun.env): string {
  const base = env.XDG_CACHE_HOME ?? join(env.HOME ?? "~", ".cache");
  return join(base, "copse", "update-state.json");
}

export function writeUpdateCache(options: WriteUpdateCacheOptions): void {
  const nowMs = options.nowMs ?? Date.now();
  mkdirSync(dirname(options.cachePath), { recursive: true });
  const lockPath = acquireCacheLock(options.cachePath, nowMs);
  const tmpPath = `${options.cachePath}.tmp.${nowMs}.${randomUUID()}`;
  try {
    writeFileSync(tmpPath, `${JSON.stringify(options.entry, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
    renameSync(tmpPath, options.cachePath);
  } catch (error) {
    removePathIfExists(tmpPath);
    if (error instanceof Error) throw error;
    throw new UpdateCacheError("failed to write update cache");
  } finally {
    removePathIfExists(lockPath);
  }
}

export function readUpdateCache(cachePath: string): UpdateCacheEntry | null {
  if (!existsSync(cachePath)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(cachePath, "utf-8"));
    return parseCacheEntry(parsed);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof Error) return null;
    throw new UpdateCacheError("unknown cache read failure");
  }
}

export function isCacheFresh(entry: UpdateCacheEntry, nowMs: number): boolean {
  const ttlMs = entry.result.status === "check-failed" ? FAILURE_CACHE_TTL_MS : SUCCESS_CACHE_TTL_MS;
  return nowMs - entry.checkedAtMs < ttlMs;
}

export function withSource(result: UpdateCheckResult, source: UpdateCheckSource): UpdateCheckResult {
  return { ...result, source };
}

function parseCacheEntry(value: unknown): UpdateCacheEntry | null {
  const checkedAtMs = readNumberField(value, "checkedAtMs");
  const result = parseCheckResult(readField(value, "result"));
  if (checkedAtMs === undefined || !Number.isFinite(checkedAtMs) || result === null) return null;
  return { checkedAtMs, result };
}

function parseCheckResult(value: unknown): UpdateCheckResult | null {
  const status = readStringField(value, "status");
  const source = readSource(value) ?? "network";
  const currentVersion = readStringField(value, "currentVersion");
  const latestVersion = readStringField(value, "latestVersion");
  switch (status) {
    case "up-to-date":
      if (currentVersion === undefined || latestVersion === undefined) return null;
      return { status, currentVersion, latestVersion, source };
    case "update-available": {
      const releaseUrl = readStringField(value, "releaseUrl");
      if (currentVersion === undefined || latestVersion === undefined || releaseUrl === undefined) return null;
      const standaloneAsset = readStandaloneAsset(value);
      return standaloneAsset === undefined
        ? { status, currentVersion, latestVersion, releaseUrl, source }
        : { status, currentVersion, latestVersion, releaseUrl, source, standaloneAsset };
    }
    case "ignored-version": {
      const ignoredVersion = readStringField(value, "ignoredVersion");
      if (currentVersion === undefined || latestVersion === undefined || ignoredVersion === undefined) return null;
      return { status, currentVersion, latestVersion, ignoredVersion, source };
    }
    case "check-failed": {
      const reason = readFailureReason(value);
      const message = readStringField(value, "message");
      if (reason === undefined || message === undefined) return null;
      return { status, reason, message, source };
    }
    default:
      return null;
  }
}

function acquireCacheLock(cachePath: string, nowMs: number): string {
  const lockPath = `${cachePath}.lock`;
  if (tryCreateLock(lockPath, nowMs) === "created") return lockPath;
  if (recoverStaleLock(lockPath, nowMs) && tryCreateLock(lockPath, nowMs) === "created") return lockPath;
  throw new UpdateCacheError(`update cache lock is active: ${lockPath}`);
}

function tryCreateLock(lockPath: string, nowMs: number): "created" | "exists" {
  let fd: number | undefined;
  try {
    fd = openSync(lockPath, "wx", 0o600);
    writeFileSync(fd, String(nowMs), { encoding: "utf-8" });
    return "created";
  } catch (error) {
    if (readStringField(error, "code") === "EEXIST") return "exists";
    if (error instanceof Error) throw error;
    throw new UpdateCacheError("failed to create update cache lock");
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function recoverStaleLock(lockPath: string, nowMs: number): boolean {
  const lockedAt = Number(readFileSync(lockPath, "utf-8"));
  if (!Number.isFinite(lockedAt) || nowMs - lockedAt <= STALE_LOCK_MS) return false;
  unlinkSync(lockPath);
  return true;
}

function removePathIfExists(path: string): void {
  if (existsSync(path)) unlinkSync(path);
}

function readSource(value: unknown): UpdateCheckSource | undefined {
  const source = readStringField(value, "source");
  if (source === "network" || source === "cache") return source;
  return undefined;
}

function readFailureReason(value: unknown): UpdateFailureReason | undefined {
  const reason = readStringField(value, "reason");
  switch (reason) {
    case "http":
    case "invalid-json":
    case "missing-tag":
    case "timeout":
    case "invalid-version":
    case "network":
      return reason;
    default:
      return undefined;
  }
}

function readStandaloneAsset(value: unknown): StandaloneUpdateAsset | undefined {
  const candidate = readField(value, "standaloneAsset");
  const downloadUrl = readStringField(candidate, "downloadUrl");
  if (downloadUrl === undefined) return undefined;
  const digest = readStringField(candidate, "digest");
  return digest === undefined ? { downloadUrl } : { downloadUrl, digest };
}

function readStringField(value: unknown, field: string): string | undefined {
  const fieldValue = readField(value, field);
  return typeof fieldValue === "string" ? fieldValue : undefined;
}

function readNumberField(value: unknown, field: string): number | undefined {
  const fieldValue = readField(value, field);
  return typeof fieldValue === "number" ? fieldValue : undefined;
}

function readField(value: unknown, field: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  for (const [key, fieldValue] of Object.entries(value)) {
    if (key === field) return fieldValue;
  }
  return undefined;
}
