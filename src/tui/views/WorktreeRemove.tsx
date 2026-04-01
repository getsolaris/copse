import { createSignal, Show } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { useGit } from "../context/GitContext.tsx";
import { GitWorktree } from "../../core/git.ts";
import { loadConfig, getRepoConfig } from "../../core/config.ts";
import { executeHooks } from "../../core/hooks.ts";
import { useKeyboard } from "@opentui/solid";
import { theme } from "../themes.ts";

export function WorktreeRemove(props: { w: number; h: number }) {
  const app = useApp();
  const git = useGit();
  const [removing, setRemoving] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [confirmForce, setConfirmForce] = createSignal(false);

  const targetWorktree = () => {
    const wts = git.worktrees() ?? [];
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

      const currentIdx = app.selectedWorktreeIndex();
      if (currentIdx > 0) {
        app.setSelectedWorktreeIndex(currentIdx - 1);
      }

      git.refetch();
      setTimeout(closeDialog, 1000);
    } catch (err) {
      const errMsg = (err as Error).message;
      if (!force && errMsg.includes("dirty")) {
        setMessage("Worktree has changes. Press f to force remove.");
        setRemoving(false);
        setConfirmForce(true);
      } else {
        setMessage(`Failed: ${errMsg}`);
        setRemoving(false);
      }
    }
  };

  useKeyboard(async (event: any) => {
    if (!app.showRemove()) return;
    const key = event.name;
    if (key === "escape") { closeDialog(); return; }
    if (confirmForce() && (key === "return" || key === "enter")) { setConfirmForce(false); await doRemove(true); return; }
    if ((key === "return" || key === "enter") && !removing()) { await doRemove(false); }
  });

  const wt = () => targetWorktree();

  return (
    <box x={0} y={0} width={props.w} height={props.h} backgroundColor={theme.bg.base}>
      <box x={2} y={1} width={props.w - 3} height={props.h - 2} flexDirection="column" backgroundColor={theme.bg.base}>
        <box height={1}>
          <text x={0} y={0} fg={theme.text.error}>
            Remove Worktree
          </text>
        </box>

        <box height={1}>
          <text x={0} y={0} fg={theme.border.subtle}>
            {"\u2500".repeat(Math.max(props.w - 5, 10))}
          </text>
        </box>

        <box height={1} />

        <Show when={!!wt()}>
          <box height={1} flexDirection="row">
            <box width={14} height={1}><text x={0} y={0} fg={theme.text.secondary}>Branch</text></box>
            <text fg={theme.text.accent}>{wt()?.branch ?? "(detached)"}</text>
          </box>

          <box height={1} flexDirection="row">
            <box width={14} height={1}><text x={0} y={0} fg={theme.text.secondary}>Path</text></box>
            <text fg={theme.text.primary}>{wt()?.path}</text>
          </box>

          <box height={1} />

          <Show when={!removing() && !confirmForce()}>
            <box height={1}>
              <text x={0} y={0} fg={theme.text.secondary}>
                {"Enter:confirm  Esc:cancel"}
              </text>
            </box>
          </Show>

          <Show when={confirmForce()}>
            <box height={1}>
              <text x={0} y={0} fg={theme.text.warning}>{message()}</text>
            </box>
            <box height={1}>
              <text x={0} y={0} fg={theme.text.secondary}>{"Enter:force remove  Esc:cancel"}</text>
            </box>
          </Show>

          <Show when={removing()}>
            <box height={1}>
              <text x={0} y={0} fg={message().startsWith("Failed") ? theme.text.error : theme.text.success}>
                {message()}
              </text>
            </box>
          </Show>
        </Show>

        <Show when={!wt()}>
          <box height={1}>
            <text x={0} y={0} fg={theme.text.secondary}>No worktree selected.</text>
          </box>
        </Show>
      </box>
    </box>
  );
}
