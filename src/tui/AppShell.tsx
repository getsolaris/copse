import { createEffect, createSignal, Show } from "solid-js";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid";
import { useApp } from "./context/AppContext.tsx";
import { useGit } from "./context/GitContext.tsx";
import { useToast } from "./context/ToastContext.tsx";
import { buildFileManagerCommand, buildTerminalCommand } from "../core/open.ts";
import { loadConfig } from "../core/config.ts";
import { resolveFocusOpenTarget } from "../core/focus.ts";
import { existsSync } from "node:fs";
import { BulkActions } from "./views/BulkActions.tsx";
import { CommandPalette } from "./views/CommandPalette.tsx";
import { ConfigView } from "./views/ConfigView.tsx";
import { DoctorView } from "./views/DoctorView.tsx";
import { FocusPicker } from "./views/FocusPicker.tsx";
import { Sidebar } from "./views/Sidebar.tsx";
import { ShortcutHelp } from "./views/ShortcutHelp.tsx";
import { Toast } from "./views/Toast.tsx";
import { WorktreeCreate } from "./views/WorktreeCreate.tsx";
import { WorktreeList } from "./views/WorktreeList.tsx";
import { WorktreeRemove } from "./views/WorktreeRemove.tsx";
import { theme } from "./themes.ts";

const SIDEBAR_W = 28;

function detectEditorBin(): string | null {
  const editors = ["code", "cursor", "vim", "nvim", "zed", "subl", "idea", "webstorm"] as const;
  for (const e of editors) {
    try {
      const proc = Bun.spawnSync(["which", e], { stdout: "pipe", stderr: "pipe" });
      if (proc.exitCode === 0) return e;
    } catch {
    }
  }
  return null;
}

function spawnOpenCommand(argv: readonly string[]): void {
  const [command, ...args] = argv;
  if (!command) {
    throw new Error("Open command is empty");
  }
  Bun.spawn([command, ...args], { stdout: "inherit", stderr: "inherit" });
}

