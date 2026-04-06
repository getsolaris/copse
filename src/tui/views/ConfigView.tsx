import { createSignal, For, Show } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { loadConfig, getConfigPath, initConfig } from "../../core/config.ts";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { spawnSync } from "node:child_process";
import { theme } from "../themes.ts";

export function ConfigView() {
  const app = useApp();
  const dims = useTerminalDimensions();
  const configPath = getConfigPath();

  const getConfig = () => {
    try {
      return loadConfig();
    } catch {
      return null;
    }
  };

  const [cfg, setCfg] = createSignal(getConfig());
  const [message, setMessage] = createSignal("");

  useKeyboard((event: any) => {
    if (app.activeTab() !== "config") return;
    if (app.showCommandPalette()) return;
    const key = event.name;
    if (key === "e") {
      const editor = process.env.EDITOR ?? process.env.VISUAL ?? "vi";
      initConfig();
      spawnSync(editor, [configPath], { stdio: "inherit" });
      setCfg(getConfig());
      setMessage("Config reloaded");
      setTimeout(() => setMessage(""), 2000);
    }
    if (key === "r") {
      setCfg(getConfig());
      setMessage("Reloaded");
      setTimeout(() => setMessage(""), 2000);
    }
    if (key === "i") {
      initConfig();
      setCfg(getConfig());
      setMessage("Config initialized");
      setTimeout(() => setMessage(""), 2000);
    }
  });

  const w = () => dims().width;
  const h = () => dims().height;

  return (
    <box x={0} y={0} width="100%" height="100%" backgroundColor={theme.bg.base} flexDirection="column">
      <box
        width="100%"
        height="100%"
        backgroundColor={theme.bg.surface}
        flexDirection="column"
        paddingX={2}
        paddingY={1}
      >
        <box height={1}>
          <text fg={theme.text.accent}><b>Configuration</b></text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text.secondary}>Path:</text>
          <text fg={theme.text.primary}>{configPath}</text>
        </box>

        <Show when={!cfg()}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.text.warning}>No config file found.</text>
            <box flexDirection="row" gap={1}>
              <text fg={theme.text.secondary}>Press</text>
              <text fg={theme.text.accent}>i</text>
              <text fg={theme.text.secondary}>to initialize with defaults.</text>
            </box>
          </box>
        </Show>

        <Show when={!!cfg()}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.text.accent}>Defaults</text>
            <box flexDirection="row">
              <box width={14}><text fg={theme.text.secondary}>worktreeDir</text></box>
              <text fg={theme.text.primary}>{cfg()?.defaults?.worktreeDir ?? "../{repo}-{branch}"}</text>
            </box>
            <box flexDirection="row">
              <box width={14}><text fg={theme.text.secondary}>copyFiles</text></box>
              <text fg={theme.text.primary}>[{(cfg()?.defaults?.copyFiles ?? []).join(", ")}]</text>
            </box>
            <box flexDirection="row">
              <box width={14}><text fg={theme.text.secondary}>linkFiles</text></box>
              <text fg={theme.text.primary}>[{(cfg()?.defaults?.linkFiles ?? []).join(", ")}]</text>
            </box>
            <box flexDirection="row">
              <box width={14}><text fg={theme.text.secondary}>postCreate</text></box>
              <text fg={theme.text.primary}>[{(cfg()?.defaults?.postCreate ?? []).join(", ")}]</text>
            </box>
          </box>

          <box><text fg={theme.border.subtle}>{"\u2500".repeat(Math.max(w() - 34, 10))}</text></box>

          <Show when={(cfg()?.repos?.length ?? 0) > 0}>
            <box flexDirection="column" gap={1}>
              <text fg={theme.text.accent}>Repos ({cfg()?.repos?.length})</text>
              <For each={cfg()?.repos?.slice(0, 4)}>
                {(repo) => (
                  <box flexDirection="column" gap={0}>
                    <text fg={theme.text.primary}>{repo.path.split("/").pop() ?? repo.path}</text>
                    <box flexDirection="row">
                      <box width={11}><text fg={theme.text.secondary}>copyFiles</text></box>
                      <text fg={theme.text.primary}>{(repo.copyFiles ?? []).length > 0 ? (repo.copyFiles ?? []).join(", ") : "\u2014"}</text>
                    </box>
                    <box flexDirection="row">
                      <box width={11}><text fg={theme.text.secondary}>postCreate</text></box>
                      <text fg={theme.text.primary}>{(repo.postCreate ?? []).length > 0 ? (repo.postCreate ?? []).join(", ") : "\u2014"}</text>
                    </box>
                  </box>
                )}
              </For>
            </box>
          </Show>

          <Show when={(cfg()?.repos?.length ?? 0) === 0}>
            <text fg={theme.text.secondary}>No per-repo configs defined.</text>
          </Show>
        </Show>

        <Show when={!!message()}>
          <text fg={theme.text.success}>{message()}</text>
        </Show>
      </box>

      <box width="100%" height={1} backgroundColor={theme.bg.base} flexDirection="row" gap={2}>
        <box flexDirection="row"><text fg={theme.text.secondary}>e</text><text fg={theme.text.primary}>:edit</text></box>
        <box flexDirection="row"><text fg={theme.text.secondary}>r</text><text fg={theme.text.primary}>:reload</text></box>
        <box flexDirection="row"><text fg={theme.text.secondary}>i</text><text fg={theme.text.primary}>:init</text></box>
      </box>
    </box>
  );
}
