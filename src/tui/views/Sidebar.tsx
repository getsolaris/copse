import { For, Show, createMemo } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { useGit } from "../context/GitContext.tsx";
import { useKeyboard } from "@opentui/solid";
import { theme } from "../themes.ts";
import { isPinned } from "../../core/pin.ts";
import { readSessionMeta } from "../../core/session.ts";
import type { Worktree } from "../../core/types.ts";

const INNER_W = 24;

type DisplayItem =
  | { type: "header"; repoName: string }
  | { type: "separator" }
  | { type: "worktree"; wt: Worktree; flatIdx: number };

export function Sidebar() {
  const app = useApp();
  const git = useGit();

  const worktrees = () => git.worktrees() ?? [];
  const selectedIdx = () => app.selectedWorktreeIndex();

  const setSelectedByIndex = (idx: number) => {
    const nextIdx = Math.max(0, Math.min(idx, Math.max(worktrees().length - 1, 0)));
    const wt = worktrees()[nextIdx];
    app.setSelectedWorktreeIndex(nextIdx);
    app.setSelectedWorktreePath(wt?.path ?? null);
  };

  const displayItems = createMemo<DisplayItem[]>(() => {
    const wts = worktrees();
    const items: DisplayItem[] = [];

    const grouped = new Map<string, Worktree[]>();
    for (const wt of wts) {
      const existing = grouped.get(wt.repoName);
      if (existing) {
        existing.push(wt);
      } else {
        grouped.set(wt.repoName, [wt]);
      }
    }

    let flatIdx = 0;
    let isFirst = true;
    for (const [repoName, repoWts] of grouped) {
      if (!isFirst) {
        items.push({ type: "separator" });
      }
      isFirst = false;

      items.push({ type: "header", repoName });

      for (const wt of repoWts) {
        items.push({ type: "worktree", wt, flatIdx });
        flatIdx++;
      }
    }

    return items;
  });

  const selectionCount = () => app.selectedWorktrees().size;

  useKeyboard((event: any) => {
    if (app.activeTab() !== "list") return;
    if (app.showCommandPalette()) return;
    if (app.showRemove()) return;
    if (app.showBulkActions()) return;
    const key = event.name;
    const wts = worktrees();
    if (key === "j" || key === "down") {
      setSelectedByIndex(Math.min(selectedIdx() + 1, wts.length - 1));
    }
    if (key === "k" || key === "up") {
      setSelectedByIndex(Math.max(selectedIdx() - 1, 0));
    }
    if (key === "space") {
      const idx = selectedIdx();
      const wt = wts[idx];
      if (wt && !wt.isMain) {
        app.toggleWorktreeSelection(wt.path);
      }
    }
    if (event.ctrl && key === "a") {
      app.selectAllNonMain(wts.filter((wt) => !wt.isMain).map((wt) => wt.path));
    }
  });

  const statusIcon = (wt: Worktree) => {
    if (wt.isLocked) return "\uD83D\uDD12";
    if (wt.isDirty) return "\u25CF";
    return "\u2713";
  };

  const statusColor = (wt: Worktree) => {
    if (wt.isLocked) return theme.text.warning;
    if (wt.isDirty) return theme.text.error;
    return theme.text.success;
  };

  const truncBranch = (wt: Worktree, withCheck: boolean) => {
    const b = wt.branch ?? "(detached)";
    const maxLen = Math.max(8, INNER_W - (withCheck ? 9 : 7));
    return b.length > maxLen ? b.slice(0, maxLen - 1) + "\u2026" : b;
  };

  return (
    <box x={0} y={0} width="100%" height="100%" backgroundColor={theme.bg.surface} flexDirection="column" paddingX={1} paddingY={1} gap={0}>
      <Show when={git.loading()}>
        <text fg={theme.text.secondary}>Loading...</text>
      </Show>
      <Show when={!git.loading()}>
        <For each={displayItems()}>
          {(item) => {
            if (item.type === "header") {
              return (
                <box width="100%" height={1}>
                  <text fg={theme.text.accent}>
                    <b>{item.repoName}</b>
                  </text>
                </box>
              );
            }

            if (item.type === "separator") {
              return (
                <box width="100%" height={1}>
                  <text fg={theme.border.subtle}>
                    {"\u2500".repeat(INNER_W)}
                  </text>
                </box>
              );
            }

            const wt = item.wt;
            const isFocused = () => item.flatIdx === selectedIdx();
            const isChecked = () => app.selectedWorktrees().has(wt.path);
            return (
              <box
                width="100%" height={1}
                backgroundColor={isFocused() ? theme.select.focusedBg : isChecked() ? theme.bg.elevated : theme.bg.surface}
                paddingX={1}
                onMouseDown={() => setSelectedByIndex(item.flatIdx)}
              >
                <text x={0} y={0} fg={statusColor(wt)}>
                  {statusIcon(wt)}
                </text>
                <text x={2} y={0} fg={isFocused() ? theme.tab.active : theme.text.primary}>
                  {truncBranch(wt, false)}
                </text>
                <Show when={isChecked()}>
                  <text x={INNER_W - 1} y={0} fg={theme.text.accent}>
                    {"\u2713"}
                  </text>
                </Show>
                <Show when={!!readSessionMeta(wt.path)}>
                  <text x={INNER_W - (isChecked() ? 3 : 1)} y={0} fg={theme.text.accent}>
                    {"S"}
                  </text>
                </Show>
                <Show when={isPinned(wt.path)}>
                  <text x={INNER_W - (isChecked() ? 5 : 3) + (readSessionMeta(wt.path) ? 0 : 2)} y={0} fg={theme.text.warning}>
                    {"P"}
                  </text>
                </Show>
              </box>
            );
          }}
        </For>
        <Show when={selectionCount() > 0}>
          <box width="100%" height={1}>
            <text fg={theme.text.accent}>
              {`Selected: ${selectionCount()}`}
            </text>
          </box>
        </Show>
      </Show>
    </box>
  );
}
