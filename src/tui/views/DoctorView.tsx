import { createSignal, For, Show } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { runAllChecks, runFixes, type DoctorCheckResult, type DoctorReport, type FixResult } from "../../core/doctor.ts";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { theme } from "../themes.ts";
import { PopupShell } from "./PopupShell.tsx";

export function DoctorView() {
  const app = useApp();
  const dims = useTerminalDimensions();
  const [report, setReport] = createSignal<DoctorReport | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");
  const [fixing, setFixing] = createSignal(false);
  const [fixResults, setFixResults] = createSignal<FixResult[]>([]);

  const runChecks = async () => {
    setLoading(true);
    setError("");
    setFixResults([]);
    try {
      const result = await runAllChecks();
      setReport(result);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  const runAutoFix = async () => {
    if (report()?.healthy) return;
    setFixing(true);
    try {
      const results = await runFixes();
      setFixResults(results);
      const recheckResult = await runAllChecks();
      setReport(recheckResult);
    } catch (err) {
      setError((err as Error).message);
    }
    setFixing(false);
  };

  runChecks();

  useKeyboard((event: any) => {
    if (app.activeTab() !== "doctor") return;
    if (app.showCommandPalette()) return;
    const key = event.name;
    if (key === "r") runChecks();
    if (key === "f" && !loading() && !fixing() && !report()?.healthy) runAutoFix();
  });

  const w = () => dims().width;
  const h = () => dims().height;
  const dialogW = () => Math.max(50, Math.min(80, w() - 4));
  const dialogH = () => {
    const lines = checksLen() + fixLen() + 8 + (fixLen() > 0 ? 2 : 0);
    return Math.max(12, Math.min(lines, h() - 4));
  };
  const contentW = () => Math.max(dialogW() - 4, 10);

  const statusIcon = (status: string) => {
    if (status === "pass") return "\u2713";
    if (status === "warn") return "\u26A0";
    return "\u2717";
  };

  const statusColor = (status: string) => {
    if (status === "pass") return theme.text.success;
    if (status === "warn") return theme.text.warning;
    return theme.text.error;
  };

  const checksLen = () => report()?.checks.length ?? 0;
  const fixLen = () => fixResults().length;

  return (
    <PopupShell
      width={dialogW()}
      height={dialogH()}
      borderColor={report()?.healthy ? theme.text.success : report() ? theme.text.warning : theme.border.default}
      backgroundColor={theme.bg.surface}
      title=" Doctor "
      footer={(
        <>
          <box height={1} width={contentW()}>
            <text fg={theme.border.subtle}>
              {"\u2500".repeat(Math.max(contentW(), 1))}
            </text>
          </box>
          <box flexDirection="row" gap={2}>
            <text fg={theme.text.secondary}>{"r:recheck"}</text>
            <Show when={!report()?.healthy}>
              <text fg={theme.text.secondary}>{"f:fix"}</text>
            </Show>
            <text fg={theme.text.secondary}>{"Esc:back"}</text>
          </box>
        </>
      )}
    >
      <Show when={loading()}>
        <text fg={theme.text.secondary}>Running health checks...</text>
      </Show>

      <Show when={fixing()}>
        <text fg={theme.text.accent}>Running auto-fix...</text>
      </Show>

      <Show when={!loading() && !fixing() && !!error()}>
        <text fg={theme.text.error}>Error: {error()}</text>
      </Show>

      <Show when={!loading() && !fixing() && !error() && !!report()}>
        <text fg={theme.text.accent}>Health Checks</text>
        <text fg={theme.border.subtle}>{"\u2500".repeat(contentW())}</text>

        <For each={report()!.checks}>
          {(check: DoctorCheckResult) => {
            return (
              <box width="100%" height={1} flexDirection="row">
                <text fg={statusColor(check.status)}>
                  {statusIcon(check.status)}
                </text>
                <text x={2} y={0} fg={theme.text.primary}>
                  {check.name}:
                </text>
                <text x={check.name.length + 4} y={0} fg={theme.text.secondary}>
                  {check.message}
                </text>
              </box>
            );
          }}
        </For>

        <text fg={theme.border.subtle}>{"\u2500".repeat(contentW())}</text>
        <text
          fg={report()!.healthy ? theme.text.success : theme.text.warning}
        >
          {report()!.healthy
            ? "\u2713 All checks passed"
            : `${report()!.checks.filter((c: DoctorCheckResult) => c.status === "fail").length} error(s), ${report()!.checks.filter((c: DoctorCheckResult) => c.status === "warn").length} warning(s) found`}
        </text>

        <Show when={fixLen() > 0}>
          <text fg={theme.text.accent}>Fix Results</text>
          <text fg={theme.border.subtle}>{"\u2500".repeat(contentW())}</text>
          <For each={fixResults()}>
            {(fix: FixResult) => {
              return (
                <box width="100%" height={1} flexDirection="row">
                  <text fg={fix.success ? theme.text.success : theme.text.error}>
                    {fix.success ? "\u2713" : "\u2717"}
                  </text>
                  <text x={2} y={0} fg={theme.text.primary}>
                    {fix.action}
                  </text>
                  <Show when={!!fix.detail}>
                    <text x={fix.action.length + 3} y={0} fg={theme.text.secondary}>
                      ({fix.detail})
                    </text>
                  </Show>
                </box>
              );
            }}
          </For>
        </Show>
      </Show>
    </PopupShell>
  );
}
