import { createEffect, createSignal, Show } from "solid-js";
import { render, useKeyboard, useTerminalDimensions, useRenderer } from "@opentui/solid";
import "@opentui-ui/toast/solid";
import { AppProvider, useApp } from "./context/AppContext.tsx";
import { GitProvider, useGit } from "./context/GitContext.tsx";
import { GitWorktree } from "../core/git.ts";
import { WorktreeList } from "./views/WorktreeList.tsx";
import { WorktreeCreate } from "./views/WorktreeCreate.tsx";
import { WorktreeRemove } from "./views/WorktreeRemove.tsx";
import { BulkActions } from "./views/BulkActions.tsx";
import { ConfigView } from "./views/ConfigView.tsx";
import { DoctorView } from "./views/DoctorView.tsx";
import { Sidebar } from "./views/Sidebar.tsx";
import { theme, setCurrentThemeName, THEME_NAMES, type ThemeName } from "./themes.ts";
import { CommandPalette } from "./views/CommandPalette.tsx";
import { ToastProvider } from "./context/ToastContext.tsx";
import { Toast } from "./views/Toast.tsx";
import { loadConfig, getConfiguredRepoPaths } from "../core/config.ts";
import { resolve } from "node:path";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      box: any;
      text: any;
      span: any;
      b: any;
      strong: any;
      em: any;
      i: any;
      u: any;
      br: any;
      tab_select: any;
        select: any;
        scrollbox: any;
        input: any;
        diff: any;
        code: any;
        line_number: any;
        ascii_font: any;
        textarea: any;
        toaster: any;
      }
  }
}

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

const SIDEBAR_W = 28;

