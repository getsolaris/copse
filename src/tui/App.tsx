import { render } from "@opentui/solid";
import "@opentui-ui/toast/solid";
import { resolve } from "node:path";
import { GitWorktree } from "../core/git.ts";
import { getConfiguredRepoPaths, loadConfig } from "../core/config.ts";
import { AppProvider } from "./context/AppContext.tsx";
import { GitProvider } from "./context/GitContext.tsx";
import { ToastProvider } from "./context/ToastContext.tsx";
import { AppShell } from "./AppShell.tsx";
import { setCurrentThemeName, THEME_NAMES, type ThemeName } from "./themes.ts";

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

export async function launchTUI() {
  if (process.stdout.isTTY) {
    process.stdout.write("\u001b]0;Copse\u0007");
  }

  let gitRepoPath: string | null = null;
  try {
    gitRepoPath = await GitWorktree.getMainRepoPath();
  } catch {}

  let configuredPaths: string[] = [];
  let configuredTheme: string | undefined;
  try {
    const cfg = loadConfig();
    configuredPaths = getConfiguredRepoPaths(cfg);
    configuredTheme = cfg.theme;
  } catch {}

  const repoPath = gitRepoPath ?? configuredPaths[0] ?? process.cwd();

  const repoPaths = [repoPath];
  const seen = new Set([resolve(repoPath)]);
  for (const p of configuredPaths) {
    const resolved = resolve(p);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      repoPaths.push(p);
    }
  }

  if (configuredTheme && THEME_NAMES.includes(configuredTheme as ThemeName)) {
    setCurrentThemeName(configuredTheme as ThemeName);
  }

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
