import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { getConfigPath, loadRawConfig, writeAtomically } from "../core/config.ts";
import {
  detectInstallMethod,
  planInstallUpdate,
  type InstallUpdatePlan,
  type UpdateCheckResult,
  type UpdateFetch,
} from "../core/updater.ts";

type UpdateAvailableResult = Extract<UpdateCheckResult, { readonly status: "update-available" }>;

export function buildInstallPlan(result: UpdateAvailableResult): InstallUpdatePlan {
  const command = Bun.env.COPSE_UPDATE_TEST_INSTALL_COMMAND;
  if (command !== undefined && command.trim().length > 0) {
    return { kind: "command", method: "npm", command: ["sh", "-c", command] };
  }
  const method = detectInstallMethod({
    executablePath: process.argv[1] ?? process.execPath,
    realpath: realpathOrSelf,
    env: Bun.env,
  });
  return planInstallUpdate({
    method,
    latestVersion: result.latestVersion,
    executablePath: process.argv[1] ?? process.execPath,
    standaloneAsset: result.standaloneAsset,
  });
}

export function testReleaseFetch(): UpdateFetch | undefined {
  const releaseUrl = Bun.env.COPSE_UPDATE_TEST_RELEASE_URL;
  if (releaseUrl === undefined || releaseUrl.trim().length === 0) return undefined;
  return (_url, init) => fetch(releaseUrl, { headers: init.headers, signal: init.signal });
}

export function readCurrentVersion(): string {
  let dir = import.meta.dir;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "package.json");
    try {
      const parsed: unknown = JSON.parse(readFileSync(candidate, "utf-8"));
      const version = readStringField(parsed, "version");
      if (version !== undefined) return version;
    } catch (error) {
      if (error instanceof Error) {
        dir = join(dir, "..");
        continue;
      }
      throw error;
    }
  }
  throw new Error("Cannot find package.json version");
}

export function writeIgnoredVersion(version: string): void {
  const configPath = getConfigPath();
  const config = loadRawConfig();
  const next = {
    ...config,
    updates: {
      ...config.updates,
      ignoredVersion: version,
    },
  };
  writeAtomically(configPath, `${JSON.stringify(next, null, 2)}\n`);
}

function readStringField(value: unknown, field: string): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  for (const [key, fieldValue] of Object.entries(value)) {
    if (key === field && typeof fieldValue === "string") return fieldValue;
  }
  return undefined;
}

function realpathOrSelf(path: string): string {
  try {
    return realpathSync(path);
  } catch (error) {
    if (error instanceof Error) return path;
    throw error;
  }
}
