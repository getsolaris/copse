import { For, Show } from "solid-js";
import type { CreateFocusField } from "../create-worktree-input.ts";
import { theme } from "../themes.ts";
import { PopupShell } from "./PopupShell.tsx";
import { WorktreeCreateFooter, WorktreeCreateSummary } from "./WorktreeCreateSummary.tsx";

export type StepStatus = "pending" | "running" | "done" | "error";
export type WorktreeCreateStep = "input" | "preview" | "creating" | "done" | "error";

export interface ProgressStep {
  readonly label: string;
  readonly status: StepStatus;
  readonly message?: string;
}

export interface BranchOption {
  readonly name: string;
  readonly isRemote: boolean;
  readonly lastCommitDate: string;
}

interface WorktreeCreateContentProps {
  readonly step: WorktreeCreateStep;
  readonly terminalWidth: number;
  readonly terminalHeight: number;
  readonly activeRepoName: string;
  readonly branchInput: string;
  readonly sourceBranchInput: string;
  readonly sourceFallbackBase: string | undefined;
  readonly focusInput: string;
  readonly focusField: CreateFocusField;
  readonly resolvedPath: string;
  readonly targetPath: string;
  readonly progressSteps: readonly ProgressStep[];
  readonly statusMsg: string;
  readonly filteredBranches: readonly BranchOption[];
  readonly branchPickerIdx: number;
  readonly showPicker: boolean;
  readonly onBranchInput: (value: string) => void;
  readonly onSourceBranchInput: (value: string) => void;
  readonly onFocusInput: (value: string) => void;
}

const footerLines = 4;

function dialogHeight(props: WorktreeCreateContentProps): number {
  if (props.step === "input") {
    const pickerLines = props.showPicker && props.focusField === "branch" ? props.filteredBranches.length * 2 : 0;
    const pathLines = props.branchInput.length > 0 ? 4 : 0;
    return Math.max(25 + footerLines, Math.min(25 + footerLines + pickerLines + pathLines, props.terminalHeight - 4));
  }
  if (props.step === "preview") {
    const previewLines = props.focusInput.length > 0 ? 16 : 14;
    return Math.max(14 + footerLines, Math.min(previewLines + footerLines, props.terminalHeight - 4));
  }
  if (props.step === "creating") {
    return Math.max(9 + footerLines, Math.min(props.progressSteps.length * 2 + 7 + footerLines, props.terminalHeight - 4));
  }
  if (props.step === "done") {
    const doneLines = props.focusInput.length > 0 ? 16 : 14;
    return Math.max(12 + footerLines, Math.min(doneLines + footerLines, props.terminalHeight - 4));
  }
  return Math.max(11 + footerLines, Math.min(11 + footerLines, props.terminalHeight - 4));
}

function borderColor(step: WorktreeCreateStep): string {
  if (step === "done") return theme.text.success;
  if (step === "error") return theme.text.error;
  return theme.border.active;
}

function progressColor(status: StepStatus): string {
  if (status === "done") return theme.text.success;
  if (status === "running") return theme.text.accent;
  if (status === "error") return theme.text.error;
  return theme.text.secondary;
}

function progressGlyph(status: StepStatus): string {
  if (status === "done") return "\u2713";
  if (status === "running") return "\u27F3";
  if (status === "error") return "\u2717";
  return "\u25CB";
}

