import { createSignal, For, Show } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { runAllChecks, type DoctorCheckResult, type DoctorReport } from "../../core/doctor.ts";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { theme } from "../themes.ts";

export function DoctorView() {
  const app = useApp();
  const dims = useTerminalDimensions();
  const [report, setReport] = createSignal<DoctorReport | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");

  const runChecks = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await runAllChecks();
      setReport(result);
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  runChecks();

  useKeyboard((event: any) => {
    if (app.activeTab() !== "doctor") return;
    const key = event.name;
    if (key === "r") {
      runChecks();
    }
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

        <Show when={!loading() && !!error()}>
          <text x={3} y={2} fg={theme.text.error}>Error: {error()}</text>
        </Show>

        <Show when={!loading() && !error() && !!report()}>
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

          <text x={3} y={4 + (report()!.checks.length)} fg={theme.border.subtle}>
            {"\u2500".repeat(Math.max(w() - 10, 10))}
          </text>
          <text
            x={3}
            y={5 + (report()!.checks.length)}
            fg={report()!.healthy ? theme.text.success : theme.text.warning}
          >
            {report()!.healthy
              ? "\u2713 All checks passed"
              : `${report()!.checks.filter((c: DoctorCheckResult) => c.status === "fail").length} error(s), ${report()!.checks.filter((c: DoctorCheckResult) => c.status === "warn").length} warning(s) found`}
          </text>
        </Show>
      </box>

      <box x={1} y={h() - 3} width={w() - 2} height={1} backgroundColor={theme.bg.base}>
        <text x={1} y={0} fg={theme.text.secondary}>r</text>
        <text x={2} y={0} fg={theme.text.primary}>{":recheck  "}</text>
        <text x={12} y={0} fg={theme.text.secondary}>Esc</text>
        <text x={16} y={0} fg={theme.text.primary}>:back</text>
      </box>
    </box>
  );
}
