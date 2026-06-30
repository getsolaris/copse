import { isCacheFresh, readUpdateCache, withSource, writeUpdateCache as persistUpdateCache } from "./updater-cache.ts";
import type { StandaloneUpdateAsset } from "./updater-install.ts";
import type { UpdateCacheEntry, UpdateCheckOptions, UpdateCheckResult, UpdateFailureReason, UpdateFetch } from "./updater-types.ts";

export { getUpdateStatePath, writeUpdateCache } from "./updater-cache.ts";
export { detectInstallMethod, planInstallUpdate } from "./updater-install.ts";
export type {
  InstallDetectionEnv,
  InstallDetectionOptions,
  InstallMethod,
  InstallUpdatePlan,
  InstallUpdatePlanOptions,
  StandaloneUpdateAsset,
} from "./updater-install.ts";
export type {
  UpdateCacheEntry,
  UpdateCheckOptions,
  UpdateCheckResult,
  UpdateCheckSource,
  UpdateFailureReason,
  UpdateFetch,
  UpdateFetchInit,
  UpdateFetchResponse,
  UpdateStatePathEnv,
  WriteUpdateCacheOptions,
} from "./updater-types.ts";

const GITHUB_LATEST_RELEASE_URL = "https://api.github.com/repos/getsolaris/copse/releases/latest";
const GITHUB_HEADERS: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2026-03-10",
};
const LAUNCH_TIMEOUT_MS = 1500;
const EXPLICIT_TIMEOUT_MS = 5000;