export function WorktreeCreateContent(props: WorktreeCreateContentProps) {
  const dialogW = () => Math.max(50, Math.min(80, props.terminalWidth - 4));
  const contentW = () => Math.max(dialogW() - 4, 10);
  const inputFieldW = () => Math.max(contentW(), 20);

  return (
    <PopupShell
      width={dialogW()}
      height={dialogHeight(props)}
      borderColor={borderColor(props.step)}
      backgroundColor={theme.bg.surface}
      gap={1}
      title=" Create Worktree "
      backdrop
      footer={<WorktreeCreateFooter step={props.step} contentWidth={contentW()} />}
    >
      <Show when={props.step === "input"}>
        <box height={1} width={contentW()} backgroundColor={theme.bg.elevated}>
          <text x={1} y={0} fg={theme.text.accent}>{">"}</text>
          <text x={3} y={0} fg={theme.text.primary}>New Worktree</text>
          <text x={17} y={0} fg={theme.text.secondary}>{props.activeRepoName}</text>
        </box>
        <text fg={theme.border.subtle}>{"\u2500".repeat(contentW())}</text>
        <text fg={props.focusField === "branch" ? theme.text.accent : theme.text.secondary}>Branch name</text>
        <input
          value={props.branchInput}
          onInput={props.onBranchInput}
          placeholder="Branch name or search..."
          focused={props.focusField === "branch"}
          width={inputFieldW()}
          backgroundColor={theme.bg.elevated}
          cursorColor={theme.text.accent}
        />
        <Show when={props.showPicker && props.focusField === "branch" && props.filteredBranches.length > 0}>
          <For each={props.filteredBranches}>
            {(b, idx) => (
              <box height={1} width={contentW()} backgroundColor={idx() === props.branchPickerIdx ? theme.select.focusedBg : theme.bg.surface}>
                <text x={1} y={0} fg={idx() === props.branchPickerIdx ? theme.tab.active : theme.text.primary}>
                  {idx() === props.branchPickerIdx ? "\u25B8 " : "  "}{b.name}
                </text>
                <text x={Math.max(1 + b.name.length + 4, 27)} y={0} fg={theme.text.secondary}>
                  {b.isRemote ? "(remote) " : ""}{b.lastCommitDate}
                </text>
              </box>
            )}
          </For>
        </Show>
        <text fg={theme.text.secondary}>{"Tab to switch fields \u00B7 \u2191\u2193 to select branch"}</text>
        <box width="100%" height={1} flexDirection="row">
          <text fg={props.focusField === "source" ? theme.text.accent : theme.text.secondary}>{"Source branch "}</text>
          <text fg={theme.text.secondary}>{"(optional)"}</text>
        </box>
        <input
          value={props.sourceBranchInput}
          onInput={props.onSourceBranchInput}
          placeholder="main"
          focused={props.focusField === "source"}
          width={inputFieldW()}
          backgroundColor={theme.bg.elevated}
          cursorColor={theme.text.accent}
        />
        <box width="100%" height={1} flexDirection="row">
          <text fg={props.focusField === "focus" ? theme.text.accent : theme.text.secondary}>{"Focus "}</text>
          <text fg={theme.text.secondary}>{"(optional)"}</text>
        </box>
        <input
          value={props.focusInput}
          onInput={props.onFocusInput}
          placeholder="apps/web,apps/api (optional)"
          focused={props.focusField === "focus"}
          width={inputFieldW()}
          backgroundColor={theme.bg.elevated}
          cursorColor={theme.text.accent}
        />
        <text fg={theme.text.secondary}>{"comma-separated paths, e.g. apps/web,apps/api"}</text>
        <Show when={props.branchInput.length > 0}>
          <text fg={theme.text.secondary}>Target path</text>
          <text fg={theme.text.primary}>{props.targetPath}</text>
        </Show>
        <text fg={theme.text.primary}>Type a branch name, e.g. feature/my-feature</text>
      </Show>
      <Show when={props.step === "preview"}>
        <WorktreeCreateSummary title="Confirm Worktree" branch={props.branchInput} source={props.sourceBranchInput} sourceFallback={props.sourceFallbackBase} path={props.resolvedPath} focus={props.focusInput} />
        <text fg={theme.text.success}>{"\u2713 Ready to create. Press Enter to confirm."}</text>
      </Show>
      <Show when={props.step === "creating"}>
        <box height={1} width={contentW()} backgroundColor={theme.bg.elevated}>
          <text x={1} y={0} fg={theme.text.accent}>{">"}</text>
          <text x={3} y={0} fg={theme.text.primary}>Creating Worktree</text>
        </box>
        <text fg={theme.border.subtle}>{"\u2500".repeat(contentW())}</text>
        <For each={props.progressSteps}>
          {(progressStep) => (
            <box height={1}>
              <text fg={progressColor(progressStep.status)}>{progressGlyph(progressStep.status)}{" "}{progressStep.label}</text>
              <Show when={progressStep.message}>
                <text x={progressStep.label.length + 4} y={0} fg={theme.text.secondary}>{progressStep.message}</text>
              </Show>
            </box>
          )}
        </For>
      </Show>
      <Show when={props.step === "done"}>
        <WorktreeCreateSummary title="Worktree Created" branch={props.branchInput} source={props.sourceBranchInput} sourceFallback={props.sourceFallbackBase} path={props.resolvedPath} focus={props.focusInput} done />
        <text fg={theme.text.success}>{"\u2713 "}{props.statusMsg}</text>
      </Show>
      <Show when={props.step === "error"}>
        <box height={1} width={contentW()} backgroundColor={theme.bg.elevated}>
          <text x={1} y={0} fg={theme.text.error}>{">"}</text>
          <text x={3} y={0} fg={theme.text.primary}>Error</text>
        </box>
        <text fg={theme.border.subtle}>{"\u2500".repeat(contentW())}</text>
        <text fg={theme.text.error}>{"\u2717 Failed"}</text>
        <box width={inputFieldW()} height={1} backgroundColor={theme.bg.elevated}>
          <text x={1} y={0} fg={theme.text.primary}>{props.statusMsg.slice(0, Math.max(inputFieldW() - 3, 10))}</text>
        </box>
        <text fg={theme.text.secondary}>Press Enter or Escape to try again</text>
      </Show>
    </PopupShell>
  );
}