export function AppShell(props: { repoPath: string }) {
  const app = useApp();
  const git = useGit();
  const toast = useToast();
  const renderer = useRenderer();
  const [showHelp, setShowHelp] = createSignal(false);
  const dims = useTerminalDimensions();

  const selectedWorktree = () => {
    const wts = git.worktrees() ?? [];
    const selectedPath = app.selectedWorktreePath();
    if (selectedPath) {
      const match = wts.find((wt) => wt.path === selectedPath);
      if (match) return match;
    }
    return wts[app.selectedWorktreeIndex()];
  };

  createEffect(() => {
    const wts = git.worktrees() ?? [];
    const paths = wts.map((wt) => wt.path);

    app.pruneSelectedWorktrees(paths);

    if (wts.length === 0) {
      if (app.selectedWorktreeIndex() !== 0) app.setSelectedWorktreeIndex(0);
      if (app.selectedWorktreePath() !== null) app.setSelectedWorktreePath(null);
      return;
    }

    const selectedPath = app.selectedWorktreePath();
    if (selectedPath) {
      const matchedIdx = wts.findIndex((wt) => wt.path === selectedPath);
      if (matchedIdx >= 0) {
        if (matchedIdx !== app.selectedWorktreeIndex()) {
          app.setSelectedWorktreeIndex(matchedIdx);
        }
        return;
      }
    }

    const nextIdx = Math.min(app.selectedWorktreeIndex(), wts.length - 1);
    const nextPath = wts[nextIdx]?.path ?? null;

    if (nextIdx !== app.selectedWorktreeIndex()) {
      app.setSelectedWorktreeIndex(nextIdx);
    }
    if (nextPath !== app.selectedWorktreePath()) {
      app.setSelectedWorktreePath(nextPath);
    }
  });

  useKeyboard((event: { name: string; ctrl?: boolean }) => {
    const key = event.name;
    if (key === "escape") {
      if (app.focusPickerData()) { app.setFocusPickerData(null); return; }
      if (app.showBulkActions()) { app.setShowBulkActions(false); return; }
      if (app.showDetailView()) { app.setShowDetailView(false); return; }
      if (app.showRemove()) { app.setShowRemove(false); return; }
      if (showHelp()) { setShowHelp(false); return; }
      if (app.inputFocused()) return;
      if (app.activeTab() !== "list") { app.setActiveTab("list"); return; }
    }
    if (event.ctrl && key === "p") {
      app.setShowCommandPalette(true);
      return;
    }
    if (app.focusPickerData()) return;
    if (app.inputFocused()) return;
    if (app.showCommandPalette()) return;
    if (app.showBulkActions()) return;
    if (app.showRemove()) return;
    if (app.activeTab() === "add") return;
    if (app.activeTab() === "list") {
      if (app.showDetailView()) return;
      if (key === "a") { app.setActiveTab("add"); return; }
      if (key === "r") { git.refetch(); return; }
      if (key === "d") {
        const selected = selectedWorktree();
        if (selected && !selected.isMain) {
          app.setShowRemove(true);
        }
        return;
      }
      if (key === "f") {
        const selected = selectedWorktree();
        if (!selected) return;
        try {
          spawnOpenCommand(buildFileManagerCommand(selected.path));
          toast.addToast({ message: "Opened in Finder", type: "success" });
        } catch (err) {
          toast.addToast({ message: `Finder failed: ${(err as Error).message}`, type: "error" });
        }
        return;
      }
      if (key === "t") {
        const selected = selectedWorktree();
        if (!selected) return;
        try {
          const config = loadConfig();
          spawnOpenCommand(buildTerminalCommand(selected.path, config.terminalCommand));
          toast.addToast({ message: "Opened in Terminal", type: "success" });
        } catch (err) {
          toast.addToast({ message: `Terminal failed: ${(err as Error).message}`, type: "error" });
        }
        return;
      }
      if (key === "o") {
        const selected = selectedWorktree();
        if (!selected) return;
        const resolution = resolveFocusOpenTarget(selected.path);
        if (resolution.kind === "multiple") {
          app.setFocusPickerData({
            worktreePath: selected.path,
            focusPaths: resolution.focusPaths,
          });
          return;
        }
        const editor = process.env.VISUAL || process.env.EDITOR || detectEditorBin();
        if (!editor) {
          toast.addToast({
            message: "No editor detected. Set $VISUAL or $EDITOR.",
            type: "error",
          });
          return;
        }
        if (!existsSync(resolution.path)) {
          toast.addToast({
            message: `Path does not exist: ${resolution.path}`,
            type: "error",
          });
          return;
        }
        Bun.spawn([editor, resolution.path], { stdout: "inherit", stderr: "inherit" });
        return;
      }
    }
    if (key === "h") { app.setActiveTab("doctor"); return; }
    if (key === "q" || key === "Q") renderer.destroy();
    if (key === "?") setShowHelp((v) => !v);
  });

  const w = () => dims().width;
  const h = () => dims().height;
  const repoName = () => props.repoPath.split("/").pop() ?? "";

  const headerRight = () => {
    const names = git.repoNames();
    if (names.length <= 1) return repoName();
    return `${names.length} repos`;
  };

  const sidebarTitle = () => {
    const wts = git.worktrees() ?? [];
    return ` Worktrees (${wts.length}) `;
  };

  const mainW = () => w() - SIDEBAR_W - 1;

  return (
    <box width={w()} height={h()} backgroundColor={theme.bg.base} flexDirection="column">
      <box height={1} backgroundColor={theme.bg.overlay}>
        <text x={1} y={0} fg={theme.text.accent}>{"\uD83C\uDF33 copse"}</text>
        <text x={w() - headerRight().length - 2} y={0} fg={theme.text.secondary}>
          {headerRight()}
        </text>
      </box>

      <box flexGrow={1} flexDirection="row">
        <box width={SIDEBAR_W} flexShrink={0} backgroundColor={theme.bg.surface} flexDirection="column">
          <box height={1} paddingX={1}>
            <text fg={theme.text.accent}><b>{sidebarTitle()}</b></text>
          </box>
          <Sidebar />
        </box>

        <box width={1} />

        <box flexGrow={1} backgroundColor={theme.bg.base}>
          <Show when={app.activeTab() !== "config" && !app.showRemove() && !app.showBulkActions()}>
            <WorktreeList />
          </Show>
          <Show when={app.activeTab() === "list" && app.showBulkActions()}>
            <BulkActions w={mainW()} h={h() - 3} />
          </Show>
          <Show when={app.activeTab() === "config"}><ConfigView /></Show>
        </box>
      </box>

      <Toast />
      <toaster position="bottom-right" />

      <box height={1} backgroundColor={theme.bg.overlay}>
        <text x={0} y={0} fg={theme.border.subtle}>{"\u2500".repeat(w())}</text>
      </box>
      <box height={1} backgroundColor={theme.bg.overlay}>
        <text x={1} y={0} fg={theme.text.secondary}>
          {"d:delete  a:add  o:open  f:finder  t:terminal  r:refresh  ^P:cmd  h:health  q:quit"}
        </text>
      </box>

      <Show when={showHelp() && !app.showCommandPalette()}>
        <ShortcutHelp width={w()} height={h()} />
      </Show>

      <Show when={app.activeTab() === "add"}><WorktreeCreate /></Show>
      <Show when={app.activeTab() === "doctor"}><DoctorView /></Show>
      <Show when={app.showRemove()}><WorktreeRemove /></Show>
      <Show when={app.showCommandPalette()}><CommandPalette /></Show>
      <FocusPicker detectEditor={() => process.env.VISUAL || process.env.EDITOR || detectEditorBin()} />
    </box>
  );
}
