import { For, Show, createMemo } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { useGit } from "../context/GitContext.tsx";
import { useKeyboard } from "@opentui/solid";
import { theme } from "../themes.ts";
import type { Worktree } from "../../core/types.ts";

const INNER_W = 26;

type DisplayItem =
  | { type: "header"; repoName: string; y: number }
  | { type: "separator"; y: number }
  | { type: "worktree"; wt: Worktree; flatIdx: number; y: number };

export function Sidebar() {
  const app = useApp();
  const git = useGit();

  const worktrees = () => git.worktrees() ?? [];
  const selectedIdx = () => app.selectedWorktreeIndex();

  const displayItems = createMemo<DisplayItem[]>(() => {
    const wts = worktrees();
    const multiRepo = git.isMultiRepo();
    const items: DisplayItem[] = [];

    if (!multiRepo) {
      for (let i = 0; i < wts.length; i++) {
        items.push({ type: "worktree", wt: wts[i], flatIdx: i, y: i });
      }
      return items;
    }

    const grouped = new Map<string, Worktree[]>();
    for (const wt of wts) {
      const existing = grouped.get(wt.repoName);
      if (existing) {
        existing.push(wt);
      } else {
        grouped.set(wt.repoName, [wt]);
      }
    }

    let y = 0;
    let flatIdx = 0;
    let isFirst = true;
    for (const [repoName, repoWts] of grouped) {
      if (!isFirst) {
        items.push({ type: "separator", y });
        y += 1;
      }
      isFirst = false;

      items.push({ type: "header", repoName, y });
      y += 1;

      for (const wt of repoWts) {
        items.push({ type: "worktree", wt, flatIdx, y });
        flatIdx++;
        y += 1;
      }
    }

    return items;
  });

  useKeyboard((event: any) => {
    if (app.activeTab() !== "list") return;
    if (app.showCommandPalette()) return;
    const key = event.name;
    const wts = worktrees();
    if (key === "j" || key === "down") {
      app.setSelectedWorktreeIndex(Math.min(selectedIdx() + 1, wts.length - 1));
    }
    if (key === "k" || key === "up") {
      app.setSelectedWorktreeIndex(Math.max(selectedIdx() - 1, 0));
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

  const truncBranch = (wt: Worktree, selected: boolean) => {
    const b = wt.branch ?? "(detached)";
    const maxLen = INNER_W - (selected ? 7 : 6);
    return b.length > maxLen ? b.slice(0, maxLen - 1) + "\u2026" : b;
  };

  return (
    <box x={0} y={0} width="100%" height="100%" backgroundColor={theme.bg.surface}>
      <Show when={git.loading()}>
        <text x={1} y={1} fg={theme.text.secondary}>Loading...</text>
      </Show>
      <Show when={!git.loading()}>
        <For each={displayItems()}>
          {(item) => {
            if (item.type === "header") {
              return (
                <box x={0} y={item.y} width="100%" height={1}>
                  <text x={1} y={0} fg={theme.text.accent}>
                    {item.repoName}
                  </text>
                </box>
              );
            }

            if (item.type === "separator") {
              return (
                <box x={0} y={item.y} width="100%" height={1}>
                  <text x={1} y={0} fg={theme.border.subtle}>
                    {"\u2500".repeat(INNER_W - 2)}
                  </text>
                </box>
              );
            }

            const wt = item.wt;
            const isSelected = () => item.flatIdx === selectedIdx();

            return (
              <box
                x={0} y={item.y}
                width="100%" height={1}
                backgroundColor={isSelected() ? theme.select.focusedBg : theme.bg.surface}
                onMouseDown={() => app.setSelectedWorktreeIndex(item.flatIdx)}
              >
                <text x={1} y={0} fg={isSelected() ? theme.tab.active : theme.text.primary}>
                  {isSelected() ? "\u25B6 " : "  "}
                </text>
                <text x={isSelected() ? 3 : 3} y={0} fg={statusColor(wt)}>
                  {statusIcon(wt)}
                </text>
                <text x={5} y={0} fg={isSelected() ? theme.tab.active : theme.text.primary}>
                  {truncBranch(wt, isSelected())}
                </text>
              </box>
            );
          }}
        </For>
      </Show>
    </box>
  );
}
