import type { InstallUpdatePlan, UpdateCheckResult } from "../../core/updater.ts";

export interface UpdateJsonStatus {
  readonly status: string;
  readonly currentVersion?: string;
  readonly latestVersion?: string;
  readonly releaseUrl?: string;
  readonly installMethod?: string;
  readonly reason?: string;
  readonly message?: string;
  readonly stdout?: string;
  readonly stderr?: string;
}

export function updateAvailableStatus(
  result: Extract<UpdateCheckResult, { readonly status: "update-available" }>,
  plan: InstallUpdatePlan,
): UpdateJsonStatus {
  return {
    status: "update-available",
    currentVersion: result.currentVersion,
    latestVersion: result.latestVersion,
    releaseUrl: result.releaseUrl,
    installMethod: plan.method,
    ...(plan.kind === "unsupported-install" ? { reason: plan.reason, message: unsupportedMessage(plan.method) } : {}),
  };
}

export function resultToJson(result: UpdateCheckResult): UpdateJsonStatus {
  switch (result.status) {
    case "up-to-date":
      return {
        status: result.status,
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        message: `Copse is up to date (${result.currentVersion}).`,
      };
    case "ignored-version":
      return {
        status: result.status,
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        message: `Copse ${result.ignoredVersion} is ignored.`,
      };
    case "check-failed":
      return { status: result.status, reason: result.reason, message: result.message };
    case "update-available":
      return {
        status: result.status,
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        releaseUrl: result.releaseUrl,
      };
    default:
      return assertNever(result);
  }
}

export function printStatus(status: UpdateJsonStatus, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  if (status.stdout && status.stdout.length > 0) console.log(status.stdout);
  if (status.status === "updated") {
    console.log(`Updated copse to ${status.latestVersion}.`);
    return;
  }
  if (status.status === "update-available") {
    console.log(`Update available: ${status.currentVersion} -> ${status.latestVersion}`);
    if (status.installMethod) console.log(`Install method: ${status.installMethod}`);
    if (status.message) console.log(status.message);
    return;
  }
  if (status.message) {
    console.log(status.message);
    return;
  }
  console.log(status.status);
}

export function printNonInteractiveUpdate(result: Extract<UpdateCheckResult, { readonly status: "update-available" }>): void {
  console.log(`Update available: ${result.currentVersion} -> ${result.latestVersion}`);
  console.log("Run copse update --yes to install, or copse update --ignore to skip this version.");
}

export function updateSummary(
  result: Extract<UpdateCheckResult, { readonly status: "update-available" }>,
  plan: InstallUpdatePlan,
): string {
  return `Update available: ${result.currentVersion} -> ${result.latestVersion}\nInstall method: ${plan.method}`;
}

export function unsupportedMessage(method: "standalone" | "source"): string {
  return method === "source"
    ? "Source checkouts are not overwritten. Update with git pull or reinstall copse."
    : "Standalone update requires a copse.js release asset with a sha256 digest.";
}

function assertNever(value: never): never {
  throw new Error(`unhandled update result: ${String(value)}`);
}
