import { For } from "solid-js";
import { theme } from "../themes.ts";

const HELP_ROWS = [
  ["q", "Quit"],
  ["j/k", "Navigate list"],
  ["a", "Add worktree"],
  ["d", "Delete worktree"],
  ["o", "Open folder"],
  ["t", "Open in Terminal"],
  ["r", "Refresh list"],
] as const;

export function ShortcutHelp(props: { width: number; height: number }) {
  const panelW = () => Math.max(40, Math.min(60, props.width - 4));

  return (
    <box
      x={Math.max(0, Math.floor((props.width - panelW()) / 2))}
      y={Math.max(0, Math.floor((props.height - 16) / 2))}
      width={panelW()}
      height={16}
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
      <For each={HELP_ROWS}>
        {([keyName, label]) => (
          <box height={1}>
            <text x={1} fg={theme.text.secondary}>{keyName}</text>
            <text x={8} fg={theme.text.primary}>{label}</text>
          </box>
        )}
      </For>
      <box height={1} />
      <box height={1}><text x={1} fg={theme.text.secondary}>Ctrl+P</text><text x={8} fg={theme.text.primary}>Command palette</text></box>
      <box height={1}><text x={1} fg={theme.text.secondary}>?</text><text x={8} fg={theme.text.primary}>Toggle help</text></box>
      <box height={1} />
      <box height={1}><text x={1} fg={theme.text.accent}>Press ? to close</text></box>
    </box>
  );
}
