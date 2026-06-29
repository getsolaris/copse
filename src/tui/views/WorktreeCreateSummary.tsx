import { Show } from "solid-js";
import { formatCreateSourceBase } from "../create-worktree-input.ts";
import { theme } from "../themes.ts";
import type { WorktreeCreateStep } from "./WorktreeCreateContent.tsx";

export function WorktreeCreateFooter(props: { readonly step: WorktreeCreateStep; readonly contentWidth: number }) {
  return (
    <>
      <box height={1} width={props.contentWidth}>
        <text fg={theme.border.subtle}>{"\u2500".repeat(Math.max(props.contentWidth, 1))}</text>
      </box>
      <Show when={props.step === "input"}>
        <box flexDirection="row" gap={2}>
          <text fg={theme.text.secondary}>{"Tab:switch"}</text>
          <text fg={theme.text.secondary}>{"\u2191\u2193:pick"}</text>
          <text fg={theme.text.secondary}>{"Enter:confirm"}</text>
          <text fg={theme.text.secondary}>{"Esc:cancel"}</text>
        </box>
      </Show>
      <Show when={props.step === "preview"}>
        <box flexDirection="row" gap={2}>
          <text fg={theme.text.secondary}>{"Enter:create"}</text>
          <text fg={theme.text.secondary}>{"Esc:back"}</text>
        </box>
      </Show>
      <Show when={props.step === "creating"}><text fg={theme.text.secondary}>Creating worktree...</text></Show>
      <Show when={props.step === "done"}><text fg={theme.text.secondary}>{"\u2713 Done — returning to list"}</text></Show>
      <Show when={props.step === "error"}>
        <box flexDirection="row" gap={2}>
          <text fg={theme.text.secondary}>{"Enter:retry"}</text>
          <text fg={theme.text.secondary}>{"Esc:back"}</text>
        </box>
      </Show>
    </>
  );
}

export function WorktreeCreateSummary(props: { readonly title: string; readonly branch: string; readonly source: string; readonly sourceFallback: string | undefined; readonly path: string; readonly focus: string; readonly done?: boolean }) {
  const markerColor = props.done ? theme.text.success : theme.text.accent;

  return (
    <>
      <box height={1} width="100%" backgroundColor={theme.bg.elevated}>
        <text x={1} y={0} fg={markerColor}>{">"}</text>
        <text x={3} y={0} fg={theme.text.primary}>{props.title}</text>
      </box>
      <text fg={theme.border.subtle}>{"\u2500".repeat(76)}</text>
      <SummaryRow label="Branch" value={props.branch} accent />
      <SummaryRow label="Source" value={formatCreateSourceBase(props.source, props.sourceFallback)} accent />
      <SummaryRow label="Path" value={props.path} />
      <Show when={props.focus.length > 0}><SummaryRow label="Focus" value={props.focus} accent /></Show>
    </>
  );
}

function SummaryRow(props: { readonly label: string; readonly value: string; readonly accent?: boolean }) {
  return (
    <box height={1} flexDirection="row">
      <box width={14} height={1}><text fg={theme.text.secondary}>{props.label}</text></box>
      <text fg={props.accent ? theme.text.accent : theme.text.primary}>{props.value}</text>
    </box>
  );
}
