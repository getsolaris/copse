import { createSignal, createMemo, For, Show } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { useApp } from "../context/AppContext.tsx";
import { useToast } from "../context/ToastContext.tsx";
import { theme } from "../themes.ts";
import { PopupShell } from "./PopupShell.tsx";

const ROOT_OPTION = "__root__";

interface FocusPickerProps {
  detectEditor: () => string | null;
}

export function FocusPicker(props: FocusPickerProps) {
  const app = useApp();
  const toast = useToast();
  const [selectedIdx, setSelectedIdx] = createSignal(0);

  const data = () => app.focusPickerData();

  const items = createMemo(() => {
    const d = data();
    if (!d) return [] as { label: string; value: string }[];
    return [
      ...d.focusPaths.map((p) => ({ label: p, value: p })),
      { label: "Worktree root", value: ROOT_OPTION },
    ];
  });

  const close = () => {
    app.setFocusPickerData(null);
    setSelectedIdx(0);
  };

  const openPath = (target: string) => {
    const editor = props.detectEditor();
    if (!editor) {
      toast.addToast({
        message: "No editor detected. Set $VISUAL or $EDITOR.",
        type: "error",
      });
      close();
      return;
    }
    if (!existsSync(target)) {
      toast.addToast({
        message: `Path does not exist: ${target}`,
        type: "error",
      });
      close();
      return;
    }
    Bun.spawn([editor, target], { stdout: "inherit", stderr: "inherit" });
    close();
  };

  const select = () => {
    const d = data();
    const list = items();
    if (!d || list.length === 0) return;
    const choice = list[selectedIdx()];
    if (!choice) return;
    if (choice.value === ROOT_OPTION) {
      openPath(d.worktreePath);
    } else {
      openPath(join(d.worktreePath, choice.value));
    }
  };

  useKeyboard((event: any) => {
    if (!data()) return;
    if (app.showUpdatePrompt()) return;
    const key = event.name;
    if (key === "escape") {
      close();
      return;
    }
    const list = items();
    if (key === "down" || key === "j" || event.sequence === "\u001b[B") {
      setSelectedIdx((i) => Math.min(i + 1, list.length - 1));
      return;
    }
    if (key === "up" || key === "k" || event.sequence === "\u001b[A") {
      setSelectedIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (key === "return" || key === "enter") {
      select();
      return;
    }
  });

  return (
    <Show when={data()}>
      <PopupShell
        title=" Open Focus "
        width={50}
        height={Math.min(items().length + 6, 14)}
        backdrop
      >
        <box height={1}>
          <text fg={theme.text.secondary}>
            {"Multiple focus paths set. Pick one to open:"}
          </text>
        </box>
        <box height={1} />
        <For each={items()}>
          {(item, idx) => (
            <box height={1} flexDirection="row">
              <text
                fg={
                  idx() === selectedIdx()
                    ? theme.text.accent
                    : item.value === ROOT_OPTION
                      ? theme.text.secondary
                      : theme.text.primary
                }
              >
                {idx() === selectedIdx() ? "\u276F " : "  "}
                {item.label}
              </text>
            </box>
          )}
        </For>
        <box height={1} />
        <box height={1}>
          <text fg={theme.text.secondary}>
            {"j/k:nav  enter:open  esc:cancel"}
          </text>
        </box>
      </PopupShell>
    </Show>
  );
}
