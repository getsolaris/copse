import { Show, createSignal, createEffect, on, onCleanup } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { useGit } from "../context/GitContext.tsx";
import { useTerminalDimensions } from "@opentui/solid";
import { theme } from "../themes.ts";
import { readFocus } from "../../core/focus.ts";
import { GitWorktree } from "../../core/git.ts";

interface WorktreeExtra {
  aheadBehind: { ahead: number; behind: number };
  lastCommit: { hash: string; message: string; relativeDate: string } | null;
  dirtyCount: number;
}

const DEBOUNCE_MS = 150;

export function WorktreeList() {
  const app = useApp();
  const git = useGit();
  const dims = useTerminalDimensions();

  const selectedWt = () => (git.worktrees() ?? [])[app.selectedWorktreeIndex()];
  const w = () => dims().width;
  const h = () => dims().height;

  const LABEL_W = 14;

  const [extra, setExtra] = createSignal<WorktreeExtra | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  createEffect(
    on(
      () => selectedWt()?.path,
      (path) => {
        if (debounceTimer) clearTimeout(debounceTimer);

        if (!path) {
          setExtra(null);
          return;
        }

        debounceTimer = setTimeout(async () => {
          const wt = selectedWt();
          if (!wt || wt.path !== path) return;

          const [aheadBehind, lastCommit, dirtyCount] = await Promise.all([
            wt.branch
              ? GitWorktree.getAheadBehind(wt.branch, wt.path)
              : Promise.resolve({ ahead: 0, behind: 0 }),
            GitWorktree.getLastCommit(wt.path),
            GitWorktree.getDirtyCount(wt.path),
          ]);

          if (selectedWt()?.path === path) {
            setExtra({ aheadBehind, lastCommit, dirtyCount });
          }
        }, DEBOUNCE_MS);
      },
    ),
  );

  const syncLabel = () => {
    const e = extra();
    if (!e) return "";
    const parts: string[] = [];
    if (e.aheadBehind.ahead > 0) parts.push(`\u2191${e.aheadBehind.ahead}`);
    if (e.aheadBehind.behind > 0) parts.push(`\u2193${e.aheadBehind.behind}`);
    return parts.length > 0 ? parts.join(" ") : "\u2713 up to date";
  };

  const statusLabel = () => {
    const wt = selectedWt();
    if (!wt) return "";
    if (wt.isLocked) return "\uD83D\uDD12 locked";
    const e = extra();
    if (e && e.dirtyCount > 0) return `\u25CF ${e.dirtyCount} file(s) dirty`;
    if (wt.isDirty) return "\u25CF dirty";
    return "\u2713 clean";
  };

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
              {statusLabel()}
            </text>
          </box>

          <box height={1} flexDirection="row">
            <box width={LABEL_W} height={1}>
              <text x={0} y={0} fg={theme.text.secondary}>Sync</text>
            </box>
            <text fg={
              extra()?.aheadBehind?.ahead || extra()?.aheadBehind?.behind
                ? theme.text.warning
                : theme.text.success
            }>
              {syncLabel()}
            </text>
          </box>

          <box height={1} flexDirection="row">
            <box width={LABEL_W} height={1}>
              <text x={0} y={0} fg={theme.text.secondary}>HEAD</text>
            </box>
            <text fg={theme.text.secondary}>{selectedWt()?.head?.slice(0, 8)}</text>
          </box>

          <Show when={extra()?.lastCommit}>
            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text x={0} y={0} fg={theme.text.secondary}>Last Commit</text>
              </box>
              <text fg={theme.text.primary}>
                {extra()!.lastCommit!.relativeDate}
              </text>
            </box>
            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text x={0} y={0} fg={theme.text.secondary}>{""}</text>
              </box>
              <text fg={theme.text.secondary}>
                {extra()!.lastCommit!.message.length > 50
                  ? extra()!.lastCommit!.message.slice(0, 47) + "..."
                  : extra()!.lastCommit!.message}
              </text>
            </box>
          </Show>

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
              {"d:delete  a:add  o:open  r:refresh  ^P:commands"}
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
