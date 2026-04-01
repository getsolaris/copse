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
    <box x={0} y={0} width={w()} height={h()} backgroundColor={theme.bg.base}>
      <box
        x={1}
        y={0}
        width={w() - 2}
        height={h() - 3}
        border={true}
        borderStyle="single"
        borderColor={theme.border.default}
        backgroundColor={theme.bg.surface}
        title=" Configuration "
        titleAlignment="left"
      >
        <text x={2} y={1} fg={theme.text.secondary}>
          {"Path: "}
        </text>
        <text x={8} y={1} fg={theme.text.primary}>
          {configPath}
        </text>

        <Show when={!cfg()}>
          <text x={2} y={3} fg={theme.text.warning}>
            No config file found.
          </text>
          <text x={2} y={4} fg={theme.text.secondary}>
            {"Press "}
          </text>
          <text x={8} y={4} fg={theme.text.accent}>
            i
          </text>
          <text x={9} y={4} fg={theme.text.secondary}>
            {" to initialize with defaults."}
          </text>
        </Show>

        <Show when={!!cfg()}>
          <text x={2} y={3} fg={theme.text.accent}>
            Defaults
          </text>
          <text x={2} y={4} fg={theme.text.secondary}>
            {"  worktreeDir  "}
          </text>
          <text x={16} y={4} fg={theme.text.primary}>
            {cfg()?.defaults?.worktreeDir ?? "../{repo}-{branch}"}
          </text>
          <text x={2} y={5} fg={theme.text.secondary}>
            {"  copyFiles    "}
          </text>
          <text x={16} y={5} fg={theme.text.primary}>
            [{(cfg()?.defaults?.copyFiles ?? []).join(", ")}]
          </text>
          <text x={2} y={6} fg={theme.text.secondary}>
            {"  linkFiles    "}
          </text>
          <text x={16} y={6} fg={theme.text.primary}>
            [{(cfg()?.defaults?.linkFiles ?? []).join(", ")}]
          </text>
          <text x={2} y={7} fg={theme.text.secondary}>
            {"  postCreate   "}
          </text>
          <text x={16} y={7} fg={theme.text.primary}>
            [{(cfg()?.defaults?.postCreate ?? []).join(", ")}]
          </text>

          <Show when={(cfg()?.repos?.length ?? 0) > 0}>
            <text x={2} y={9} fg={theme.text.accent}>
              Repos ({cfg()?.repos?.length})
            </text>
            <For each={cfg()?.repos?.slice(0, 4)}>
              {(repo, i) => {
                const baseY = () => 10 + i() * 4;
                return (
                  <>
                    <text x={4} y={baseY()} fg={theme.text.primary}>
                      {repo.path.split("/").pop() ?? repo.path}
                    </text>
                    <text x={6} y={baseY() + 1} fg={theme.text.secondary}>
                      {"copyFiles  "}
                    </text>
                    <text x={17} y={baseY() + 1} fg={theme.text.primary}>
                      {(repo.copyFiles ?? []).length > 0 ? (repo.copyFiles ?? []).join(", ") : "\u2014"}
                    </text>
                    <text x={6} y={baseY() + 2} fg={theme.text.secondary}>
                      {"postCreate "}
                    </text>
                    <text x={17} y={baseY() + 2} fg={theme.text.primary}>
                      {(repo.postCreate ?? []).length > 0 ? (repo.postCreate ?? []).join(", ") : "\u2014"}
                    </text>
                  </>
                );
              }}
            </For>
          </Show>
          <Show when={(cfg()?.repos?.length ?? 0) === 0}>
            <text x={2} y={9} fg={theme.text.secondary}>
              No per-repo configs defined.
            </text>
          </Show>
        </Show>

        <Show when={!!message()}>
          <text x={2} y={h() - 6} fg={theme.text.success}>
            {message()}
          </text>
        </Show>
      </box>

      <box x={1} y={h() - 3} width={w() - 2} height={1} backgroundColor={theme.bg.base}>
        <text x={1} y={0} fg={theme.text.secondary}>
          e
        </text>
        <text x={2} y={0} fg={theme.text.primary}>
          {":edit  "}
        </text>
        <text x={9} y={0} fg={theme.text.secondary}>
          r
        </text>
        <text x={10} y={0} fg={theme.text.primary}>
          {":reload  "}
        </text>
        <text x={20} y={0} fg={theme.text.secondary}>
          i
        </text>
        <text x={21} y={0} fg={theme.text.primary}>
          :init
        </text>
      </box>
    </box>
  );
}
