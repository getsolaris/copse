import { Show } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { useGit } from "../context/GitContext.tsx";
import { useTerminalDimensions } from "@opentui/solid";
import { theme } from "../themes.ts";
import { readFocus } from "../../core/focus.ts";

export function WorktreeList() {
  const app = useApp();
  const git = useGit();
  const dims = useTerminalDimensions();

  const selectedWt = () => (git.worktrees() ?? [])[app.selectedWorktreeIndex()];
  const w = () => dims().width;
  const h = () => dims().height;

  const LABEL_W = 14;

  return (
    <box x={0} y={0} width={w()} height={h()} backgroundColor={theme.bg.base}>
      <Show when={git.loading()}>
        <text x={2} y={2} fg={theme.text.secondary}>Loading worktrees...</text>
      </Show>

      <Show when={!git.loading() && !!git.error()}>
        <text x={2} y={2} fg={theme.text.error}>
          Error: {git.error()?.message}
        </text>
        <text x={2} y={3} fg={theme.text.secondary}>
          Not in a git repository?
        </text>
      </Show>

      <Show when={!git.loading() && !git.error() && !!selectedWt()}>
        <box
          x={2} y={1}
          width={w() - 3} height={h() - 3}
          flexDirection="column"
          backgroundColor={theme.bg.base}
        >
          <box height={1}>
            <text x={0} y={0} fg={theme.text.accent}>
              Worktree Details
            </text>
          </box>

          <box height={1}>
            <text x={0} y={0} fg={theme.border.subtle}>
              {"\u2500".repeat(Math.max(w() - 5, 10))}
            </text>
          </box>

          <box height={1} />

          <Show when={git.isMultiRepo()}>
            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text x={0} y={0} fg={theme.text.secondary}>Repo</text>
              </box>
              <text fg={theme.text.warning}>{selectedWt()?.repoName}</text>
            </box>
          </Show>

          <box height={1} flexDirection="row">
            <box width={LABEL_W} height={1}>
              <text x={0} y={0} fg={theme.text.secondary}>Branch</text>
            </box>
            <text fg={theme.text.accent}>{selectedWt()?.branch ?? "(detached)"}</text>
          </box>

          <box height={1} flexDirection="row">
            <box width={LABEL_W} height={1}>
              <text x={0} y={0} fg={theme.text.secondary}>Path</text>
            </box>
            <text fg={theme.text.primary}>{selectedWt()?.path}</text>
          </box>

          <box height={1} flexDirection="row">
            <box width={LABEL_W} height={1}>
              <text x={0} y={0} fg={theme.text.secondary}>Status</text>
            </box>
            <text fg={selectedWt()?.isDirty ? theme.text.error : selectedWt()?.isLocked ? theme.text.warning : theme.text.success}>
              {selectedWt()?.isLocked
                ? "\uD83D\uDD12 locked"
                : selectedWt()?.isDirty
                  ? "\u25CF dirty"
                  : "\u2713 clean"}
            </text>
          </box>

          <box height={1} flexDirection="row">
            <box width={LABEL_W} height={1}>
              <text x={0} y={0} fg={theme.text.secondary}>HEAD</text>
            </box>
            <text fg={theme.text.secondary}>{selectedWt()?.head?.slice(0, 8)}</text>
          </box>

          <Show when={(() => { const f = readFocus(selectedWt()?.path ?? ""); return f && f.length > 0; })()}>
            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text x={0} y={0} fg={theme.text.secondary}>Focus</text>
              </box>
              <text fg={theme.text.accent}>
                {readFocus(selectedWt()?.path ?? "")?.join(", ") ?? ""}
              </text>
            </box>
          </Show>

          <Show when={selectedWt()?.isMain}>
            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text x={0} y={0} fg={theme.text.secondary}>Type</text>
              </box>
              <text fg={theme.text.accent}>main worktree</text>
            </box>
          </Show>

          <box height={1} />

          <box height={1}>
            <text x={0} y={0} fg={theme.border.subtle}>
              {"\u2500".repeat(Math.max(w() - 5, 10))}
            </text>
          </box>

          <box height={1}>
            <text x={0} y={0} fg={theme.text.secondary}>
              {"d:delete  a:add  r:refresh  ^P:commands"}
            </text>
          </box>
        </box>
      </Show>

      <Show when={!git.loading() && !git.error() && !selectedWt()}>
        <text x={3} y={2} fg={theme.text.secondary}>No worktree selected.</text>
        <text x={3} y={3} fg={theme.text.accent}>{"Press 'a' to create one."}</text>
      </Show>
    </box>
  );
}
