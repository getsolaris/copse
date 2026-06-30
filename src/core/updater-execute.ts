import { createHash, randomUUID } from "crypto";
import { chmodSync, existsSync, renameSync, statSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { InstallMethod, InstallUpdatePlan } from "./updater-install.ts";

type ExecutableInstallPlan = Exclude<InstallUpdatePlan, { readonly kind: "unsupported-install" }>;

export interface InstallCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface ExecuteInstallPlanOptions {
  readonly runCommand?: (command: readonly string[]) => Promise<InstallCommandResult>;
  readonly download?: (url: string) => Promise<Uint8Array>;
}

export interface InstallExecutionResult {
  readonly status: "updated";
  readonly method: InstallMethod;
  readonly stdout: string;
  readonly stderr: string;
}

export class InstallExecutionError extends Error {
  readonly name = "InstallExecutionError";
  readonly exitCode: number | undefined;
  readonly stderr: string | undefined;

  constructor(message: string, details: { readonly exitCode?: number; readonly stderr?: string } = {}) {
    super(message);
    this.exitCode = details.exitCode;
    this.stderr = details.stderr;
  }
}

export async function executeInstallPlan(
  plan: ExecutableInstallPlan,
  options: ExecuteInstallPlanOptions = {},
): Promise<InstallExecutionResult> {
  switch (plan.kind) {
    case "command":
      return executeCommandPlan(plan.method, plan.command, options.runCommand ?? runCommand);
    case "standalone":
      await executeStandalonePlan(plan, options.download ?? downloadBytes);
      return { status: "updated", method: "standalone", stdout: "", stderr: "" };
    default:
      return assertNever(plan);
  }
}

async function executeCommandPlan(
  method: InstallMethod,
  command: readonly string[],
  run: (command: readonly string[]) => Promise<InstallCommandResult>,
): Promise<InstallExecutionResult> {
  const result = await run(command);
  if (result.exitCode !== 0) {
    throw new InstallExecutionError(`update command failed with exit code ${result.exitCode}`, {
      exitCode: result.exitCode,
      stderr: result.stderr,
    });
  }
  return { status: "updated", method, stdout: result.stdout, stderr: result.stderr };
}

async function runCommand(command: readonly string[]): Promise<InstallCommandResult> {
  const proc = (Bun as any).spawn([...command], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), exitCode };
}

async function executeStandalonePlan(
  plan: Extract<ExecutableInstallPlan, { readonly kind: "standalone" }>,
  download: (url: string) => Promise<Uint8Array>,
): Promise<void> {
  const bytes = await download(plan.downloadUrl);
  verifyDigest(bytes, plan.digest);
  const mode = statSync(plan.preserveModeFrom).mode & 0o777;
  const tmpPath = join(dirname(plan.targetPath), `.copse-update-${randomUUID()}.tmp`);
  try {
    writeFileSync(tmpPath, bytes, { mode });
    chmodSync(tmpPath, mode);
    renameSync(tmpPath, plan.targetPath);
  } catch (error) {
    removeIfExists(tmpPath);
    if (error instanceof Error) throw error;
    throw new InstallExecutionError("standalone replacement failed");
  }
}

function verifyDigest(bytes: Uint8Array, digest: string): void {
  const actual = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (actual !== digest) {
    throw new InstallExecutionError(`digest mismatch: expected ${digest}, got ${actual}`);
  }
}

async function downloadBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new InstallExecutionError(`download failed with HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function removeIfExists(path: string): void {
  if (existsSync(path)) unlinkSync(path);
}

function assertNever(value: never): never {
  throw new InstallExecutionError(`unsupported install plan: ${String(value)}`);
}
