import { createSignal, For, createMemo, Show } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { useGit } from "../context/GitContext.tsx";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import {
  theme,
  setCurrentThemeName,
  THEME_NAMES,
  THEME_LABELS,
  type ThemeName,
} from "../themes.ts";
import { PopupShell } from "./PopupShell.tsx";
import { loadConfig, getConfigPath, writeAtomically } from "../../core/config.ts";

interface Command {
  id: string;
  label: string;
  description: string;
  action: () => void;
}

export function CommandPalette() {
  const app = useApp();
  const git = useGit();
  const dims = useTerminalDimensions();
  const [query, setQuery] = createSignal("");
  const [selectedIdx, setSelectedIdx] = createSignal(0);

  const selectedWorktree = () => {
    const wts = git.worktrees() ?? [];
    const selectedPath = app.selectedWorktreePath();
    if (selectedPath) {
      const match = wts.find((wt) => wt.path === selectedPath);
      if (match) return match;
    }
    return wts[app.selectedWorktreeIndex()];
  };

  const detectEditor = (): string | null => {
    const envEditor = process.env.VISUAL || process.env.EDITOR;
    if (envEditor) return envEditor;
    const editors = ["code", "cursor", "vim", "nvim", "zed", "subl", "idea", "webstorm"] as const;
    for (const e of editors) {
      try {
        const proc = Bun.spawnSync(["which", e], { stdout: "pipe", stderr: "pipe" });
        if (proc.exitCode === 0) return e;
      } catch {
      }
    }
    return null;
  };

  const commands = createMemo<Command[]>(() => [
    {
      id: "add",
      label: "Add Worktree",
      description: "Create a new git worktree",
      action: () => {
        app.setActiveTab("add");
        app.setShowCommandPalette(false);
      },
    },
    {
      id: "delete",
      label: "Delete Worktree",
      description: "Remove the selected worktree",
      action: () => {
        const selected = selectedWorktree();
        if (!selected || selected.isMain) return;
        app.setShowRemove(true);
        app.setShowCommandPalette(false);
      },
    },
    {
      id: "open-editor",
      label: "Open in Editor",
      description: "Open selected worktree in IDE",
      action: () => {
        const selected = selectedWorktree();
        if (!selected) return;
        const editor = detectEditor();
        if (!editor) return;
        app.setShowCommandPalette(false);
        Bun.spawn([editor, selected.path], { stdout: "inherit", stderr: "inherit" });
      },
    },
    {
      id: "refresh",
      label: "Refresh",
      description: "Reload worktree list",
      action: () => {
        git.refetch();
        app.setShowCommandPalette(false);
      },
    },
    {
      id: "config",
      label: "Open Config",
      description: "View configuration",
      action: () => {
        app.setActiveTab("config");
        app.setShowCommandPalette(false);
      },
    },
    {
      id: "doctor",
      label: "Run Doctor",
      description: "Check worktree health",
      action: () => {
        app.setActiveTab("doctor");
        app.setShowCommandPalette(false);
      },
    },
    ...THEME_NAMES.map((name) => ({
      id: `theme:${name}`,
      label: `Theme: ${THEME_LABELS[name]}`,
      description: "Switch color theme",
      action: () => {
        setCurrentThemeName(name);
        try {
          const configPath = getConfigPath();
          const cfg: Record<string, unknown> = { ...loadConfig() };
          cfg.theme = name;
          writeAtomically(configPath, JSON.stringify(cfg, null, 2));
        } catch {}
        app.setShowCommandPalette(false);
      },
    })),
    {
      id: "quit",
      label: "Quit",
      description: "Exit oh-my-worktree",
      action: () => process.exit(0),
    },
  ]);

  const filtered = createMemo(() => {
    const q = query().toLowerCase();
    if (!q) return commands();
    return commands().filter(
      (c) => c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  });

  useKeyboard((event: any) => {
    if (!app.showCommandPalette()) return;
    const key = event.name;

    if (key === "escape") {
      app.setShowCommandPalette(false);
      setQuery("");
      setSelectedIdx(0);
      return;
    }
    if (key === "return" || key === "enter") {
      const cmd = filtered()[selectedIdx()];
      if (cmd) cmd.action();
      setQuery("");
      setSelectedIdx(0);
      return;
    }
    if (key === "down" || key === "j") {
      setSelectedIdx((i) => Math.min(i + 1, filtered().length - 1));
      return;
    }
    if (key === "up" || key === "k") {
      setSelectedIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (key === "backspace") {
      setQuery((s) => s.slice(0, -1));
      setSelectedIdx(0);
      return;
    }
    if (event.sequence && event.sequence.length === 1 && event.sequence.charCodeAt(0) >= 32) {
      setQuery((s) => s + event.sequence);
      setSelectedIdx(0);
    }
  });

  const dialogW = () => Math.max(50, Math.min(80, dims().width - 4));
  const dialogH = () => Math.max(10, Math.min(filtered().length + 8, dims().height - 4));
  const innerW = () => dialogW() - 4;
  const listH = () => dialogH() - 8;

  return (
    <PopupShell
      width={dialogW()}
      height={dialogH()}
      borderColor={theme.border.active}
      backgroundColor={theme.bg.surface}
      title=" Command Palette "
      footer={(
        <>
          <box height={1} width={innerW()}>
            <text fg={theme.border.subtle}>
              {"\u2500".repeat(Math.max(innerW(), 1))}
            </text>
          </box>

          <box flexDirection="row" gap={2}>
            <text fg={theme.text.secondary}>{"\u2191\u2193:navigate"}</text>
            <text fg={theme.text.secondary}>{"Enter:run"}</text>
            <text fg={theme.text.secondary}>{"Esc:close"}</text>
          </box>
        </>
      )}
    >
      <box
        height={1}
        width={innerW()}
        backgroundColor={theme.bg.elevated}
      >
        <text x={1} y={0} fg={theme.text.accent}>{">"}</text>
        <text x={3} y={0} fg={theme.text.primary}>{query()}</text>
        <text x={3 + query().length} y={0} fg={theme.text.accent}>{"\u2588"}</text>
      </box>

      <box height={1} width={innerW()}>
        <text fg={theme.border.subtle}>
          {"\u2500".repeat(Math.max(innerW(), 1))}
        </text>
      </box>

      <box
        width={innerW()}
        height={listH()}
        backgroundColor={theme.bg.surface}
        flexDirection="column"
      >
        <For each={filtered().slice(0, listH())}>
          {(cmd, i) => {
            const isSelected = () => i() === selectedIdx();
            return (
              <box
                height={1}
                width={innerW()}
                backgroundColor={isSelected() ? theme.select.focusedBg : theme.bg.surface}
                onMouseDown={() => {
                  setSelectedIdx(i());
                  cmd.action();
                }}
              >
                <text
                  x={2} y={0}
                  fg={isSelected() ? theme.tab.active : theme.text.primary}
                >
                  {cmd.label}
                </text>
                <text
                  x={Math.max(25, cmd.label.length + 4)} y={0}
                  fg={theme.text.secondary}
                >
                  {cmd.description}
                </text>
              </box>
            );
          }}
        </For>
        <Show when={filtered().length === 0}>
          <box height={1}>
            <text x={2} y={0} fg={theme.text.secondary}>No commands found</text>
          </box>
        </Show>
      </box>
    </PopupShell>
  );
}
