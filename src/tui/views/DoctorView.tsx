import { createSignal, For, Show } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { runAllChecks, runFixes, type DoctorCheckResult, type DoctorReport, type FixResult } from "../../core/doctor.ts";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { theme } from "../themes.ts";

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
    const key = event.name;
    if (key === "r") runChecks();
    if (key === "f" && !loading() && !fixing() && !report()?.healthy) runAutoFix();
  });

  const w = () => dims().width;
  const h = () => dims().height;

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
    <box x={0} y={0} width={w()} height={h()} backgroundColor={theme.bg.base}>
      <box
        x={1} y={0}
        width={w() - 2} height={h() - 3}
        border={true} borderStyle="single"
        borderColor={report()?.healthy ? theme.text.success : report() ? theme.text.warning : theme.border.default}
        backgroundColor={theme.bg.surface}
        title=" Doctor "
        titleAlignment="left"
      >
        <Show when={loading()}>
          <text x={3} y={2} fg={theme.text.secondary}>Running health checks...</text>
        </Show>

        <Show when={fixing()}>
          <text x={3} y={2} fg={theme.text.accent}>Running auto-fix...</text>
        </Show>

        <Show when={!loading() && !fixing() && !!error()}>
          <text x={3} y={2} fg={theme.text.error}>Error: {error()}</text>
        </Show>

        <Show when={!loading() && !fixing() && !error() && !!report()}>
          <text x={3} y={1} fg={theme.text.accent}>Health Checks</text>
          <text x={3} y={2} fg={theme.border.subtle}>
            {"\u2500".repeat(Math.max(w() - 10, 10))}
          </text>

          <For each={report()!.checks}>
            {(check: DoctorCheckResult, i) => {
              const y = () => 4 + i();
              return (
                <box x={3} y={y()} width={w() - 8} height={1}>
                  <text x={0} y={0} fg={statusColor(check.status)}>
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

          <text x={3} y={4 + checksLen()} fg={theme.border.subtle}>
            {"\u2500".repeat(Math.max(w() - 10, 10))}
          </text>
          <text
            x={3}
            y={5 + checksLen()}
            fg={report()!.healthy ? theme.text.success : theme.text.warning}
          >
            {report()!.healthy
              ? "\u2713 All checks passed"
              : `${report()!.checks.filter((c: DoctorCheckResult) => c.status === "fail").length} error(s), ${report()!.checks.filter((c: DoctorCheckResult) => c.status === "warn").length} warning(s) found`}
          </text>

          <Show when={fixLen() > 0}>
            <text x={3} y={7 + checksLen()} fg={theme.text.accent}>Fix Results</text>
            <text x={3} y={8 + checksLen()} fg={theme.border.subtle}>
              {"\u2500".repeat(Math.max(w() - 10, 10))}
            </text>
            <For each={fixResults()}>
              {(fix: FixResult, i) => {
                const y = () => 9 + checksLen() + i();
                return (
                  <box x={3} y={y()} width={w() - 8} height={1}>
                    <text x={0} y={0} fg={fix.success ? theme.text.success : theme.text.error}>
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
      </box>

      <box x={1} y={h() - 3} width={w() - 2} height={1} backgroundColor={theme.bg.base}>
        <text x={1} y={0} fg={theme.text.secondary}>r</text>
        <text x={2} y={0} fg={theme.text.primary}>{":recheck  "}</text>
        <Show when={!report()?.healthy}>
          <text x={12} y={0} fg={theme.text.secondary}>f</text>
          <text x={13} y={0} fg={theme.text.primary}>{":fix  "}</text>
        </Show>
        <text x={report()?.healthy ? 12 : 19} y={0} fg={theme.text.secondary}>Esc</text>
        <text x={report()?.healthy ? 16 : 23} y={0} fg={theme.text.primary}>:back</text>
      </box>
    </box>
  );
}