interface VersionParts {
  readonly normalized: string;
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

interface LatestRelease {
  readonly version: VersionParts;
  readonly releaseUrl: string;
  readonly standaloneAsset?: StandaloneUpdateAsset;
}

type CheckFailedResult = Extract<UpdateCheckResult, { readonly status: "check-failed" }>;
type LatestReleaseResult =
  | { readonly status: "success"; readonly release: LatestRelease }
  | { readonly status: "failure"; readonly result: CheckFailedResult };
type CachePolicy = "honor-all" | "ignore-failures";

class UpdateCoreError extends Error {
  readonly name = "UpdateCoreError";
}

const defaultFetch: UpdateFetch = (url, init) => fetch(url, { headers: init.headers, signal: init.signal });

export async function checkForUpdate(options: UpdateCheckOptions): Promise<UpdateCheckResult> {
  return checkForUpdateWithTimeout(options, EXPLICIT_TIMEOUT_MS, "ignore-failures");
}

export async function checkForUpdateOnLaunch(options: UpdateCheckOptions): Promise<UpdateCheckResult> {
  return checkForUpdateWithTimeout(options, LAUNCH_TIMEOUT_MS, "honor-all");
}

async function checkForUpdateWithTimeout(
  options: UpdateCheckOptions,
  timeoutMs: number,
  cachePolicy: CachePolicy,
): Promise<UpdateCheckResult> {
  const nowMs = options.nowMs ?? Date.now();
  const cached = options.cachePath === undefined ? null : readUpdateCache(options.cachePath);
  if (cached !== null && shouldUseCache(cached, nowMs, cachePolicy, options)) {
    return withSource(cached.result, "cache");
  }

  const latest = await requestLatestRelease(options.fetchImpl ?? defaultFetch, timeoutMs);
  const result = latest.status === "success"
    ? compareUpdate(options.currentVersion, options.ignoredVersion, latest.release)
    : latest.result;
  if (options.cachePath !== undefined) {
    persistUpdateCache({ cachePath: options.cachePath, nowMs, entry: { checkedAtMs: nowMs, result } });
  }
  return result;
}

function shouldUseCache(entry: UpdateCacheEntry, nowMs: number, policy: CachePolicy, options: UpdateCheckOptions): boolean {
  if (!isCacheFresh(entry, nowMs, {
    successCacheTtlMs: options.successCacheTtlMs,
    failureCacheTtlMs: options.failureCacheTtlMs,
  })) return false;
  return policy === "honor-all" || entry.result.status !== "check-failed";
}

async function requestLatestRelease(fetchImpl: UpdateFetch, timeoutMs: number): Promise<LatestReleaseResult> {
  try {
    const response = await fetchImpl(GITHUB_LATEST_RELEASE_URL, {
      headers: GITHUB_HEADERS,
      timeoutMs,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return failed("http", `GitHub returned HTTP ${response.status}`);
    const parsed: unknown = JSON.parse(await response.text());
    return parseLatestRelease(parsed);
  } catch (error) {
    if (isTimeoutError(error)) return failed("timeout", "GitHub latest release request timed out");
    if (error instanceof SyntaxError) return failed("invalid-json", error.message);
    if (error instanceof Error) return failed("network", error.message);
    throw new UpdateCoreError("unknown updater failure");
  }
}

function parseLatestRelease(value: unknown): LatestReleaseResult {
  const tagName = readStringField(value, "tag_name");
  if (tagName === undefined) return failed("missing-tag", "GitHub latest release is missing tag_name");

  const version = parseReleaseTag(tagName);
  if (version === null) {
    return failed("invalid-version", `GitHub latest release tag is not stable semver: ${tagName}`);
  }

  return {
    status: "success",
    release: {
      version,
      releaseUrl: readStringField(value, "html_url") ?? `https://github.com/getsolaris/copse/releases/tag/v${version.normalized}`,
      ...standaloneAssetFields(readField(value, "assets")),
    },
  };
}

function compareUpdate(
  currentVersion: string,
  ignoredVersion: string | undefined,
  release: LatestRelease,
): UpdateCheckResult {
  const current = parseVersion(currentVersion);
  if (current === null) {
    return {
      status: "check-failed",
      reason: "invalid-version",
      message: `Current version is not stable semver: ${currentVersion}`,
      source: "network",
    };
  }
  if (compareVersions(current, release.version) >= 0) {
    return {
      status: "up-to-date",
      currentVersion: current.normalized,
      latestVersion: release.version.normalized,
      source: "network",
    };
  }

  const ignored = ignoredVersion === undefined ? null : parseVersion(ignoredVersion);
  if (ignored !== null && compareVersions(ignored, release.version) === 0) {
    return {
      status: "ignored-version",
      currentVersion: current.normalized,
      latestVersion: release.version.normalized,
      ignoredVersion: ignored.normalized,
      source: "network",
    };
  }

  const result: Extract<UpdateCheckResult, { readonly status: "update-available" }> = {
    status: "update-available",
    currentVersion: current.normalized,
    latestVersion: release.version.normalized,
    releaseUrl: release.releaseUrl,
    source: "network",
  };
  return release.standaloneAsset === undefined ? result : { ...result, standaloneAsset: release.standaloneAsset };
}

function parseReleaseTag(value: string): VersionParts | null {
  return parseStableVersion(value, /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
}

function parseVersion(value: string): VersionParts | null {
  return parseStableVersion(value, /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
}

function parseStableVersion(value: string, pattern: RegExp): VersionParts | null {
  const match = pattern.exec(value.trim());
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) return null;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) return null;
  return { normalized: `${major}.${minor}.${patch}`, major, minor, patch };
}

function compareVersions(left: VersionParts, right: VersionParts): number {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

function readStringField(value: unknown, field: string): string | undefined {
  const fieldValue = readField(value, field);
  return typeof fieldValue === "string" ? fieldValue : undefined;
}

function readField(value: unknown, field: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  for (const [key, fieldValue] of Object.entries(value)) {
    if (key === field) return fieldValue;
  }
  return undefined;
}

function standaloneAssetFields(value: unknown): { readonly standaloneAsset?: StandaloneUpdateAsset } {
  if (!Array.isArray(value)) return {};
  for (const asset of value) {
    if (readStringField(asset, "name") !== "copse.js") continue;
    const downloadUrl = readStringField(asset, "browser_download_url");
    if (downloadUrl === undefined) continue;
    const digest = readStringField(asset, "digest");
    return digest === undefined ? { standaloneAsset: { downloadUrl } } : { standaloneAsset: { downloadUrl, digest } };
  }
  return {};
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === "TimeoutError" || error.name === "AbortError";
  if (error instanceof Error) return error.name === "TimeoutError" || error.name === "AbortError";
  return false;
}

function failed(reason: UpdateFailureReason, message: string): LatestReleaseResult {
  return { status: "failure", result: { status: "check-failed", reason, message, source: "network" } };
}
