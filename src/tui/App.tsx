import { createSignal, Show } from "solid-js";
import { render, useKeyboard, useTerminalDimensions, useRenderer } from "@opentui/solid";
import { AppProvider, useApp, type TabId } from "./context/AppContext.tsx";
import { GitProvider, useGit } from "./context/GitContext.tsx";
import { GitWorktree } from "../core/git.ts";
import { WorktreeList } from "./views/WorktreeList.tsx";
import { WorktreeCreate } from "./views/WorktreeCreate.tsx";
import { WorktreeRemove } from "./views/WorktreeRemove.tsx";
import { ConfigView } from "./views/ConfigView.tsx";
import { DoctorView } from "./views/DoctorView.tsx";
import { Sidebar } from "./views/Sidebar.tsx";
import { theme, setCurrentThemeName, THEME_NAMES, type ThemeName } from "./themes.ts";
import { CommandPalette } from "./views/CommandPalette.tsx";
import { loadConfig, getConfiguredRepoPaths } from "../core/config.ts";
import { resolve } from "node:path";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      box: any;
      text: any;
      tab_select: any;
      select: any;
      scrollbox: any;
      input: any;
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

  useKeyboard((event: any) => {
    if (app.showCommandPalette()) return;
    const key = event.name;
    if (event.ctrl && key === "p") {
      app.setShowCommandPalette(true);
      return;
    }
    if (key === "escape") {
      if (app.showRemove()) { app.setShowRemove(false); return; }
      if (showHelp()) { setShowHelp(false); return; }
      if (app.activeTab() !== "list") { app.setActiveTab("list"); return; }
    }
    if (app.showRemove()) return;
    if (app.activeTab() === "add") return;
    if (app.activeTab() === "list") {
      if (key === "a") { app.setActiveTab("add"); return; }
      if (key === "r") { git.refetch(); return; }
      if (key === "d") {
        const wts = git.worktrees() ?? [];
        const selected = wts[app.selectedWorktreeIndex()];
        if (selected && !selected.isMain) {
          app.setShowRemove(true);
        }
        return;
      }
      if (key === "o") {
        const wts = git.worktrees() ?? [];
        const selected = wts[app.selectedWorktreeIndex()];
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

  const sidebarTitle = () => {
    const wts = git.worktrees() ?? [];
    return ` Worktrees (${wts.length}) `;
  };

  return (
    <box width={w()} height={h()} backgroundColor={theme.bg.base}>
      <box x={0} y={0} width={w()} height={1} backgroundColor={theme.bg.overlay}>
        <text x={1} y={0} fg={theme.text.accent}>
          {"\uD83C\uDF33 oh-my-worktree"}
        </text>
        <text x={w() - headerRight().length - 3} y={0} fg={theme.text.secondary}>
          {headerRight()}
        </text>
      </box>

      <box x={0} y={1} width={w()} height={h() - 3} flexDirection="row">
        <box
          width={SIDEBAR_W} height={h() - 3}
          flexShrink={0}
          backgroundColor={theme.bg.surface}
          border={true} borderStyle="single"
          borderColor={theme.border.default}
          title={sidebarTitle()}
          titleAlignment="left"
        >
          <Sidebar />
        </box>

        <box width={w() - SIDEBAR_W} height={h() - 3} flexGrow={1} backgroundColor={theme.bg.base}>
          <Show when={app.showCommandPalette()}>
            <CommandPalette />
          </Show>
          <Show when={showHelp() && !app.showCommandPalette()}>
            <box x={0} y={0} width={w() - SIDEBAR_W} height={h() - 3} backgroundColor={theme.bg.base}>
              <box
                x={2} y={1}
                width={w() - SIDEBAR_W - 4} height={h() - 5}
                border={true} borderStyle="single"
                borderColor={theme.border.active}
                backgroundColor={theme.bg.elevated}
                title=" Keyboard Shortcuts "
                titleAlignment="left"
              >
                <text x={3} y={1} fg={theme.text.secondary}>q</text>
                <text x={10} y={1} fg={theme.text.primary}>Quit</text>
                <text x={3} y={2} fg={theme.text.secondary}>j/k</text>
                <text x={10} y={2} fg={theme.text.primary}>Navigate list</text>
                <text x={3} y={3} fg={theme.text.secondary}>a</text>
                <text x={10} y={3} fg={theme.text.primary}>Add worktree</text>
                <text x={3} y={4} fg={theme.text.secondary}>d</text>
                <text x={10} y={4} fg={theme.text.primary}>Delete worktree</text>
                <text x={3} y={5} fg={theme.text.secondary}>r</text>
                <text x={10} y={5} fg={theme.text.primary}>Refresh list</text>
                <text x={3} y={6} fg={theme.text.secondary}>Ctrl+P</text>
                <text x={10} y={6} fg={theme.text.primary}>Command palette</text>
                <text x={3} y={7} fg={theme.text.secondary}>?</text>
                <text x={10} y={7} fg={theme.text.primary}>Toggle help</text>
                <text x={3} y={9} fg={theme.text.secondary}>Press ? to close</text>
              </box>
            </box>
          </Show>
          <Show when={!app.showCommandPalette() && !showHelp() && app.activeTab() === "list" && !app.showRemove()}>
            <WorktreeList />
          </Show>
          <Show when={!app.showCommandPalette() && !showHelp() && app.activeTab() === "list" && app.showRemove()}>
            <WorktreeRemove w={w() - SIDEBAR_W} h={h() - 3} />
          </Show>
          <Show when={!app.showCommandPalette() && !showHelp() && app.activeTab() === "add"}>
            <WorktreeCreate />
          </Show>
          <Show when={!app.showCommandPalette() && !showHelp() && app.activeTab() === "config"}>
            <ConfigView />
          </Show>
          <Show when={!app.showCommandPalette() && !showHelp() && app.activeTab() === "doctor"}>
            <DoctorView />
          </Show>
        </box>
      </box>

      <box x={0} y={h() - 2} width={w()} height={1} backgroundColor={theme.bg.overlay}>
        <text x={0} y={0} fg={theme.border.subtle}>
          {"\u2500".repeat(w())}
        </text>
      </box>

      <box x={0} y={h() - 1} width={w()} height={1} backgroundColor={theme.bg.overlay}>
        <text x={1} y={0} fg={theme.text.secondary}>{"d"}</text>
        <text x={2} y={0} fg={theme.text.primary}>{":delete"}</text>
        <text x={10} y={0} fg={theme.border.subtle}>{"\u2502"}</text>
        <text x={12} y={0} fg={theme.text.secondary}>{"a"}</text>
        <text x={13} y={0} fg={theme.text.primary}>{":add"}</text>
        <text x={18} y={0} fg={theme.border.subtle}>{"\u2502"}</text>
        <text x={20} y={0} fg={theme.text.secondary}>{"o"}</text>
        <text x={21} y={0} fg={theme.text.primary}>{":open"}</text>
        <text x={27} y={0} fg={theme.border.subtle}>{"\u2502"}</text>
        <text x={29} y={0} fg={theme.text.secondary}>{"r"}</text>
        <text x={30} y={0} fg={theme.text.primary}>{":refresh"}</text>
        <text x={39} y={0} fg={theme.border.subtle}>{"\u2502"}</text>
        <text x={41} y={0} fg={theme.text.secondary}>{"^P"}</text>
        <text x={43} y={0} fg={theme.text.primary}>{":cmd"}</text>
        <text x={48} y={0} fg={theme.border.subtle}>{"\u2502"}</text>
        <text x={50} y={0} fg={theme.text.secondary}>{"h"}</text>
        <text x={51} y={0} fg={theme.text.primary}>{":health"}</text>
        <text x={58} y={0} fg={theme.border.subtle}>{"\u2502"}</text>
        <text x={60} y={0} fg={theme.text.secondary}>{"q"}</text>
        <text x={61} y={0} fg={theme.text.primary}>{":quit"}</text>
      </box>


    </box>
  );
}

export async function launchTUI() {
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
          <AppShell repoPath={repoPath} />
        </GitProvider>
      </AppProvider>
    ),
    { exitOnCtrlC: true, useMouse: true },
  );
}