function AppShell(props: { repoPath: string }) {
  const app = useApp();
  const git = useGit();
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

  useKeyboard((event: any) => {
    const key = event.name;
    if (key === "escape") {
      if (app.showBulkActions()) { app.setShowBulkActions(false); return; }
      if (app.showDetailView()) { app.setShowDetailView(false); return; }
      if (app.showRemove()) { app.setShowRemove(false); return; }
      if (showHelp()) { setShowHelp(false); return; }
      if (app.activeTab() !== "list") { app.setActiveTab("list"); return; }
    }
    if (event.ctrl && key === "p") {
      app.setShowCommandPalette(true);
      return;
    }
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
      if (key === "o") {
        const selected = selectedWorktree();
        if (selected) {
          const editor = process.env.VISUAL || process.env.EDITOR || detectEditorBin();
          if (editor) {
            Bun.spawn([editor, selected.path], { stdout: "inherit", stderr: "inherit" });
          }
        }
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

  const headerMeta = () => {
    const wts = git.worktrees() ?? [];
    return `${repoName()} · ${wts.length} worktrees`;
  };

  const sidebarTitle = () => {
    const wts = git.worktrees() ?? [];
    return ` Worktrees (${wts.length}) `;
  };

  const mainW = () => w() - SIDEBAR_W - 1;

  return (
    <box width={w()} height={h()} backgroundColor={theme.bg.base} flexDirection="column">
      <box height={1} backgroundColor={theme.bg.overlay}>
        <text x={1} y={0} fg={theme.text.accent}>
          {"\uD83C\uDF33 oh-my-worktree"}
        </text>
        <text x={w() - headerRight().length - 2} y={0} fg={theme.text.secondary}>
          {headerRight()}
        </text>
      </box>

      <box flexGrow={1} flexDirection="row">
        <box
          width={SIDEBAR_W}
          flexShrink={0}
          backgroundColor={theme.bg.surface}
          flexDirection="column"
        >
          <box height={1} paddingX={1}>
            <text fg={theme.text.accent}>
              <b>{sidebarTitle()}</b>
            </text>
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
          <Show when={app.activeTab() === "config"}>
            <ConfigView />
          </Show>
        </box>
      </box>

      <Toast />
      <toaster position="bottom-right" />

      <box height={1} backgroundColor={theme.bg.overlay}>
        <text x={0} y={0} fg={theme.border.subtle}>
          {"\u2500".repeat(w())}
        </text>
      </box>
      <box height={1} backgroundColor={theme.bg.overlay}>
        <text x={1} y={0} fg={theme.text.secondary}>
          {"d:delete  a:add  o:open  r:refresh  ^P:cmd  h:health  q:quit"}
        </text>
      </box>

      <Show when={showHelp() && !app.showCommandPalette()}>
        <box
          x={Math.max(0, Math.floor((w() - Math.max(40, Math.min(60, w() - 4))) / 2))}
          y={Math.max(0, Math.floor((h() - 14) / 2))}
          width={Math.max(40, Math.min(60, w() - 4))}
          height={14}
          border={true} borderStyle="rounded"
          borderColor={theme.border.active}
          backgroundColor={theme.bg.elevated}
          title=" Keyboard Shortcuts "
          titleAlignment="left"
          flexDirection="column"
          paddingX={1}
          paddingY={1}
          position="absolute"
        >
          <box height={1}><text x={1} fg={theme.text.secondary}>q</text><text x={8} fg={theme.text.primary}>Quit</text></box>
          <box height={1}><text x={1} fg={theme.text.secondary}>j/k</text><text x={8} fg={theme.text.primary}>Navigate list</text></box>
          <box height={1}><text x={1} fg={theme.text.secondary}>a</text><text x={8} fg={theme.text.primary}>Add worktree</text></box>
          <box height={1}><text x={1} fg={theme.text.secondary}>d</text><text x={8} fg={theme.text.primary}>Delete worktree</text></box>
          <box height={1}><text x={1} fg={theme.text.secondary}>r</text><text x={8} fg={theme.text.primary}>Refresh list</text></box>
          <box height={1} />
          <box height={1}><text x={1} fg={theme.text.secondary}>Ctrl+P</text><text x={8} fg={theme.text.primary}>Command palette</text></box>
          <box height={1}><text x={1} fg={theme.text.secondary}>?</text><text x={8} fg={theme.text.primary}>Toggle help</text></box>
          <box height={1} />
          <box height={1}><text x={1} fg={theme.text.accent}>Press ? to close</text></box>
        </box>
      </Show>

      <Show when={app.activeTab() === "add"}>
        <WorktreeCreate />
      </Show>

      <Show when={app.activeTab() === "doctor"}>
        <DoctorView />
      </Show>

      <Show when={app.showRemove()}>
        <WorktreeRemove />
      </Show>

      <Show when={app.showCommandPalette()}>
        <CommandPalette />
      </Show>
    </box>
  );
}

export async function launchTUI() {
  if (process.stdout.isTTY) {
    process.stdout.write("\u001b]0;Oh My Worktree\u0007");
  }

  const repoPath = await GitWorktree.getMainRepoPath().catch(() => process.cwd());

  let repoPaths = [repoPath];
  try {
    const cfg: Record<string, unknown> & { theme?: string } = { ...loadConfig() };
    const configPaths = getConfiguredRepoPaths(cfg as any);
    const seen = new Set([resolve(repoPath)]);
    for (const p of configPaths) {
      const resolved = resolve(p);
      if (!seen.has(resolved)) {
        seen.add(resolved);
        repoPaths.push(p);
      }
    }
    if (cfg.theme && THEME_NAMES.includes(cfg.theme as ThemeName)) {
      setCurrentThemeName(cfg.theme as ThemeName);
    }
  } catch {}

  await render(
    () => (
      <AppProvider repoPath={repoPath} repoPaths={repoPaths}>
        <GitProvider repoPaths={repoPaths}>
          <ToastProvider>
            <AppShell repoPath={repoPath} />
          </ToastProvider>
        </GitProvider>
      </AppProvider>
    ),
    { exitOnCtrlC: true, useMouse: true },
  );
}
