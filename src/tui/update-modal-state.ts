import type { InstallUpdatePlan, UpdateCheckResult } from "../core/updater.ts";

type UpdateAvailableResult = Extract<UpdateCheckResult, { readonly status: "update-available" }>;
type UnsupportedPlan = Extract<InstallUpdatePlan, { readonly kind: "unsupported-install" }>;
type Tone = "accent" | "success" | "warning" | "error";

export type UpdatePromptState =
  | { readonly phase: "hidden" }
  | { readonly phase: "available"; readonly result: UpdateAvailableResult; readonly plan: InstallUpdatePlan }
  | { readonly phase: "installing"; readonly result: UpdateAvailableResult; readonly plan: Exclude<InstallUpdatePlan, UnsupportedPlan> }
  | { readonly phase: "success"; readonly result: UpdateAvailableResult; readonly stdout: string; readonly stderr: string }
  | { readonly phase: "failure"; readonly result?: UpdateAvailableResult; readonly message: string; readonly stderr?: string }
  | { readonly phase: "unsupported"; readonly result: UpdateAvailableResult; readonly plan: UnsupportedPlan }
  | { readonly phase: "ignored"; readonly result: UpdateAvailableResult };

export interface UpdateModalView {
  readonly title: string;
  readonly tone: Tone;
  readonly bodyLines: readonly string[];
  readonly controls: readonly string[];
}

export function isUpdateModalVisible(state: UpdatePromptState): boolean {
  return state.phase !== "hidden";
}

export function buildUpdateModalView(state: UpdatePromptState): UpdateModalView {
  switch (state.phase) {
    case "hidden":
      return { title: "", tone: "accent", bodyLines: [], controls: [] };
    case "available":
      return {
        title: " Update Available ",
        tone: "accent",
        bodyLines: [
          `Current: ${state.result.currentVersion}`,
          `Latest:  ${state.result.latestVersion}`,
          `Method:  ${state.plan.method}`,
        ],
        controls: ["Enter:install", "i:ignore", "Esc:cancel"],
      };
    case "installing":
      return {
        title: " Updating Copse ",
        tone: "warning",
        bodyLines: [
          "Installing update...",
          `Target: ${state.result.latestVersion}`,
        ],
        controls: [],
      };
    case "success":
      return {
        title: " Update Complete ",
        tone: "success",
        bodyLines: [
          `Updated copse to ${state.result.latestVersion}.`,
          ...nonEmptyLines(state.stdout),
          ...nonEmptyLines(state.stderr),
        ],
        controls: ["Enter:close", "Esc:close"],
      };
    case "failure":
      return {
        title: " Update Failed ",
        tone: "error",
        bodyLines: [
          state.message,
          ...nonEmptyLines(state.stderr ?? ""),
        ],
        controls: ["Enter:close", "Esc:close"],
      };
    case "unsupported":
      return {
        title: " Update Available ",
        tone: "warning",
        bodyLines: [
          `Current: ${state.result.currentVersion}`,
          `Latest:  ${state.result.latestVersion}`,
          unsupportedMessage(state.plan),
        ],
        controls: ["i:ignore", "Esc:close"],
      };
    case "ignored":
      return {
        title: " Update Ignored ",
        tone: "success",
        bodyLines: [`Ignored copse ${state.result.latestVersion}.`],
        controls: ["Enter:close", "Esc:close"],
      };
    default:
      return assertNever(state);
  }
}

function unsupportedMessage(plan: UnsupportedPlan): string {
  return plan.method === "source"
    ? "Source checkouts are not overwritten. Update with git pull or reinstall copse."
    : "Standalone update requires a copse.js release asset with a sha256 digest.";
}

function nonEmptyLines(value: string): string[] {
  return value.length === 0 ? [] : value.split(/\r?\n/).filter((line) => line.length > 0);
}

function assertNever(value: never): never {
  throw new Error(`unhandled update modal state: ${String(value)}`);
}
