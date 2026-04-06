import { createSignal, createEffect, on, onCleanup, For, Show } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { useGit } from "../context/GitContext.tsx";
import { GitWorktree } from "../../core/git.ts";
import { loadConfig, getRepoConfig, expandTemplate } from "../../core/config.ts";
import { copyFiles, linkFiles } from "../../core/files.ts";
import { executeHooks } from "../../core/hooks.ts";
import { writeFocus } from "../../core/focus.ts";
import { validateFocusPaths } from "../../core/monorepo.ts";
import { matchHooksForFocus, executeGlobHooks } from "../../core/glob-hooks.ts";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { basename, resolve } from "node:path";
import { toast } from "@opentui-ui/toast/solid";
import { theme } from "../themes.ts";
import { PopupShell } from "./PopupShell.tsx";

type StepStatus = "pending" | "running" | "done" | "error";
interface ProgressStep { label: string; status: StepStatus; message?: string; }

type Step = "input" | "preview" | "creating" | "done" | "error";

export function WorktreeCreate() {
  const app = useApp();
  const git = useGit();
  const dims = useTerminalDimensions();
  const [step, setStep] = createSignal<Step>("input");
  const [branchInput, setBranchInput] = createSignal("");
  const [focusInput, setFocusInput] = createSignal("");
  const [focusField, setFocusField] = createSignal<"branch" | "focus">("branch");
  const [resolvedPath, setResolvedPath] = createSignal("");
  const [progressSteps, setProgressSteps] = createSignal<ProgressStep[]>([]);
  const [statusMsg, setStatusMsg] = createSignal("");
  const [branches, setBranches] = createSignal<{ name: string; isRemote: boolean; lastCommitDate: string }[]>([]);
  const [branchPickerIdx, setBranchPickerIdx] = createSignal(-1);
  const [showPicker, setShowPicker] = createSignal(false);

  const filteredBranches = () => {
    const query = branchInput().toLowerCase();
    if (!query) return branches().slice(0, 10);
    return branches()
      .filter((b) => b.name.toLowerCase().includes(query))
      .slice(0, 10);
  };

  createEffect(on(() => activeRepoPath(), async () => {
    try {
      const repoPath = activeRepoPath();
      const branchList = await GitWorktree.listBranches(repoPath);
      setBranches(branchList);
    } catch {
      setBranches([]);
    }
  }));

  createEffect(on(branchInput, () => {
    setBranchPickerIdx(-1);
    setShowPicker(branchInput().length > 0 && filteredBranches().length > 0);
  }));

  createEffect(on(step, (currentStep) => {
    app.setInputFocused(currentStep === "input");
  }));

  onCleanup(() => {
    app.setInputFocused(false);
  });

  const updateStep = (index: number, updates: Partial<ProgressStep>) => {
    setProgressSteps(steps => steps.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const activeRepoPath = () => {
    const wts = git.worktrees() ?? [];
    const selectedPath = app.selectedWorktreePath();
    const selected = selectedPath
      ? wts.find((wt) => wt.path === selectedPath) ?? wts[app.selectedWorktreeIndex()]
      : wts[app.selectedWorktreeIndex()];
    return selected?.repoPath ?? app.repoPath();
  };

  const activeRepoName = () => {
    const wts = git.worktrees() ?? [];
    const selectedPath = app.selectedWorktreePath();
    const selected = selectedPath
      ? wts.find((wt) => wt.path === selectedPath) ?? wts[app.selectedWorktreeIndex()]
      : wts[app.selectedWorktreeIndex()];
    return selected?.repoName ?? app.repoPath().split("/").pop() ?? "";
  };

  const resolveTargetPath = () => {
    const branch = branchInput();
    if (!branch) return "";
    const repoPath = activeRepoPath();
    const config = loadConfig();
    const repoConfig = getRepoConfig(config, repoPath);
    const safeBranch = branch.replace(/\//g, "-");
    const repoName = basename(repoPath);
    return resolve(expandTemplate(repoConfig.worktreeDir, { repo: repoName, branch: safeBranch }));
  };

  useKeyboard(async (event: any) => {
    if (app.activeTab() !== "add") return;
    if (app.showCommandPalette()) return;
    const key = event.name;

    if (key === "escape") {
      if (step() === "preview") {
        setStep("input");
        return;
      }
      app.setActiveTab("list");
      setBranchInput("");
      setFocusInput("");
      setFocusField("branch");
      setStep("input");
      return;
    }

    if (step() === "input") {
      if (key === "tab") {
        if (showPicker() && focusField() === "branch") {
          setShowPicker(false);
          setBranchPickerIdx(-1);
        }
        setFocusField(f => f === "branch" ? "focus" : "branch");
        return;
      }
      if (focusField() === "branch" && showPicker() && filteredBranches().length > 0) {
        if (key === "down" || event.sequence === "\u001b[B") {
          setBranchPickerIdx((i) => Math.min(i + 1, filteredBranches().length - 1));
          return;
        }
        if (key === "up" || event.sequence === "\u001b[A") {
          setBranchPickerIdx((i) => Math.max(i - 1, -1));
          return;
        }
      }
      if (key === "return" || key === "enter") {
        if (focusField() === "branch" && branchPickerIdx() >= 0) {
          const selected = filteredBranches()[branchPickerIdx()];
          if (selected) {
            setBranchInput(selected.name);
            setShowPicker(false);
            setBranchPickerIdx(-1);
            return;
          }
        }
        if (!branchInput()) return;
        setShowPicker(false);
        setResolvedPath(resolveTargetPath());
        setStep("preview");
        return;
      }
    }

    if (step() === "preview") {
      if (key === "return" || key === "enter") {
        setStep("creating");
        const branch = branchInput();
        const wtPath = resolvedPath();
        const repoPath = activeRepoPath();
        const repoName = basename(repoPath);

        try {
          const config = loadConfig();
          const repoConfig = getRepoConfig(config, repoPath);

          const steps: ProgressStep[] = [
            { label: "Creating worktree", status: "pending" },
          ];
          if (repoConfig.autoUpstream) {
            steps.push({ label: "Setting upstream", status: "pending" });
          }
          if (repoConfig.copyFiles.length > 0) {
            steps.push({ label: "Copying files", status: "pending" });
          }
          if (repoConfig.linkFiles.length > 0) {
            steps.push({ label: "Creating symlinks", status: "pending" });
          }
          if (repoConfig.postCreate.length > 0) {
            steps.push({ label: "Running hooks", status: "pending" });
          }

          const rawFocus = focusInput();
          let focusPaths: string[] = [];
          if (rawFocus) {
            focusPaths = rawFocus.split(/[,\s]+/).map(f => f.trim()).filter(Boolean);
          }

          if (focusPaths.length > 0) {
            steps.push({ label: "Setting focus", status: "pending" });
          }
          if (focusPaths.length > 0 && repoConfig.monorepo?.hooks && repoConfig.monorepo.hooks.length > 0) {
            const preMatches = matchHooksForFocus(repoConfig.monorepo.hooks, focusPaths);
            if (preMatches.length > 0) {
              steps.push({ label: "Running monorepo hooks", status: "pending" });
            }
          }

          setProgressSteps(steps);

          let stepIdx = 0;

          // Creating worktree
          updateStep(stepIdx, { status: "running" });
          await GitWorktree.add(branch, wtPath, { createBranch: true }, repoPath);
          updateStep(stepIdx, { status: "done" });
          stepIdx++;

          // Setting upstream
          if (repoConfig.autoUpstream) {
            updateStep(stepIdx, { status: "running" });
            try {
              const remote = await GitWorktree.getDefaultRemote(repoPath);
              const exists = await GitWorktree.remoteBranchExists(branch, remote, repoPath);
              if (exists) {
                await GitWorktree.setUpstream(branch, remote, repoPath);
                updateStep(stepIdx, { status: "done", message: `→ ${remote}/${branch}` });
              } else {
                updateStep(stepIdx, { status: "done", message: "no remote branch" });
              }
            } catch (err) {
              updateStep(stepIdx, { status: "error", message: (err as Error).message });
            }
            stepIdx++;
          }

          // Copying files
          if (repoConfig.copyFiles.length > 0) {
            updateStep(stepIdx, { status: "running" });
            copyFiles(repoPath, wtPath, repoConfig.copyFiles);
            updateStep(stepIdx, { status: "done" });
            stepIdx++;
          }

          // Creating symlinks
          if (repoConfig.linkFiles.length > 0) {
            updateStep(stepIdx, { status: "running" });
            linkFiles(repoPath, wtPath, repoConfig.linkFiles);
            updateStep(stepIdx, { status: "done" });
            stepIdx++;
          }

          const hookEnv: Record<string, string> = {
            OMW_BRANCH: branch,
            OMW_WORKTREE_PATH: wtPath,
            OMW_REPO_PATH: repoPath,
          };

          // Running hooks
          if (repoConfig.postCreate.length > 0) {
            updateStep(stepIdx, { status: "running" });
            await executeHooks(repoConfig.postCreate, {
              cwd: wtPath,
              env: hookEnv,
              onOutput: (line) => updateStep(stepIdx, { message: line }),
            });
            updateStep(stepIdx, { status: "done" });
            stepIdx++;
          }

          // Setting focus
          if (focusPaths.length > 0) {
            updateStep(stepIdx, { status: "running" });
            const { valid } = validateFocusPaths(wtPath, focusPaths);
            focusPaths = valid;
            if (valid.length > 0) {
              writeFocus(wtPath, valid);
              hookEnv.OMW_FOCUS_PATHS = valid.join(",");
            }
            updateStep(stepIdx, { status: "done" });
            stepIdx++;
          }

          // Running monorepo hooks
          if (focusPaths.length > 0 && repoConfig.monorepo?.hooks && repoConfig.monorepo.hooks.length > 0) {
            updateStep(stepIdx, { status: "running" });
            const matches = matchHooksForFocus(repoConfig.monorepo.hooks, focusPaths);
            if (matches.length > 0) {
              await executeGlobHooks(matches, "postCreate", {
                cwd: wtPath,
                env: hookEnv,
                repo: repoName,
                branch,
                focusPaths,
                mainRepoPath: repoPath,
                onOutput: (line) => updateStep(stepIdx, { message: line }),
              });
            }
            updateStep(stepIdx, { status: "done" });
            stepIdx++;
          }

          setStatusMsg("Worktree created successfully!");
          setStep("done");
          toast.success(`Worktree created: ${branch}`);
          git.refetch();
          setTimeout(() => {
            app.setActiveTab("list");
            setBranchInput("");
            setFocusInput("");
            setFocusField("branch");
            setStep("input");
          }, 1500);
        } catch (err) {
          toast.error((err as Error).message);
          const currentSteps = progressSteps();
          const runningIdx = currentSteps.findIndex(s => s.status === "running");
          if (runningIdx >= 0) {
            updateStep(runningIdx, { status: "error", message: (err as Error).message });
          }
          setStatusMsg(`${(err as Error).message}`);
          setStep("error");
        }
        return;
      }
    }

    if (step() === "error") {
      if (key === "escape" || key === "return" || key === "enter") {
        setStep("input");
        setStatusMsg("");
      }
    }
  });

  const w = () => dims().width;
  const h = () => dims().height;
  const dialogW = () => Math.max(50, Math.min(80, w() - 4));
  const footerLines = 4;
  const dialogH = () => {
    if (step() === "input") {
      const pickerLines = showPicker() && focusField() === "branch" ? filteredBranches().length * 2 : 0;
      const pathLines = branchInput().length > 0 ? 4 : 0;
      return Math.max(21 + footerLines, Math.min(21 + footerLines + pickerLines + pathLines, h() - 4));
    }
    if (step() === "preview") {
      return Math.max(13 + footerLines, Math.min((focusInput().length > 0 ? 15 : 13) + footerLines, h() - 4));
    }
    if (step() === "creating") {
      return Math.max(9 + footerLines, Math.min(progressSteps().length * 2 + 7 + footerLines, h() - 4));
    }
    if (step() === "done") {
      return Math.max(11 + footerLines, Math.min((focusInput().length > 0 ? 15 : 13) + footerLines, h() - 4));
    }
    return Math.max(11 + footerLines, Math.min(11 + footerLines, h() - 4));
  };
  const contentW = () => Math.max(dialogW() - 4, 10);
  const inputFieldW = () => Math.max(contentW(), 20);

  return (
    <PopupShell
      width={dialogW()}
      height={dialogH()}
      borderColor={step() === "done" ? theme.text.success : step() === "error" ? theme.text.error : theme.border.active}
      backgroundColor={theme.bg.surface}
      gap={1}
      title=" Create Worktree "
      footer={(
        <>
          <box height={1} width={contentW()}>
            <text fg={theme.border.subtle}>
              {"\u2500".repeat(Math.max(contentW(), 1))}
            </text>
          </box>
          <Show when={step() === "input"}>
            <box flexDirection="row" gap={2}>
              <text fg={theme.text.secondary}>{"Tab:switch"}</text>
              <text fg={theme.text.secondary}>{"\u2191\u2193:pick"}</text>
              <text fg={theme.text.secondary}>{"Enter:confirm"}</text>
              <text fg={theme.text.secondary}>{"Esc:cancel"}</text>
            </box>
          </Show>
          <Show when={step() === "preview"}>
            <box flexDirection="row" gap={2}>
              <text fg={theme.text.secondary}>{"Enter:create"}</text>
              <text fg={theme.text.secondary}>{"Esc:back"}</text>
            </box>
          </Show>
          <Show when={step() === "creating"}>
            <text fg={theme.text.secondary}>Creating worktree...</text>
          </Show>
          <Show when={step() === "done"}>
            <text fg={theme.text.secondary}>{"\u2713 Done — returning to list"}</text>
          </Show>
          <Show when={step() === "error"}>
            <box flexDirection="row" gap={2}>
              <text fg={theme.text.secondary}>{"Enter:retry"}</text>
              <text fg={theme.text.secondary}>{"Esc:back"}</text>
            </box>
          </Show>
        </>
      )}
    >
        <Show when={step() === "input"}>
          <box height={1} width={contentW()} backgroundColor={theme.bg.elevated}>
            <text x={1} y={0} fg={theme.text.accent}>{">"}</text>
            <text x={3} y={0} fg={theme.text.primary}>New Worktree</text>
            <text x={17} y={0} fg={theme.text.secondary}>{activeRepoName()}</text>
          </box>

          <text fg={theme.border.subtle}>{"\u2500".repeat(contentW())}</text>

          <text fg={focusField() === "branch" ? theme.text.accent : theme.text.secondary}>Branch name</text>

          <input
            value={branchInput()}
            onInput={(value: string) => setBranchInput(value)}
            placeholder="Branch name or search..."
            focused={focusField() === "branch"}
            width={inputFieldW()}
            backgroundColor={theme.bg.elevated}
            cursorColor={theme.text.accent}
          />

          <Show when={showPicker() && focusField() === "branch" && filteredBranches().length > 0}>
            <For each={filteredBranches()}>
              {(b, idx) => (
                <box
                  height={1}
                  width={contentW()}
                  backgroundColor={idx() === branchPickerIdx() ? theme.select.focusedBg : theme.bg.surface}
                >
                  <text x={1} y={0}
                    fg={idx() === branchPickerIdx() ? theme.tab.active : theme.text.primary}>
                    {idx() === branchPickerIdx() ? "\u25B8 " : "  "}
                    {b.name}
                  </text>
                  <text x={Math.max(1 + b.name.length + 4, 27)} y={0} fg={theme.text.secondary}>
                    {b.isRemote ? "(remote) " : ""}{b.lastCommitDate}
                  </text>
                </box>
              )}
            </For>
          </Show>

          <text fg={theme.text.secondary}>{"Tab to switch fields \u00B7 \u2191\u2193 to select branch"}</text>

          <box width="100%" height={1} flexDirection="row">
            <text fg={focusField() === "focus" ? theme.text.accent : theme.text.secondary}>{"Focus "}</text>
            <text fg={theme.text.secondary}>{"(optional)"}</text>
          </box>

          <input
            value={focusInput()}
            onInput={(value: string) => setFocusInput(value)}
            placeholder="apps/web,apps/api (optional)"
            focused={focusField() === "focus"}
            width={inputFieldW()}
            backgroundColor={theme.bg.elevated}
            cursorColor={theme.text.accent}
          />

          <text fg={theme.text.secondary}>{"comma-separated paths, e.g. apps/web,apps/api"}</text>

          <Show when={branchInput().length > 0}>
            <text fg={theme.text.secondary}>Target path</text>
            <text fg={theme.text.primary}>{resolveTargetPath()}</text>
          </Show>

          <text fg={theme.text.primary}>Type a branch name, e.g. feature/my-feature</text>
        </Show>

        <Show when={step() === "preview"}>
          <box height={1} width={contentW()} backgroundColor={theme.bg.elevated}>
            <text x={1} y={0} fg={theme.text.accent}>{">"}</text>
            <text x={3} y={0} fg={theme.text.primary}>Confirm Worktree</text>
          </box>
          <text fg={theme.border.subtle}>{"\u2500".repeat(contentW())}</text>

          <box height={1} flexDirection="row">
            <box width={14} height={1}>
              <text fg={theme.text.secondary}>Branch</text>
            </box>
            <text fg={theme.text.accent}>{branchInput()}</text>
          </box>

          <box height={1} flexDirection="row">
            <box width={14} height={1}>
              <text fg={theme.text.secondary}>Path</text>
            </box>
            <text fg={theme.text.primary}>{resolvedPath()}</text>
          </box>

          <Show when={focusInput().length > 0}>
            <box height={1} flexDirection="row">
              <box width={14} height={1}>
                <text fg={theme.text.secondary}>Focus</text>
              </box>
              <text fg={theme.text.accent}>{focusInput()}</text>
            </box>
          </Show>

          <text fg={theme.text.success}>{"\u2713 Ready to create. Press Enter to confirm."}</text>
        </Show>

        <Show when={step() === "creating"}>
          <box height={1} width={contentW()} backgroundColor={theme.bg.elevated}>
            <text x={1} y={0} fg={theme.text.accent}>{">"}</text>
            <text x={3} y={0} fg={theme.text.primary}>Creating Worktree</text>
          </box>
          <text fg={theme.border.subtle}>{"\u2500".repeat(contentW())}</text>

          <For each={progressSteps()}>
            {(step) => (
              <box height={1}>
                <text fg={
                  step.status === "done" ? theme.text.success :
                  step.status === "running" ? theme.text.accent :
                  step.status === "error" ? theme.text.error :
                  theme.text.secondary
                }>
                  {step.status === "done" ? "\u2713" :
                   step.status === "running" ? "\u27F3" :
                   step.status === "error" ? "\u2717" :
                   "\u25CB"}{" "}{step.label}
                </text>
                <Show when={step.message}>
                  <text x={step.label.length + 4} y={0} fg={theme.text.secondary}>
                    {step.message}
                  </text>
                </Show>
              </box>
            )}
          </For>
        </Show>

        <Show when={step() === "done"}>
          <box height={1} width={contentW()} backgroundColor={theme.bg.elevated}>
            <text x={1} y={0} fg={theme.text.success}>{">"}</text>
            <text x={3} y={0} fg={theme.text.primary}>Worktree Created</text>
          </box>
          <text fg={theme.border.subtle}>{"\u2500".repeat(contentW())}</text>

          <box height={1} flexDirection="row">
            <box width={14} height={1}>
              <text fg={theme.text.secondary}>Branch</text>
            </box>
            <text fg={theme.text.accent}>{branchInput()}</text>
          </box>

          <box height={1} flexDirection="row">
            <box width={14} height={1}>
              <text fg={theme.text.secondary}>Path</text>
            </box>
            <text fg={theme.text.primary}>{resolvedPath()}</text>
          </box>

          <Show when={focusInput().length > 0}>
            <box height={1} flexDirection="row">
              <box width={14} height={1}>
                <text fg={theme.text.secondary}>Focus</text>
              </box>
              <text fg={theme.text.accent}>{focusInput()}</text>
            </box>
          </Show>

          <text fg={theme.text.success}>{"\u2713 "}{statusMsg()}</text>
        </Show>

        <Show when={step() === "error"}>
          <box height={1} width={contentW()} backgroundColor={theme.bg.elevated}>
            <text x={1} y={0} fg={theme.text.error}>{">"}</text>
            <text x={3} y={0} fg={theme.text.primary}>Error</text>
          </box>
          <text fg={theme.border.subtle}>{"\u2500".repeat(contentW())}</text>

          <text fg={theme.text.error}>{"\u2717 Failed"}</text>

          <box width={inputFieldW()} height={1} backgroundColor={theme.bg.elevated}>
            <text x={1} y={0} fg={theme.text.primary}>
              {statusMsg().slice(0, Math.max(inputFieldW() - 3, 10))}
            </text>
          </box>

          <text fg={theme.text.secondary}>Press Enter or Escape to try again</text>
        </Show>
    </PopupShell>
  );
}
