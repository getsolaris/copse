import { describe, expect, it } from "bun:test";
import type { InstallUpdatePlan, UpdateCheckResult } from "../core/updater.ts";
import { buildUpdateModalView, isUpdateModalVisible, type UpdatePromptState } from "./update-modal-state.ts";

type UpdateAvailableResult = Extract<UpdateCheckResult, { readonly status: "update-available" }>;

const result: UpdateAvailableResult = {
  status: "update-available",
  currentVersion: "1.3.1",
  latestVersion: "9.9.9",
  releaseUrl: "https://github.com/getsolaris/copse/releases/tag/v9.9.9",
  source: "network",
};

const commandPlan: InstallUpdatePlan = {
  kind: "command",
  method: "npm",
  command: ["npm", "install", "-g", "@getsolaris/copse@9.9.9"],
};

const unsupportedPlan: InstallUpdatePlan = {
  kind: "unsupported-install",
  method: "source",
  reason: "source-checkout",
};

describe("update prompt modal state", () => {
  it("builds the available view with install cancel and ignore controls", () => {
    const view = buildUpdateModalView({ phase: "available", result, plan: commandPlan });

    expect(view.title).toBe(" Update Available ");
    expect(view.tone).toBe("accent");
    expect(view.bodyLines.join("\n")).toContain("Current: 1.3.1");
    expect(view.bodyLines.join("\n")).toContain("Latest:  9.9.9");
    expect(view.controls).toEqual(["Enter:install", "i:ignore", "Esc:cancel"]);
  });

  it("builds visible progress success failure and unsupported states", () => {
    const states: readonly UpdatePromptState[] = [
      { phase: "installing", result, plan: commandPlan },
      { phase: "success", result, stdout: "update-ok", stderr: "" },
      { phase: "failure", result, message: "update failed", stderr: "boom" },
      { phase: "unsupported", result, plan: unsupportedPlan },
    ];

    const views = states.map(buildUpdateModalView);

    expect(views[0]?.bodyLines.join("\n")).toContain("Installing update...");
    expect(views[1]?.bodyLines.join("\n")).toContain("Updated copse to 9.9.9.");
    expect(views[1]?.bodyLines.join("\n")).toContain("update-ok");
    expect(views[2]?.tone).toBe("error");
    expect(views[2]?.bodyLines.join("\n")).toContain("boom");
    expect(views[3]?.tone).toBe("warning");
    expect(views[3]?.bodyLines.join("\n")).toContain("Source checkouts are not overwritten.");
    expect(views[3]?.controls).toEqual(["i:ignore", "Esc:close"]);
  });

  it("reports hidden visibility and ignored completion", () => {
    expect(isUpdateModalVisible({ phase: "hidden" })).toBe(false);

    const ignored = buildUpdateModalView({ phase: "ignored", result });

    expect(isUpdateModalVisible({ phase: "ignored", result })).toBe(true);
    expect(ignored.tone).toBe("success");
    expect(ignored.bodyLines.join("\n")).toContain("Ignored copse 9.9.9.");
    expect(ignored.controls).toEqual(["Enter:close", "Esc:close"]);
  });
});
