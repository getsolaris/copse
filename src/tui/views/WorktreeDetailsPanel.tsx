import { Show } from "solid-js";
import { theme } from "../themes.ts";
import type { SessionInfo } from "../../core/session.ts";
import type { Worktree } from "../../core/types.ts";

export interface WorktreeExtra {
  readonly aheadBehind: { readonly ahead: number; readonly behind: number };
  readonly lastCommit: { readonly hash: string; readonly message: string; readonly relativeDate: string } | null;
  readonly dirtyCount: number;
}

export interface SelectedMetadata {
  readonly focus: string[] | null;
  readonly session: SessionInfo | null;
}

interface WorktreeDetailsPanelProps {
  readonly worktree: Worktree;
  readonly isMultiRepo: boolean;
  readonly width: number;
  readonly extra: WorktreeExtra | null;
  readonly extraLoading: boolean;
  readonly extraError: string;
  readonly selectedMetadata: SelectedMetadata;
  readonly statusLabel: string;
  readonly syncLabel: string;
}

const LABEL_W = 14;

export function WorktreeDetailsPanel(props: WorktreeDetailsPanelProps) {
  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={theme.bg.surface}
      paddingX={2}
      paddingY={1}
    >
      <box height={1} flexDirection="row">
        <text fg={theme.text.accent}>
          Worktree Details
        </text>
      </box>

      <box height={1}>
        <text fg={theme.border.subtle}>
          {"\u2500".repeat(Math.max(props.width - 38, 10))}
        </text>
      </box>

      <Show when={props.isMultiRepo}>
        <box height={1} flexDirection="row">
          <box width={LABEL_W} height={1}>
            <text fg={theme.text.secondary}>Repo</text>
          </box>
          <text fg={theme.text.warning}>{props.worktree.repoName}</text>
        </box>
      </Show>

      <box height={1} flexDirection="row">
        <box width={LABEL_W} height={1}>
          <text fg={theme.text.secondary}>Branch</text>
        </box>
        <text fg={theme.text.accent}>{props.worktree.branch ?? "(detached)"}</text>
      </box>

      <box height={1} flexDirection="row">
        <box width={LABEL_W} height={1}>
          <text fg={theme.text.secondary}>Path</text>
        </box>
        <text fg={theme.text.primary}>{props.worktree.path}</text>
      </box>

      <box height={1} flexDirection="row">
        <box width={LABEL_W} height={1}>
          <text fg={theme.text.secondary}>Status</text>
        </box>
        <text fg={props.worktree.isDirty ? theme.text.error : props.worktree.isLocked ? theme.text.warning : theme.text.success}>
          {props.statusLabel}
        </text>
      </box>

      <box height={1} flexDirection="row">
        <box width={LABEL_W} height={1}>
          <text fg={theme.text.secondary}>Sync</text>
        </box>
        <text fg={
          props.extraError
            ? theme.text.error
            : props.extraLoading
              ? theme.text.secondary
              : props.extra?.aheadBehind?.ahead || props.extra?.aheadBehind?.behind
            ? theme.text.warning
            : theme.text.success
        }>
          {props.syncLabel}
        </text>
      </box>

      <box height={1} flexDirection="row">
        <box width={LABEL_W} height={1}>
          <text fg={theme.text.secondary}>HEAD</text>
        </box>
        <text fg={theme.text.secondary}>{props.worktree.head.slice(0, 8)}</text>
      </box>

      <Show when={props.extra?.lastCommit}>
        <box height={1} flexDirection="row">
          <box width={LABEL_W} height={1}>
            <text fg={theme.text.secondary}>Last Commit</text>
          </box>
          <text fg={theme.text.primary}>
            {props.extra?.lastCommit?.relativeDate}
          </text>
        </box>
        <box height={1} flexDirection="row">
          <box width={LABEL_W} height={1}>
            <text fg={theme.text.secondary}>{""}</text>
          </box>
          <text fg={theme.text.secondary}>
            {(props.extra?.lastCommit?.message.length ?? 0) > 50
              ? `${props.extra?.lastCommit?.message.slice(0, 47)}...`
              : props.extra?.lastCommit?.message}
          </text>
        </box>
      </Show>

      <Show when={(props.selectedMetadata.focus?.length ?? 0) > 0}>
        <box height={1} flexDirection="row">
          <box width={LABEL_W} height={1}>
            <text fg={theme.text.secondary}>Focus</text>
          </box>
          <text fg={theme.text.accent}>
            {props.selectedMetadata.focus?.join(", ") ?? ""}
          </text>
        </box>
      </Show>

      <Show when={props.selectedMetadata.session}>
        <box height={1} flexDirection="row">
          <box width={LABEL_W} height={1}>
            <text fg={theme.text.secondary}>Session</text>
          </box>
          <text fg={theme.text.accent}>
            {props.selectedMetadata.session?.layout
              ? `${props.selectedMetadata.session.name} [${props.selectedMetadata.session.layout}]`
              : props.selectedMetadata.session?.name}
          </text>
        </box>
      </Show>

      <Show when={props.worktree.isMain}>
        <box height={1} flexDirection="row">
          <box width={LABEL_W} height={1}>
            <text fg={theme.text.secondary}>Type</text>
          </box>
          <text fg={theme.text.accent}>main worktree</text>
        </box>
      </Show>

      <box height={1}>
        <text fg={theme.border.subtle}>
          {"\u2500".repeat(Math.max(props.width - 38, 10))}
        </text>
      </box>

      <box height={1} flexDirection="row" gap={2}>
        <text fg={theme.text.secondary}>{"Enter:detail"}</text>
        <text fg={theme.text.secondary}>{"d:delete"}</text>
        <text fg={theme.text.secondary}>{"a:add"}</text>
        <text fg={theme.text.secondary}>{"o:folder"}</text>
        <text fg={theme.text.secondary}>{"t:terminal"}</text>
        <text fg={theme.text.secondary}>{"r:refresh"}</text>
        <text fg={theme.text.secondary}>{"^P:commands"}</text>
      </box>
    </box>
  );
}
