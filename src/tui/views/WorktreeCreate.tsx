import { createSignal, For, Show } from "solid-js";
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
import { theme } from "../themes.ts";

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

  const updateStep = (index: number, updates: Partial<ProgressStep>) => {
    setProgressSteps(steps => steps.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const activeRepoPath = () => {
    const wts = git.worktrees() ?? [];
    const selected = wts[app.selectedWorktreeIndex()];
    return selected?.repoPath ?? app.repoPath();
  };

  const activeRepoName = () => {
    const wts = git.worktrees() ?? [];
    const selected = wts[app.selectedWorktreeIndex()];
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
        setFocusField(f => f === "branch" ? "focus" : "branch");
        return;
      }
      if (key === "return" || key === "enter") {
        if (!branchInput()) return;
        setResolvedPath(resolveTargetPath());
        setStep("preview");
        return;
      }
      if (key === "backspace") {
        if (focusField() === "branch") {
          setBranchInput((s) => s.slice(0, -1));
        } else {
          setFocusInput((s) => s.slice(0, -1));
        }
        return;
      }
      if (event.sequence === "\x15" || (event.ctrl && key === "u")) {
        if (focusField() === "branch") setBranchInput("");
        else setFocusInput("");
        return;
      }
      if (event.sequence === "\x17" || (event.ctrl && key === "w")) {
        if (focusField() === "branch") setBranchInput((s) => s.replace(/\S+\s*$/, ""));
        else setFocusInput((s) => s.replace(/\S+\s*$/, ""));
        return;
      }
      if (event.sequence && event.sequence.length === 1 && event.sequence.charCodeAt(0) >= 32) {
        if (focusField() === "branch") setBranchInput((s) => s + event.sequence);
        else setFocusInput((s) => s + event.sequence);
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
          git.refetch();
          setTimeout(() => {
            app.setActiveTab("list");
            setBranchInput("");
            setFocusInput("");
            setFocusField("branch");
            setStep("input");
          }, 1500);
        } catch (err) {
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
  const inputFieldW = () => Math.max(w() - 10, 20);

  return (
    <box x={0} y={0} width={w()} height={h()} backgroundColor={theme.bg.base}>
      <box
        x={1} y={0}
        width={w() - 2} height={h() - 2}
        flexDirection="column"
        border={true} borderStyle="single"
        borderColor={step() === "done" ? theme.text.success : step() === "error" ? theme.text.error : theme.border.default}
        backgroundColor={theme.bg.surface}
        title=" Create Worktree "
        titleAlignment="left"
      >
        <Show when={step() === "input"}>
          <box height={1} />

          <box height={1}>
            <text x={3} y={0} fg={theme.text.accent}>
              {"\u25B6 New Worktree"}
            </text>
            <text x={18} y={0} fg={theme.text.secondary}>
              {"in "}{activeRepoName()}
            </text>
          </box>

          <box height={1}>
            <text x={3} y={0} fg={theme.border.subtle}>
              {"\u2500".repeat(Math.max(w() - 10, 10))}
            </text>
          </box>

          <box height={1} />

          <box height={1}>
            <text x={3} y={0} fg={theme.text.secondary}>
              Branch name
            </text>
          </box>

          <box height={1}>
            <box x={3} y={0} width={inputFieldW()} height={1}
                 backgroundColor={focusField() === "branch" ? theme.bg.elevated : theme.bg.surface}>
              <text x={1} y={0} fg={theme.text.primary}>
                {branchInput()}
              </text>
              <Show when={focusField() === "branch"}>
                <text x={branchInput().length + 1} y={0} fg={theme.text.accent}>
                  {"\u2588"}
                </text>
              </Show>
            </box>
          </box>

          <box height={1}>
            <text x={3} y={0} fg={theme.border.subtle}>
              {"Tab to switch fields"}
            </text>
          </box>

          <box height={1}>
            <text x={3} y={0} fg={theme.text.secondary}>
              {"Focus "}
            </text>
            <text x={9} y={0} fg={theme.border.subtle}>
              {"(optional)"}
            </text>
          </box>

          <box height={1}>
            <box x={3} y={0} width={inputFieldW()} height={1}
                 backgroundColor={focusField() === "focus" ? theme.bg.elevated : theme.bg.surface}>
              <text x={1} y={0} fg={theme.text.primary}>
                {focusInput()}
              </text>
              <Show when={focusField() === "focus"}>
                <text x={focusInput().length + 1} y={0} fg={theme.text.accent}>
                  {"\u2588"}
                </text>
              </Show>
            </box>
          </box>

          <box height={1}>
            <text x={4} y={0} fg={theme.border.subtle}>
              {"comma-separated paths, e.g. apps/web,apps/api"}
            </text>
          </box>

          <Show when={branchInput().length > 0}>
            <box height={1}>
              <text x={3} y={0} fg={theme.text.secondary}>
                Target path
              </text>
            </box>
            <box height={1}>
              <text x={3} y={0} fg={theme.text.primary}>
                {resolveTargetPath()}
              </text>
            </box>
            <box height={1} />
          </Show>

          <box height={1}>
            <text x={3} y={0} fg={theme.text.secondary}>
              Type a branch name, e.g. feature/my-feature
            </text>
          </box>
        </Show>

        <Show when={step() === "preview"}>
          <box height={1} />

          <box height={1}>
            <text x={3} y={0} fg={theme.text.accent}>
              {"\u25B6 Confirm Worktree"}
            </text>
          </box>

          <box height={1}>
            <text x={3} y={0} fg={theme.border.subtle}>
              {"\u2500".repeat(Math.max(w() - 10, 10))}
            </text>
          </box>

          <box height={1} />

          <box height={1} flexDirection="row">
            <box width={14} height={1}>
              <text x={3} y={0} fg={theme.text.secondary}>Branch</text>
            </box>
            <text fg={theme.text.accent}>{branchInput()}</text>
          </box>

          <box height={1} flexDirection="row">
            <box width={14} height={1}>
              <text x={3} y={0} fg={theme.text.secondary}>Path</text>
            </box>
            <text fg={theme.text.primary}>{resolvedPath()}</text>
          </box>

          <Show when={focusInput().length > 0}>
            <box height={1} flexDirection="row">
              <box width={14} height={1}>
                <text x={3} y={0} fg={theme.text.secondary}>Focus</text>
              </box>
              <text fg={theme.text.accent}>{focusInput()}</text>
            </box>
          </Show>

          <box height={1} />

          <box height={1}>
            <text x={3} y={0} fg={theme.text.success}>
              {"\u2713 Ready to create. Press Enter to confirm."}
            </text>
          </box>
        </Show>

        <Show when={step() === "creating"}>
          <box height={1} />

          <box height={1}>
            <text x={3} y={0} fg={theme.text.accent}>
              {"\u25B6 Creating Worktree"}
            </text>
          </box>

          <box height={1}>
            <text x={3} y={0} fg={theme.border.subtle}>
              {"\u2500".repeat(Math.max(w() - 10, 10))}
            </text>
          </box>

          <box height={1} />

          <For each={progressSteps()}>
            {(step) => (
              <box height={1}>
                <text x={3} y={0} fg={
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
                  <text x={3 + step.label.length + 4} y={0} fg={theme.text.secondary}>
                    {step.message}
                  </text>
                </Show>
              </box>
            )}
          </For>
        </Show>

        <Show when={step() === "done"}>
          <box height={1} />

          <box height={1}>
            <text x={3} y={0} fg={theme.text.success}>
              {"\u25B6 Worktree Created"}
            </text>
          </box>

          <box height={1}>
            <text x={3} y={0} fg={theme.border.subtle}>
              {"\u2500".repeat(Math.max(w() - 10, 10))}
            </text>
          </box>

          <box height={1} />

          <box height={1} flexDirection="row">
            <box width={14} height={1}>
              <text x={3} y={0} fg={theme.text.secondary}>Branch</text>
            </box>
            <text fg={theme.text.accent}>{branchInput()}</text>
          </box>

          <box height={1} flexDirection="row">
            <box width={14} height={1}>
              <text x={3} y={0} fg={theme.text.secondary}>Path</text>
            </box>
            <text fg={theme.text.primary}>{resolvedPath()}</text>
          </box>

          <Show when={focusInput().length > 0}>
            <box height={1} flexDirection="row">
              <box width={14} height={1}>
                <text x={3} y={0} fg={theme.text.secondary}>Focus</text>
              </box>
              <text fg={theme.text.accent}>{focusInput()}</text>
            </box>
          </Show>

          <box height={1} />

          <box height={1}>
            <text x={3} y={0} fg={theme.text.success}>
              {"\u2713 "}{statusMsg()}
            </text>
          </box>
        </Show>

        <Show when={step() === "error"}>
          <box height={1} />

          <box height={1}>
            <text x={3} y={0} fg={theme.text.error}>
              {"\u25B6 Error"}
            </text>
          </box>

          <box height={1}>
            <text x={3} y={0} fg={theme.border.subtle}>
              {"\u2500".repeat(Math.max(w() - 10, 10))}
            </text>
          </box>

          <box height={1} />

          <box height={1}>
            <text x={3} y={0} fg={theme.text.error}>
              {"\u2717 Failed"}
            </text>
          </box>

          <box height={1}>
            <box x={3} y={0} width={inputFieldW()} height={1} backgroundColor={theme.bg.elevated}>
              <text x={1} y={0} fg={theme.text.primary}>
                {statusMsg().slice(0, Math.max(inputFieldW() - 3, 10))}
              </text>
            </box>
          </box>

          <box height={1} />

          <box height={1}>
            <text x={3} y={0} fg={theme.text.secondary}>
              Press Enter or Escape to try again
            </text>
          </box>
        </Show>
      </box>

      <box x={1} y={h() - 2} width={w() - 2} height={1} backgroundColor={theme.bg.surface}>
        <Show when={step() === "input"}>
          <text x={2} y={0} fg={theme.text.secondary}>Enter</text>
          <text x={7} y={0} fg={theme.text.primary}>:confirm{"  "}</text>
          <text x={17} y={0} fg={theme.text.secondary}>Esc</text>
          <text x={20} y={0} fg={theme.text.primary}>:cancel{"  "}</text>
          <text x={29} y={0} fg={theme.text.secondary}>Tab</text>
          <text x={32} y={0} fg={theme.text.primary}>:switch field</text>
        </Show>
        <Show when={step() === "preview"}>
          <text x={2} y={0} fg={theme.text.success}>Enter</text>
          <text x={7} y={0} fg={theme.text.primary}>:create{"  "}</text>
          <text x={17} y={0} fg={theme.text.secondary}>Esc</text>
          <text x={20} y={0} fg={theme.text.primary}>:back</text>
        </Show>
        <Show when={step() === "creating"}>
          <text x={2} y={0} fg={theme.text.warning}>Creating worktree...</text>
        </Show>
        <Show when={step() === "done"}>
          <text x={2} y={0} fg={theme.text.success}>{"\u2713"} Done — returning to list</text>
        </Show>
        <Show when={step() === "error"}>
          <text x={2} y={0} fg={theme.text.secondary}>Enter</text>
          <text x={7} y={0} fg={theme.text.primary}>:retry{"  "}</text>
          <text x={17} y={0} fg={theme.text.secondary}>Esc</text>
          <text x={20} y={0} fg={theme.text.primary}>:back</text>
        </Show>
      </box>
    </box>
  );
}
