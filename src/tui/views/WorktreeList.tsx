import { Show, createSignal, createEffect, on, onCleanup } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { useGit } from "../context/GitContext.tsx";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { theme } from "../themes.ts";
import { readFocus } from "../../core/focus.ts";
import { readSessionMeta } from "../../core/session.ts";
import { GitWorktree } from "../../core/git.ts";
import { DetailView } from "./DetailView.tsx";
import { Spinner } from "./Spinner.tsx";

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

  const selectedWt = () => {
    const wts = git.worktrees() ?? [];
    const selectedPath = app.selectedWorktreePath();
    if (selectedPath) {
      const match = wts.find((wt) => wt.path === selectedPath);
      if (match) return match;
    }
    return wts[app.selectedWorktreeIndex()];
  };
  const w = () => dims().width;

  const LABEL_W = 14;

  const [extra, setExtra] = createSignal<WorktreeExtra | null>(null);
  const [extraLoading, setExtraLoading] = createSignal(false);
  const [extraError, setExtraError] = createSignal("");
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
          setExtraLoading(false);
          setExtraError("");
          return;
        }

        setExtra(null);
        setExtraLoading(true);
        setExtraError("");

        debounceTimer = setTimeout(async () => {
          const wt = selectedWt();
          if (!wt || wt.path !== path) return;

          try {
            const [aheadBehind, lastCommit, dirtyCount] = await Promise.all([
              wt.branch
                ? GitWorktree.getAheadBehind(wt.branch, wt.path)
                : Promise.resolve({ ahead: 0, behind: 0 }),
              GitWorktree.getLastCommit(wt.path),
              GitWorktree.getDirtyCount(wt.path),
            ]);

            if (selectedWt()?.path === path) {
              setExtra({ aheadBehind, lastCommit, dirtyCount });
              setExtraError("");
            }
          } catch (err) {
            if (selectedWt()?.path === path) {
              setExtra(null);
              setExtraError((err as Error).message);
            }
          } finally {
            if (selectedWt()?.path === path) {
              setExtraLoading(false);
            }
          }
        }, DEBOUNCE_MS);
      },
    ),
  );

  const syncLabel = () => {
    if (extraLoading()) return "Loading...";
    if (extraError()) return "Unavailable";
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

  useKeyboard((event: any) => {
    if (app.activeTab() !== "list") return;
    if (app.showCommandPalette()) return;
    if (app.showRemove()) return;
    if (app.showBulkActions()) return;
    const key = event.name;
    if (key === "x" && app.selectedWorktrees().size > 0) {
      app.setShowBulkActions(true);
      return;
    }
    if (key === "return" && !app.showDetailView() && selectedWt()) {
      app.setShowDetailView(true);
      return;
    }
    if (key === "escape" && app.showDetailView()) {
      app.setShowDetailView(false);
      return;
    }
  });

  return (
    <box width="100%" height="100%" backgroundColor={theme.bg.base}>
      <Show when={app.showDetailView() && !!selectedWt()}>
        <DetailView worktree={selectedWt()!} />
      </Show>

      <Show when={!app.showDetailView()}>
        <Show when={git.loading()}>
          <Spinner label="Loading worktrees..." />
        </Show>

        <Show when={!git.loading() && !!git.error()}>
          <box flexDirection="column" paddingX={2} paddingY={1} gap={0}>
            <text fg={theme.text.error}>Unable to list worktrees</text>
            <text fg={theme.text.secondary}>{" "}</text>
            <text fg={theme.text.secondary}>{git.error()?.message}</text>
            <text fg={theme.text.secondary}>{" "}</text>
            <text fg={theme.text.secondary}>copse needs a git repository to manage worktrees.</text>
            <text fg={theme.text.secondary}>{"  \u00B7 cd into a git repository and relaunch copse, or"}</text>
            <text fg={theme.text.secondary}>{"  \u00B7 configure repos in ~/.config/copse/config.json"}</text>
            <text fg={theme.text.secondary}>{" "}</text>
            <text fg={theme.text.accent}>Press q to quit, or ^P to open the command palette.</text>
          </box>
        </Show>

        <Show when={!git.loading() && !git.error() && !!selectedWt()}>
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
                {"\u2500".repeat(Math.max(w() - 38, 10))}
              </text>
            </box>

            <Show when={git.isMultiRepo()}>
              <box height={1} flexDirection="row">
                <box width={LABEL_W} height={1}>
                  <text fg={theme.text.secondary}>Repo</text>
                </box>
                <text fg={theme.text.warning}>{selectedWt()?.repoName}</text>
              </box>
            </Show>

            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text fg={theme.text.secondary}>Branch</text>
              </box>
              <text fg={theme.text.accent}>{selectedWt()?.branch ?? "(detached)"}</text>
            </box>

            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text fg={theme.text.secondary}>Path</text>
              </box>
              <text fg={theme.text.primary}>{selectedWt()?.path}</text>
            </box>

            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text fg={theme.text.secondary}>Status</text>
              </box>
              <text fg={selectedWt()?.isDirty ? theme.text.error : selectedWt()?.isLocked ? theme.text.warning : theme.text.success}>
                {statusLabel()}
              </text>
            </box>

            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text fg={theme.text.secondary}>Sync</text>
              </box>
              <text fg={
                extraError()
                  ? theme.text.error
                  : extraLoading()
                    ? theme.text.secondary
                    : extra()?.aheadBehind?.ahead || extra()?.aheadBehind?.behind
                  ? theme.text.warning
                  : theme.text.success
              }>
                {syncLabel()}
              </text>
            </box>

            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text fg={theme.text.secondary}>HEAD</text>
              </box>
              <text fg={theme.text.secondary}>{selectedWt()?.head?.slice(0, 8)}</text>
            </box>

            <Show when={extra()?.lastCommit}>
              <box height={1} flexDirection="row">
                <box width={LABEL_W} height={1}>
                  <text fg={theme.text.secondary}>Last Commit</text>
                </box>
                <text fg={theme.text.primary}>
                  {extra()!.lastCommit!.relativeDate}
                </text>
              </box>
              <box height={1} flexDirection="row">
                <box width={LABEL_W} height={1}>
                  <text fg={theme.text.secondary}>{""}</text>
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
                  <text fg={theme.text.secondary}>Focus</text>
                </box>
                <text fg={theme.text.accent}>
                  {readFocus(selectedWt()?.path ?? "")?.join(", ") ?? ""}
                </text>
              </box>
            </Show>

            <Show when={(() => { const s = readSessionMeta(selectedWt()?.path ?? ""); return !!s; })()}>
              <box height={1} flexDirection="row">
                <box width={LABEL_W} height={1}>
                  <text fg={theme.text.secondary}>Session</text>
                </box>
                <text fg={theme.text.accent}>
                  {(() => {
                    const s = readSessionMeta(selectedWt()?.path ?? "");
                    if (!s) return "";
                    return s.layout ? `${s.name} [${s.layout}]` : s.name;
                  })()}
                </text>
              </box>
            </Show>

            <Show when={selectedWt()?.isMain}>
              <box height={1} flexDirection="row">
                <box width={LABEL_W} height={1}>
                  <text fg={theme.text.secondary}>Type</text>
                </box>
                <text fg={theme.text.accent}>main worktree</text>
              </box>
            </Show>

            <box height={1}>
              <text fg={theme.border.subtle}>
                {"\u2500".repeat(Math.max(w() - 38, 10))}
              </text>
            </box>

            <box height={1} flexDirection="row" gap={2}>
              <text fg={theme.text.secondary}>{"Enter:detail"}</text>
              <text fg={theme.text.secondary}>{"d:delete"}</text>
              <text fg={theme.text.secondary}>{"a:add"}</text>
              <text fg={theme.text.secondary}>{"o:open"}</text>
              <text fg={theme.text.secondary}>{"r:refresh"}</text>
              <text fg={theme.text.secondary}>{"^P:commands"}</text>
            </box>
          </box>
        </Show>

        <Show when={!git.loading() && !git.error() && !selectedWt()}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.text.secondary}>No worktree selected.</text>
            <text fg={theme.text.accent}>{"Press 'a' to create one."}</text>
          </box>
        </Show>
      </Show>
    </box>
  );
}
