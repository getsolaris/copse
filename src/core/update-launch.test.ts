import { afterEach, describe, expect, it } from "bun:test";
import { writeFileSync } from "fs";
import { join } from "path";
import type { OmlConfig } from "./config.ts";
import { cleanupTempDirs, createTempDir } from "./test-helpers.ts";
import { InstallExecutionError, type InstallExecutionResult } from "./updater-execute.ts";
import type { InstallUpdatePlan, UpdateFetchResponse } from "./updater.ts";
import { runLaunchUpdateNotice, shouldSkipLaunchUpdateCheck } from "../cli/update-launch.ts";

const nowMs = Date.parse("2026-06-30T00:00:00.000Z");

const enabledConfig: OmlConfig = {
  version: 1,
  updates: { enabled: true, checkIntervalHours: 2 },
};

function release(tagName: string): UpdateFetchResponse {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      tag_name: tagName,
      html_url: `https://github.com/getsolaris/copse/releases/tag/${tagName}`,
    }),
  };
}

function commandPlan(): InstallUpdatePlan {
  return { kind: "command", method: "npm", command: ["printf", "update-ok"] };
}

function installed(): InstallExecutionResult {
  return { status: "updated", method: "npm", stdout: "update-ok", stderr: "" };
}

afterEach(() => {
  cleanupTempDirs();
});

describe("startup update launch notice", () => {
  it("startup update skips unsafe or machine-readable invocations", () => {
    const tty = { stdinIsTTY: true, stdoutIsTTY: true };
    const cases: readonly (readonly string[])[] = [
      ["bun", "src/index.ts"],
      ["bun", "src/index.ts", "update"],
      ["bun", "src/index.ts", "init"],
      ["bun", "src/index.ts", "completion"],
      ["bun", "src/index.ts", "--help"],
      ["bun", "src/index.ts", "--version"],
      ["bun", "src/index.ts", "list", "--json"],
      ["bun", "src/index.ts", "list", "--porcelain"],
      ["bun", "src/index.ts", "status", "--json"],
      ["bun", "src/index.ts", "doctor", "--json"],
      ["bun", "src/index.ts", "diff", "--json"],
      ["bun", "src/index.ts", "log", "--json"],
    ];

    expect(shouldSkipLaunchUpdateCheck(["bun", "src/index.ts", "list"], tty)).toBe(false);
    expect(shouldSkipLaunchUpdateCheck(["bun", "src/index.ts", "list"], { stdinIsTTY: false, stdoutIsTTY: true })).toBe(true);
    expect(shouldSkipLaunchUpdateCheck(["bun", "src/index.ts", "list"], { stdinIsTTY: true, stdoutIsTTY: false })).toBe(true);
    for (const argv of cases) {
      expect(shouldSkipLaunchUpdateCheck(argv, tty)).toBe(true);
    }
  });

  it("startup update requires opt-in config before touching the network", async () => {
    let fetchCount = 0;
    const disabled = await runLaunchUpdateNotice({
      config: { version: 1, updates: { enabled: false } },
      currentVersion: "1.0.0",
      cachePath: join(createTempDir("copse-launch-disabled-"), "cache.json"),
      fetchImpl: async () => {
        fetchCount += 1;
        return release("v9.9.9");
      },
      confirmInstall: async () => true,
      buildInstallPlan: commandPlan,
      executeInstallPlan: async () => installed(),
    });
    const missing = await runLaunchUpdateNotice({
      config: { version: 1 },
      currentVersion: "1.0.0",
      cachePath: join(createTempDir("copse-launch-missing-"), "cache.json"),
      fetchImpl: async () => {
        fetchCount += 1;
        return release("v9.9.9");
      },
      confirmInstall: async () => true,
      buildInstallPlan: commandPlan,
      executeInstallPlan: async () => installed(),
    });

    expect(disabled.status).toBe("skipped");
    expect(missing.status).toBe("skipped");
    expect(fetchCount).toBe(0);
  });

  it("startup update cancellation continues the original command without installing", async () => {
    const output: string[] = [];
    let installCount = 0;
    let question = "";

    const outcome = await runLaunchUpdateNotice({
      config: enabledConfig,
      currentVersion: "1.0.0",
      cachePath: join(createTempDir("copse-launch-cancel-"), "cache.json"),
      nowMs,
      fetchImpl: async () => release("v9.9.9"),
      confirmInstall: async (value) => {
        question = value;
        return false;
      },
      buildInstallPlan: commandPlan,
      executeInstallPlan: async () => {
        installCount += 1;
        return installed();
      },
      writeOutput: (line) => output.push(line),
    });

    expect(outcome.status).toBe("continued");
    expect(question).toBe("Install update now? [y/N] ");
    expect(output.join("\n")).toContain("Update available: 1.0.0 -> 9.9.9");
    expect(output.join("\n")).toContain("Update cancelled.");
    expect(installCount).toBe(0);
  });

  it("startup update install failure continues the original command", async () => {
    const errors: string[] = [];

    const outcome = await runLaunchUpdateNotice({
      config: enabledConfig,
      currentVersion: "1.0.0",
      cachePath: join(createTempDir("copse-launch-failure-"), "cache.json"),
      nowMs,
      fetchImpl: async () => release("v9.9.9"),
      confirmInstall: async () => true,
      buildInstallPlan: commandPlan,
      executeInstallPlan: async () => {
        throw new InstallExecutionError("update command failed with exit code 42", { stderr: "update-failed" });
      },
      writeError: (line) => errors.push(line),
    });

    expect(outcome.status).toBe("continued");
    expect(errors.join("\n")).toContain("update-failed");
    expect(errors.join("\n")).toContain("Error: update command failed with exit code 42");
  });

  it("startup update uses configured check interval for success cache freshness", async () => {
    const cachePath = join(createTempDir("copse-launch-interval-"), "cache.json");
    writeFileSync(cachePath, `${JSON.stringify({
      checkedAtMs: nowMs - (3 * 60 * 60 * 1000),
      result: {
        status: "update-available",
        currentVersion: "1.0.0",
        latestVersion: "8.8.8",
        releaseUrl: "https://example.test/old",
        source: "network",
      },
    }, null, 2)}\n`);
    const output: string[] = [];
    let fetchCount = 0;

    const outcome = await runLaunchUpdateNotice({
      config: enabledConfig,
      currentVersion: "1.0.0",
      cachePath,
      nowMs,
      fetchImpl: async () => {
        fetchCount += 1;
        return release("v9.9.9");
      },
      confirmInstall: async () => false,
      buildInstallPlan: commandPlan,
      writeOutput: (line) => output.push(line),
    });

    expect(outcome.status).toBe("continued");
    expect(fetchCount).toBe(1);
    expect(output.join("\n")).toContain("9.9.9");
    expect(output.join("\n")).not.toContain("8.8.8");
  });
});
