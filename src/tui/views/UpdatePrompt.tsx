import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { loadRawConfig } from "../../core/config.ts";
import {
  checkForUpdateOnLaunch,
  getUpdateStatePath,
  type InstallUpdatePlan,
  type UpdateCheckResult,
} from "../../core/updater.ts";
import { executeInstallPlan, InstallExecutionError } from "../../core/updater-execute.ts";
import { buildInstallPlan, readCurrentVersion, writeIgnoredVersion } from "../../core/updater-runtime.ts";
import { useApp } from "../context/AppContext.tsx";
import { theme } from "../themes.ts";
import { buildUpdateModalView, isUpdateModalVisible, type UpdatePromptState } from "../update-modal-state.ts";
import { PopupShell } from "./PopupShell.tsx";

type UpdateAvailableResult = Extract<UpdateCheckResult, { readonly status: "update-available" }>;
type ExecutablePlan = Exclude<InstallUpdatePlan, { readonly kind: "unsupported-install" }>;

export function UpdatePrompt() {
  const app = useApp();
  const dims = useTerminalDimensions();
  const [state, setState] = createSignal<UpdatePromptState>({ phase: "hidden" });
  let disposed = false;

  const visible = () => isUpdateModalVisible(state());
  const view = createMemo(() => buildUpdateModalView(state()));
  const dialogW = () => Math.max(20, Math.min(74, dims().width - 4));
  const bodyLines = () => view().bodyLines.flatMap((line) => fitLine(line, Math.max(dialogW() - 4, 20))).slice(0, 6);
  const dialogH = () => Math.max(10, bodyLines().length + 7);

  createEffect(() => {
    app.setShowUpdatePrompt(visible());
  });

  onCleanup(() => {
    disposed = true;
    app.setShowUpdatePrompt(false);
  });

  onMount(() => {
    void checkForUpdate();
  });

  const close = () => {
    setState({ phase: "hidden" });
  };

  const ignore = () => {
    const current = state();
    const result = resultFromState(current);
    if (result === null) {
      close();
      return;
    }
    try {
      writeIgnoredVersion(result.latestVersion);
      setState({ phase: "ignored", result });
    } catch (error) {
      setState({
        phase: "failure",
        result,
        message: error instanceof Error ? error.message : "Failed to ignore update",
      });
    }
  };

  const install = async () => {
    const current = state();
    if (current.phase !== "available" || current.plan.kind === "unsupported-install") return;
    const plan: ExecutablePlan = current.plan;
    setState({ phase: "installing", result: current.result, plan });
    try {
      const installed = await executeInstallPlan(plan);
      if (disposed) return;
      setState({
        phase: "success",
        result: current.result,
        stdout: installed.stdout,
        stderr: installed.stderr,
      });
    } catch (error) {
      if (disposed) return;
      setState({
        phase: "failure",
        result: current.result,
        message: error instanceof Error ? error.message : "Update failed",
        stderr: error instanceof InstallExecutionError ? error.stderr : undefined,
      });
    }
  };

  useKeyboard(async (event: any) => {
    if (!visible()) return;
    const current = state();
    const key = event.name;
    if (current.phase === "installing") return;
    if (current.phase === "available") {
      if (key === "escape" || key === "n") { close(); return; }
      if (key === "i") { ignore(); return; }
      if (key === "return" || key === "enter" || key === "y") { await install(); return; }
    }
    if (current.phase === "unsupported") {
      if (key === "escape") { close(); return; }
      if (key === "i") { ignore(); return; }
    }
    if (current.phase === "success" || current.phase === "failure" || current.phase === "ignored") {
      if (key === "escape" || key === "return" || key === "enter") close();
    }
  });

  return (
    <Show when={visible()}>
      <PopupShell
        width={dialogW()}
        height={dialogH()}
        title={view().title}
        borderColor={toneColor(view().tone)}
        backgroundColor={theme.bg.elevated}
        backdrop={true}
        gap={1}
        footer={(
          <box height={1} flexDirection="row" gap={2}>
            <For each={view().controls}>
              {(control) => <text fg={theme.text.secondary}>{control}</text>}
            </For>
          </box>
        )}
      >
        <box flexDirection="column" gap={0}>
          <For each={bodyLines()}>
            {(line, index) => (
              <text fg={index() === 0 ? toneColor(view().tone) : theme.text.primary}>{line}</text>
            )}
          </For>
        </box>
      </PopupShell>
    </Show>
  );

  async function checkForUpdate(): Promise<void> {
    try {
      const config = loadRawConfig();
      if (config.updates?.enabled !== true) return;
      const result = await checkForUpdateOnLaunch({
        currentVersion: readCurrentVersion(),
        ignoredVersion: config.updates?.ignoredVersion,
        cachePath: getUpdateStatePath(),
        successCacheTtlMs: (config.updates?.checkIntervalHours ?? 24) * 60 * 60 * 1000,
      });
      if (disposed || result.status !== "update-available") return;

      const plan = buildInstallPlan(result);
      setState(plan.kind === "unsupported-install"
        ? { phase: "unsupported", result, plan }
        : { phase: "available", result, plan });
    } catch {}
  }
}

function toneColor(tone: "accent" | "success" | "warning" | "error"): string {
  switch (tone) {
    case "accent":
      return theme.text.accent;
    case "success":
      return theme.text.success;
    case "warning":
      return theme.text.warning;
    case "error":
      return theme.text.error;
    default:
      return theme.text.accent;
  }
}

function fitLine(line: string, width: number): string[] {
  if (line.length <= width) return [line];
  const words = line.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current.length > 0) lines.push(current);
    current = word.length <= width ? word : `${word.slice(0, Math.max(width - 3, 1))}...`;
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function resultFromState(state: UpdatePromptState): UpdateAvailableResult | null {
  return "result" in state ? state.result ?? null : null;
}
