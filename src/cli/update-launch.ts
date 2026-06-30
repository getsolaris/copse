import type { OmlConfig } from "../core/config.ts";
import { loadRawConfig } from "../core/config.ts";
import {
  checkForUpdateOnLaunch,
  getUpdateStatePath,
  type InstallUpdatePlan,
  type UpdateCheckResult,
  type UpdateFetch,
} from "../core/updater.ts";
import { executeInstallPlan, InstallExecutionError, type InstallExecutionResult } from "../core/updater-execute.ts";
import { buildInstallPlan, readCurrentVersion } from "../core/updater-runtime.ts";
import { unsupportedMessage, updateSummary } from "./cmd/update-output.ts";
import { confirm } from "./utils.ts";

type UpdateAvailableResult = Extract<UpdateCheckResult, { readonly status: "update-available" }>;
type ExecutableInstallPlan = Exclude<InstallUpdatePlan, { readonly kind: "unsupported-install" }>;
type LaunchOutcomeStatus = "skipped" | "continued";

interface LaunchCheckIo {
  readonly stdinIsTTY: boolean;
  readonly stdoutIsTTY: boolean;
}

export interface LaunchUpdateNoticeOutcome {
  readonly status: LaunchOutcomeStatus;
}

export interface LaunchUpdateNoticeOptions {
  readonly config: OmlConfig;
  readonly currentVersion: string;
  readonly cachePath: string;
  readonly nowMs?: number;
  readonly fetchImpl?: UpdateFetch;
  readonly confirmInstall: (question: string) => Promise<boolean>;
  readonly buildInstallPlan?: (result: UpdateAvailableResult) => InstallUpdatePlan;
  readonly executeInstallPlan?: (plan: ExecutableInstallPlan) => Promise<InstallExecutionResult>;
  readonly writeOutput?: (line: string) => void;
  readonly writeError?: (line: string) => void;
}

const skipCommands = new Set(["update", "init", "completion", "shell-init"]);
const jsonCommands = new Set(["status", "doctor", "diff", "log", "logs"]);
const listCommands = new Set(["list", "ls"]);
const globalOptions = new Set(["--no-color"]);

export function shouldSkipLaunchUpdateCheck(argv: readonly string[], io: LaunchCheckIo): boolean {
  if (!io.stdinIsTTY || !io.stdoutIsTTY) return true;
  const args = argv.slice(2);
  if (args.length === 0) return true;
  if (args.some((arg) => arg === "--help" || arg === "-h" || arg === "--version" || arg === "-v")) return true;

  const command = firstCommandArg(args);
  if (command === undefined || command.startsWith("-")) return true;
  if (skipCommands.has(command)) return true;

  const hasJson = args.includes("--json") || args.includes("-j");
  const hasPorcelain = args.includes("--porcelain") || args.includes("-p");
  if (listCommands.has(command) && (hasJson || hasPorcelain)) return true;
  if (jsonCommands.has(command) && hasJson) return true;
  if (command === "config" && (args.includes("--show") || args.includes("-s") || args.includes("--path"))) return true;
  return false;
}

export async function maybePromptForUpdateOnLaunch(argv: readonly string[] = process.argv): Promise<void> {
  if (shouldSkipLaunchUpdateCheck(argv, {
    stdinIsTTY: process.stdin.isTTY === true,
    stdoutIsTTY: process.stdout.isTTY === true,
  })) return;

  try {
    await runLaunchUpdateNotice({
      config: loadRawConfig(),
      currentVersion: readCurrentVersion(),
      cachePath: getUpdateStatePath(),
      confirmInstall: confirm,
    });
  } catch {}
}

export async function runLaunchUpdateNotice(options: LaunchUpdateNoticeOptions): Promise<LaunchUpdateNoticeOutcome> {
  if (options.config.updates?.enabled !== true) return { status: "skipped" };

  const result = await checkForUpdateOnLaunch({
    currentVersion: options.currentVersion,
    ignoredVersion: options.config.updates?.ignoredVersion,
    fetchImpl: options.fetchImpl,
    nowMs: options.nowMs,
    cachePath: options.cachePath,
    successCacheTtlMs: updateSuccessCacheTtl(options.config),
  });
  if (result.status !== "update-available") return { status: "skipped" };

  const writeOutput = options.writeOutput ?? console.log;
  const writeError = options.writeError ?? ((line: string) => process.stderr.write(`${line}\n`));
  const plan = (options.buildInstallPlan ?? buildInstallPlan)(result);
  writeOutput(updateSummary(result, plan));

  if (plan.kind === "unsupported-install") {
    writeOutput(unsupportedMessage(plan.method));
    return { status: "continued" };
  }

  if (!(await options.confirmInstall("Install update now? [y/N] "))) {
    writeOutput("Update cancelled.");
    return { status: "continued" };
  }

  try {
    const installed = await (options.executeInstallPlan ?? executeInstallPlan)(plan);
    if (installed.stdout.length > 0) writeOutput(installed.stdout);
    if (installed.stderr.length > 0) writeError(installed.stderr);
    writeOutput(`Updated copse to ${result.latestVersion}.`);
  } catch (error) {
    if (error instanceof InstallExecutionError) {
      if (error.stderr && error.stderr.length > 0) writeError(error.stderr);
      writeError(`Error: ${error.message}`);
    } else if (error instanceof Error) {
      writeError(`Error: ${error.message}`);
    } else {
      throw error;
    }
  }

  return { status: "continued" };
}

function firstCommandArg(args: readonly string[]): string | undefined {
  for (const arg of args) {
    if (globalOptions.has(arg)) continue;
    return arg;
  }
  return undefined;
}

function updateSuccessCacheTtl(config: OmlConfig): number {
  return (config.updates?.checkIntervalHours ?? 24) * 60 * 60 * 1000;
}
