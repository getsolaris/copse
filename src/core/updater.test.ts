import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  checkForUpdate,
  checkForUpdateOnLaunch,
  writeUpdateCache,
  type UpdateCacheEntry,
  type UpdateFailureReason,
  type UpdateFetch,
  type UpdateFetchInit,
  type UpdateFetchResponse,
} from "./updater.ts";
import { cleanupTempDirs, createTempDir } from "./test-helpers.ts";

const nowMs = Date.parse("2026-06-30T00:00:00.000Z");

function response(status: number, body: string): UpdateFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  };
}

function release(tagName: string): UpdateFetchResponse {
  return response(200, JSON.stringify({
    tag_name: tagName,
    html_url: `https://github.com/getsolaris/copse/releases/tag/${tagName}`,
    ignored_by_parser: { nested: true },
  }));
}

function jsonCache(entry: UpdateCacheEntry): string {
  return `${JSON.stringify(entry, null, 2)}\n`;
}

describe("checkForUpdate", () => {
  afterEach(() => {
    cleanupTempDirs();
  });

  it("returns update available when GitHub latest release has newer stable semver tag", async () => {
    let capturedUrl = "";
    let capturedInit: UpdateFetchInit | undefined;
    const fetchImpl: UpdateFetch = async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return release("v1.3.2");
    };

    const result = await checkForUpdate({
      currentVersion: "1.3.1",
      fetchImpl,
      nowMs,
    });

    expect(result).toEqual({
      status: "update-available",
      currentVersion: "1.3.1",
      latestVersion: "1.3.2",
      releaseUrl: "https://github.com/getsolaris/copse/releases/tag/v1.3.2",
      source: "network",
    });
    expect(capturedUrl).toBe("https://api.github.com/repos/getsolaris/copse/releases/latest");
    expect(capturedInit?.headers.Accept).toBe("application/vnd.github+json");
    expect(capturedInit?.headers["X-GitHub-Api-Version"]).toBe("2026-03-10");
    expect(capturedInit?.timeoutMs).toBe(5000);
  });

  it("returns up to date when latest stable semver tag matches current version", async () => {
    const result = await checkForUpdate({
      currentVersion: "1.3.2",
      fetchImpl: async () => release("v1.3.2"),
      nowMs,
    });

    expect(result).toEqual({
      status: "up-to-date",
      currentVersion: "1.3.2",
      latestVersion: "1.3.2",
      source: "network",
    });
  });

  it("returns ignored version only for the exact ignored version", async () => {
    const ignored = await checkForUpdate({
      currentVersion: "1.3.1",
      ignoredVersion: "1.3.2",
      fetchImpl: async () => release("v1.3.2"),
      nowMs,
    });
    const newer = await checkForUpdate({
      currentVersion: "1.3.1",
      ignoredVersion: "1.3.2",
      fetchImpl: async () => release("v1.3.3"),
      nowMs,
    });

    expect(ignored).toEqual({
      status: "ignored-version",
      currentVersion: "1.3.1",
      latestVersion: "1.3.2",
      ignoredVersion: "1.3.2",
      source: "network",
    });
    expect(newer).toMatchObject({ status: "update-available", latestVersion: "1.3.3" });
  });

  it("returns check failed for 403 invalid JSON missing tag timeout and invalid semver", async () => {
    const cases: readonly [string, UpdateFetch, UpdateFailureReason][] = [
      ["http", async () => response(403, "{}"), "http"],
      ["invalid JSON", async () => response(200, "{"), "invalid-json"],
      ["missing tag", async () => response(200, JSON.stringify({ name: "Release" })), "missing-tag"],
      ["timeout", async () => { throw new DOMException("expired", "TimeoutError"); }, "timeout"],
      ["invalid semver", async () => release("v1.3.2-beta.1"), "invalid-version"],
      ["missing v prefix", async () => release("1.3.2"), "invalid-version"],
    ];

    for (const [label, fetchImpl, reason] of cases) {
      const result = await checkForUpdate({ currentVersion: "1.3.1", fetchImpl, nowMs });
      expect({ label, status: result.status, reason: result.status === "check-failed" ? result.reason : "" })
        .toEqual({ label, status: "check-failed", reason });
    }
  });

  it("uses 24h success and 1h failure throttles from launch cache", async () => {
    const dir = createTempDir("copse-updater-cache-");
    const successPath = join(dir, "success.json");
    const failurePath = join(dir, "failure.json");
    writeFileSync(successPath, jsonCache({
      checkedAtMs: nowMs - (24 * 60 * 60 * 1000) + 1,
      result: {
        status: "update-available",
        currentVersion: "1.3.1",
        latestVersion: "1.3.2",
        releaseUrl: "https://example.test",
        source: "network",
      },
    }));
    writeFileSync(failurePath, jsonCache({
      checkedAtMs: nowMs - (60 * 60 * 1000) + 1,
      result: { status: "check-failed", reason: "http", message: "403", source: "network" },
    }));
    let fetchCount = 0;
    const fetchImpl: UpdateFetch = async () => {
      fetchCount += 1;
      return release("v9.0.0");
    };

    const success = await checkForUpdateOnLaunch({ currentVersion: "1.3.1", fetchImpl, nowMs, cachePath: successPath });
    const failure = await checkForUpdateOnLaunch({ currentVersion: "1.3.1", fetchImpl, nowMs, cachePath: failurePath });

    expect(success).toMatchObject({ status: "update-available", latestVersion: "1.3.2", source: "cache" });
    expect(failure).toMatchObject({ status: "check-failed", reason: "http", source: "cache" });
    expect(fetchCount).toBe(0);
  });

  it("ignores recent failure cache for explicit checks", async () => {
    const dir = createTempDir("copse-updater-cache-");
    const cachePath = join(dir, "failure.json");
    writeFileSync(cachePath, jsonCache({
      checkedAtMs: nowMs - 1,
      result: { status: "check-failed", reason: "http", message: "403", source: "network" },
    }));
    let fetchCount = 0;

    const result = await checkForUpdate({
      currentVersion: "1.3.1",
      nowMs,
      cachePath,
      fetchImpl: async () => {
        fetchCount += 1;
        return release("v1.3.2");
      },
    });

    expect(result).toMatchObject({ status: "update-available", latestVersion: "1.3.2", source: "network" });
    expect(fetchCount).toBe(1);
  });
});

