import type { CommandModule } from "yargs";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { getConfigPath, loadRawConfig, writeAtomically } from "../../core/config.ts";
import {
  checkForUpdate,
  detectInstallMethod,
  planInstallUpdate,
  type InstallUpdatePlan,
  type UpdateCheckResult,
  type UpdateFetch,
} from "../../core/updater.ts";
import { executeInstallPlan, InstallExecutionError } from "../../core/updater-execute.ts";
import { confirm } from "../utils.ts";
import { printNonInteractiveUpdate, printStatus, resultToJson, unsupportedMessage, updateAvailableStatus, updateSummary } from "./update-output.ts";

const cmd: CommandModule = {
  command: "update",
  describe: "Check for and install copse updates",
  builder: (yargs) =>
    yargs
      .option("check", {
        type: "boolean",
        describe: "Check for updates without installing",
      })
      .option("yes", {
        type: "boolean",
        alias: "y",
        describe: "Install without prompting",
      })
      .option("json", {
        type: "boolean",
        alias: "j",
        describe: "Output as JSON",
      })
      .option("ignore", {
        type: "boolean",
        describe: "Ignore the current latest version",
      }),
  handler: async (argv) => {
    try {
      const json = argv.json === true;
      const checkOnly = argv.check === true;
      const assumeYes = argv.yes === true;
      const ignore = argv.ignore === true;
      const config = loadRawConfig();
      const result = await checkForUpdate({
        currentVersion: readCurrentVersion(),
        ignoredVersion: config.updates?.ignoredVersion,
        fetchImpl: testReleaseFetch(),
      });

      if (result.status !== "update-available") {
        printStatus(resultToJson(result), json);
        process.exit(result.status === "check-failed" ? 1 : 0);
      }

      if (ignore) {
        writeIgnoredVersion(result.latestVersion);
        printStatus({
          status: "ignored-version",
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          releaseUrl: result.releaseUrl,
          message: `Ignored ${result.latestVersion}`,
        }, json);
        process.exit(0);
      }

      const plan = buildInstallPlan(result);
      if (checkOnly || (json && !assumeYes)) {
        printStatus(updateAvailableStatus(result, plan), json);
        process.exit(0);
      }

      if (plan.kind === "unsupported-install") {
        printStatus({
          status: "unsupported-install",
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          releaseUrl: result.releaseUrl,
          installMethod: plan.method,
          reason: plan.reason,
          message: unsupportedMessage(plan.method),
        }, json);
        process.exit(assumeYes ? 1 : 0);
      }

      if (!assumeYes) {
        if (!process.stdin.isTTY) {
          printNonInteractiveUpdate(result);
          process.exit(0);
        }
        console.log(updateSummary(result, plan));
        if (!(await confirm("Install update now? [y/N] "))) {
          printStatus({ ...updateAvailableStatus(result, plan), status: "cancelled", message: "Update cancelled." }, json);
          process.exit(0);
        }
      }

      const installed = await executeInstallPlan(plan);
      printStatus({
        status: "updated",
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        releaseUrl: result.releaseUrl,
        installMethod: installed.method,
        stdout: installed.stdout,
        stderr: installed.stderr,
      }, json);
      process.exit(0);
    } catch (err) {
      if (err instanceof InstallExecutionError) {
        if (err.stderr && err.stderr.length > 0) console.error(err.stderr);
        console.error(`Error: ${err.message}`);
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exit(1);
    }
  },
};

function buildInstallPlan(result: Extract<UpdateCheckResult, { readonly status: "update-available" }>): InstallUpdatePlan {
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

function testReleaseFetch(): UpdateFetch | undefined {
  const releaseUrl = Bun.env.COPSE_UPDATE_TEST_RELEASE_URL;
  if (releaseUrl === undefined || releaseUrl.trim().length === 0) return undefined;
  return (_url, init) => fetch(releaseUrl, { headers: init.headers, signal: init.signal });
}

function readCurrentVersion(): string {
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

function writeIgnoredVersion(version: string): void {
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

export default cmd;
