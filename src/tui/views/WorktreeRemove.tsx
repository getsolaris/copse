import { createSignal, Show } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { useGit } from "../context/GitContext.tsx";
import { GitWorktree } from "../../core/git.ts";
import { loadConfig, getRepoConfig } from "../../core/config.ts";
import { executeHooks } from "../../core/hooks.ts";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { toast } from "@opentui-ui/toast/solid";
import { theme } from "../themes.ts";
import { PopupShell } from "./PopupShell.tsx";

export function WorktreeRemove() {
  const app = useApp();
  const git = useGit();
  const dims = useTerminalDimensions();
  const [removing, setRemoving] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [confirmForce, setConfirmForce] = createSignal(false);

  const targetWorktree = () => {
    const wts = git.worktrees() ?? [];
    const selectedPath = app.selectedWorktreePath();
    if (selectedPath) {
      const match = wts.find((wt) => wt.path === selectedPath);
      if (match) return match;
    }
    return wts[app.selectedWorktreeIndex()];
  };

  const closeDialog = () => {
    app.setShowRemove(false);
    setRemoving(false);
    setMessage("");
    setConfirmForce(false);
  };

  const doRemove = async (force: boolean) => {
    const wt = targetWorktree();
    if (!wt) { closeDialog(); return; }
    setRemoving(true);
    setMessage("Removing...");
    try {
      const config = loadConfig();
      const repoConfig = getRepoConfig(config, wt.repoPath);
      if (repoConfig.postRemove.length > 0) {
        setMessage("Running postRemove hooks...");
        await executeHooks(repoConfig.postRemove, {
          cwd: wt.path,
          env: {
            OMW_BRANCH: wt.branch ?? "",
            OMW_WORKTREE_PATH: wt.path,
            OMW_REPO_PATH: wt.repoPath,
          },
        }).catch(() => {});
      }

      await GitWorktree.remove(wt.path, { force }, wt.repoPath);
      setMessage("Removed successfully!");
      toast.success("Worktree removed");

      const wts = git.worktrees() ?? [];
      const currentIdx = app.selectedWorktreeIndex();
      const fallbackWt = wts[currentIdx - 1] ?? wts[currentIdx + 1] ?? null;
      if (currentIdx > 0) {
        app.setSelectedWorktreeIndex(currentIdx - 1);
      } else {
        app.setSelectedWorktreeIndex(0);
      }
      app.setSelectedWorktreePath(fallbackWt?.path ?? null);

      git.refetch();
      setTimeout(closeDialog, 1000);
    } catch (err) {
      const errMsg = (err as Error).message;
      if (!force && errMsg.includes("dirty")) {
        setMessage("Worktree has changes. Press Enter to force remove.");
        setRemoving(false);
        setConfirmForce(true);
      } else {
        setMessage(`Failed: ${errMsg}`);
        setRemoving(false);
        toast.error(`Failed: ${errMsg}`);
      }
    }
  };

  useKeyboard(async (event: any) => {
    if (!app.showRemove()) return;
    if (app.showCommandPalette()) return;
    const key = event.name;
    if (key === "escape") { closeDialog(); return; }
    if (confirmForce() && (key === "return" || key === "enter")) { setConfirmForce(false); await doRemove(true); return; }
    if ((key === "return" || key === "enter") && !removing()) { await doRemove(false); }
  });

  const wt = () => targetWorktree();
  const dialogW = () => Math.max(50, Math.min(80, dims().width - 4));
  const dialogH = () => 10;

  return (
    <PopupShell
      width={dialogW()}
      height={dialogH()}
      borderColor={theme.border.active}
      backgroundColor={theme.bg.elevated}
      gap={1}
      title=" Remove Worktree "
      backdrop={true}
      footer={(
        <box flexDirection="column">
          <Show when={!removing() && !confirmForce()}>
            <box height={1} flexDirection="row" gap={2}>
              <text fg={theme.text.secondary}>[Enter] Confirm</text>
              <text fg={theme.text.secondary}>[Esc] Cancel</text>
            </box>
          </Show>

          <Show when={confirmForce()}>
            <box height={1} flexDirection="row" gap={2}>
              <text fg={theme.text.secondary}>[Enter] Force remove</text>
              <text fg={theme.text.secondary}>[Esc] Cancel</text>
            </box>
          </Show>
        </box>
      )}
    >
        <Show when={!!wt()}>
          <box height={1} flexDirection="row">
            <box width={10} height={1}><text fg={theme.text.secondary}>Branch</text></box>
            <text fg={theme.text.accent}>{wt()?.branch ?? "(detached)"}</text>
          </box>

          <box height={1} flexDirection="row">
            <box width={10} height={1}><text fg={theme.text.secondary}>Path</text></box>
            <text fg={theme.text.primary}>{wt()?.path}</text>
          </box>

          <Show when={confirmForce()}>
            <text fg={theme.text.warning}>{message()}</text>
          </Show>

          <Show when={removing()}>
            <text fg={message().startsWith("Failed") ? theme.text.error : theme.text.success}>
              {message()}
            </text>
          </Show>
        </Show>

        <Show when={!wt()}>
          <text fg={theme.text.secondary}>No worktree selected.</text>
        </Show>
    </PopupShell>
  );
}
