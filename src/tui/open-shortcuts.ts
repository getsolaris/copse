import { buildFileManagerCommand, buildTerminalCommand } from "../core/open.ts";
import type { Worktree } from "../core/types.ts";

export type OpenShortcutKey = "o" | "f" | "t";

export interface OpenShortcutCommandInput {
  readonly key: OpenShortcutKey;
  readonly selectedWorktree: Pick<Worktree, "path">;
  readonly terminalCommand?: string;
  readonly terminalProgram?: string;
  readonly platform?: NodeJS.Platform;
}

const MAC_TERMINAL_APPS_BY_PROGRAM: Record<string, string> = {
  Apple_Terminal: "Terminal",
  ghostty: "Ghostty",
  iTerm: "iTerm",
  "iTerm.app": "iTerm",
  WezTerm: "WezTerm",
  wezterm: "WezTerm",
} as const;

export function resolveOpenShortcutCommand(input: OpenShortcutCommandInput): string[] {
  const platform = input.platform ?? process.platform;

  switch (input.key) {
    case "o":
    case "f":
      return buildFileManagerCommand(input.selectedWorktree.path, platform);
    case "t":
      const terminalCommand = input.terminalCommand ?? inferMacTerminalApp({
        platform,
        terminalProgram: input.terminalProgram,
      });
      return buildTerminalCommand(
        input.selectedWorktree.path,
        terminalCommand,
        platform,
      );
    default:
      return assertNever(input.key);
  }
}

interface MacTerminalAppInput {
  readonly platform: NodeJS.Platform;
  readonly terminalProgram?: string;
}

function inferMacTerminalApp(input: MacTerminalAppInput): string | undefined {
  if (input.platform !== "darwin") return undefined;
  if (!input.terminalProgram) return undefined;
  return MAC_TERMINAL_APPS_BY_PROGRAM[input.terminalProgram];
}

function assertNever(value: never): never {
  throw new Error(`Unhandled open shortcut: ${value}`);
}