describe("checkForUpdateOnLaunch", () => {
  it("uses a 1500ms launch timeout for latest release checks", async () => {
    let capturedInit: UpdateFetchInit | undefined;
    const result = await checkForUpdateOnLaunch({
      currentVersion: "1.3.1",
      nowMs,
      fetchImpl: async (_url, init) => {
        capturedInit = init;
        return release("v1.3.2");
      },
    });

    expect(result).toMatchObject({ status: "update-available", latestVersion: "1.3.2" });
    expect(capturedInit?.timeoutMs).toBe(1500);
  });
});

describe("writeUpdateCache", () => {
  afterEach(() => {
    cleanupTempDirs();
  });

  it("writes cache atomically without temp leftovers", () => {
    const dir = createTempDir("copse-updater-cache-");
    const cachePath = join(dir, "cache.json");

    writeUpdateCache({
      cachePath,
      nowMs,
      entry: {
        checkedAtMs: nowMs,
        result: { status: "up-to-date", currentVersion: "1.3.2", latestVersion: "1.3.2", source: "network" },
      },
    });

    const parsed: unknown = JSON.parse(readFileSync(cachePath, "utf-8"));
    expect(parsed).toMatchObject({ checkedAtMs: nowMs });
    expect(existsSync(`${cachePath}.lock`)).toBeFalse();
    expect(readdirSync(dir).filter((name) => name.startsWith("cache.json.tmp."))).toEqual([]);
  });

  it("recovers a stale cache lock before writing", () => {
    const dir = createTempDir("copse-updater-cache-");
    const cachePath = join(dir, "cache.json");
    writeFileSync(`${cachePath}.lock`, String(nowMs - 10 * 60 * 1000));

    writeUpdateCache({
      cachePath,
      nowMs,
      entry: {
        checkedAtMs: nowMs,
        result: { status: "up-to-date", currentVersion: "1.3.2", latestVersion: "1.3.2", source: "network" },
      },
    });

    const parsed: unknown = JSON.parse(readFileSync(cachePath, "utf-8"));
    expect(parsed).toMatchObject({ checkedAtMs: nowMs });
    expect(existsSync(`${cachePath}.lock`)).toBeFalse();
  });
});
