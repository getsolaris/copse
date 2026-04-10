import { createSignal, For, Show } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { useToast } from "../context/ToastContext.tsx";
import { useGit } from "../context/GitContext.tsx";
import { GitWorktree, invalidateGitCache } from "../../core/git.ts";
import { loadConfig, getRepoConfig } from "../../core/config.ts";
import { executeHooks } from "../../core/hooks.ts";
import { useKeyboard } from "@opentui/solid";
import { theme } from "../themes.ts";

type BulkState = "confirming" | "executing" | "done" | "error";

export function BulkActions(props: { w: number; h: number }) {
  const app = useApp();
  const git = useGit();
  const toast = useToast();
  const [state, setState] = createSignal<BulkState>("confirming");
  const [message, setMessage] = createSignal("");
  const [progress, setProgress] = createSignal(0);

  const selectedBranches = () => {
    const wts = git.worktrees() ?? [];
    const selected = app.selectedWorktrees();
    const branches: { branch: string; path: string; repoPath: string }[] = [];
    for (const path of selected) {
      const wt = wts.find((candidate) => candidate.path === path);
      if (wt && !wt.isMain) {
        branches.push({
          branch: wt.branch ?? "(detached)",
          path: wt.path,
          repoPath: wt.repoPath,
        });
      }
    }
    return branches;
  };

  const closeDialog = () => {
    app.setShowBulkActions(false);
    setState("confirming");
    setMessage("");
    setProgress(0);
  };

  const doDeleteAll = async () => {
    const targets = selectedBranches();
    if (targets.length === 0) { closeDialog(); return; }
    setState("executing");
    setProgress(0);

    const errors: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      setMessage(`Removing ${t.branch} (${i + 1}/${targets.length})...`);
      setProgress(i);
      try {
        const config = loadConfig();
        const repoConfig = getRepoConfig(config, t.repoPath);
        if (repoConfig.postRemove.length > 0) {
          await executeHooks(repoConfig.postRemove, {
            cwd: t.path,
            env: {
              COPSE_BRANCH: t.branch,
              COPSE_WORKTREE_PATH: t.path,
              COPSE_REPO_PATH: t.repoPath,
            },
          }).catch(() => {});
        }
        await GitWorktree.remove(t.path, { force: false }, t.repoPath);
      } catch (err) {
        errors.push(`${t.branch}: ${(err as Error).message}`);
      }
    }

    invalidateGitCache();
    app.clearSelection();
    app.setSelectedWorktreeIndex(0);
    app.setSelectedWorktreePath(null);
    git.refetch();

    if (errors.length > 0) {
      setState("error");
      setMessage(`Failed: ${errors.join("; ")}`);
      toast.addToast({ message: `Failed to remove ${errors.length} worktree(s)`, type: "error" });
      setTimeout(closeDialog, 3000);
    } else {
      setState("done");
      setMessage(`Removed ${targets.length} worktree(s) successfully!`);
      toast.addToast({ message: `Removed ${targets.length} worktrees`, type: "success" });
      setTimeout(closeDialog, 1500);
    }
  };

  useKeyboard(async (event: any) => {
    if (!app.showBulkActions()) return;
    if (app.showCommandPalette()) return;
    const key = event.name;
    if (state() === "executing") return;
    if (key === "escape") { closeDialog(); return; }
    if ((key === "return" || key === "enter") && state() === "confirming") {
      await doDeleteAll();
    }
  });

  const total = () => selectedBranches().length;

  return (
    <box x={0} y={0} width={props.w} height={props.h} backgroundColor={theme.bg.base}>
      <box x={2} y={1} width={props.w - 3} height={props.h - 2} flexDirection="column" backgroundColor={theme.bg.base}>
        <box height={1}>
          <text x={0} y={0} fg={theme.text.error}>
            Bulk Delete Worktrees
          </text>
        </box>

        <box height={1}>
          <text x={0} y={0} fg={theme.border.subtle}>
            {"\u2500".repeat(Math.max(props.w - 5, 10))}
          </text>
        </box>

        <box height={1} />

        <Show when={state() === "confirming"}>
          <box height={1}>
            <text x={0} y={0} fg={theme.text.warning}>
              {`Delete ${total()} worktree(s)?`}
            </text>
          </box>

          <box height={1} />

          <For each={selectedBranches().slice(0, Math.max(props.h - 10, 5))}>
            {(item) => (
              <box height={1}>
                <text x={2} y={0} fg={theme.text.accent}>
                  {`\u2022 ${item.branch}`}
                </text>
              </box>
            )}
          </For>

          <Show when={total() > Math.max(props.h - 10, 5)}>
            <box height={1}>
              <text x={2} y={0} fg={theme.text.secondary}>
                {`... and ${total() - Math.max(props.h - 10, 5)} more`}
              </text>
            </box>
          </Show>

          <box height={1} />

          <box height={1}>
            <text x={0} y={0} fg={theme.text.secondary}>
              {"Enter:delete all  Esc:cancel"}
            </text>
          </box>
        </Show>

        <Show when={state() === "executing"}>
          <box height={1}>
            <text x={0} y={0} fg={theme.text.warning}>
              {message()}
            </text>
          </box>
          <box height={1}>
            <text x={0} y={0} fg={theme.text.secondary}>
              {`Progress: ${progress() + 1}/${total()}`}
            </text>
          </box>
        </Show>

        <Show when={state() === "done"}>
          <box height={1}>
            <text x={0} y={0} fg={theme.text.success}>
              {message()}
            </text>
          </box>
        </Show>

        <Show when={state() === "error"}>
          <box height={1}>
            <text x={0} y={0} fg={theme.text.error}>
              {message()}
            </text>
          </box>
        </Show>
      </box>
    </box>
  );
}
