import { createSignal, createEffect, on, onCleanup, onMount } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import { useGit } from "../context/GitContext.tsx";
import { GitWorktree } from "../../core/git.ts";
import { loadConfig, getRepoConfig, expandTemplate } from "../../core/config.ts";
import type { CreateFocusField } from "../create-worktree-input.ts";
import { useTerminalDimensions } from "@opentui/solid";
import { basename, resolve } from "node:path";
import { WorktreeCreateContent, type BranchOption, type ProgressStep, type WorktreeCreateStep } from "./WorktreeCreateContent.tsx";
import { useWorktreeCreateController } from "./useWorktreeCreateController.ts";

export function WorktreeCreate() {
  const app = useApp();
  const git = useGit();
  const dims = useTerminalDimensions();
  const [step, setStep] = createSignal<WorktreeCreateStep>("input");
  const [branchInput, setBranchInput] = createSignal("");
  const [sourceBranchInput, setSourceBranchInput] = createSignal("");
  const [focusInput, setFocusInput] = createSignal("");
  const [focusField, setFocusField] = createSignal<CreateFocusField>("branch");
  const [resolvedPath, setResolvedPath] = createSignal("");
  const [progressSteps, setProgressSteps] = createSignal<ProgressStep[]>([]);
  const [statusMsg, setStatusMsg] = createSignal("");
  const [branches, setBranches] = createSignal<BranchOption[]>([]);
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

  onMount(() => {
    queueMicrotask(() => {
      setBranchInput("");
      setSourceBranchInput("");
      setFocusInput("");
    });
  });

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

  const selectedWorktree = () => {
    const wts = git.worktrees() ?? [];
    const selectedPath = app.selectedWorktreePath();
    return selectedPath
      ? wts.find((wt) => wt.path === selectedPath) ?? wts[app.selectedWorktreeIndex()]
      : wts[app.selectedWorktreeIndex()];
  };

  const activeRepoPath = () => selectedWorktree()?.repoPath ?? app.repoPath();

  const activeRepoName = () => {
    const selected = selectedWorktree();
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

  const sourceFallbackBase = () => {
    const config = loadConfig();
    return getRepoConfig(config, activeRepoPath()).base;
  };

  useWorktreeCreateController({
    activeTab: app.activeTab,
    showCommandPalette: app.showCommandPalette,
    showUpdatePrompt: app.showUpdatePrompt,
    inputFocused: app.inputFocused,
    setActiveTab: app.setActiveTab,
    refetchWorktrees: git.refetch,
    step,
    setStep,
    branchInput,
    setBranchInput,
    sourceBranchInput,
    setSourceBranchInput,
    focusInput,
    setFocusInput,
    focusField,
    setFocusField,
    resolvedPath,
    setResolvedPath,
    progressSteps,
    setProgressSteps,
    setStatusMsg,
    filteredBranches,
    branchPickerIdx,
    setBranchPickerIdx,
    showPicker,
    setShowPicker,
    resolveTargetPath,
    sourceFallbackBase,
    activeRepoPath,
  });

  return (
    <WorktreeCreateContent
      step={step()}
      terminalWidth={dims().width}
      terminalHeight={dims().height}
      activeRepoName={activeRepoName()}
      branchInput={branchInput()}
      sourceBranchInput={sourceBranchInput()}
      sourceFallbackBase={sourceFallbackBase()}
      focusInput={focusInput()}
      focusField={focusField()}
      resolvedPath={resolvedPath()}
      targetPath={branchInput().length > 0 ? resolveTargetPath() : ""}
      progressSteps={progressSteps()}
      statusMsg={statusMsg()}
      filteredBranches={filteredBranches()}
      branchPickerIdx={branchPickerIdx()}
      showPicker={showPicker()}
      onBranchInput={setBranchInput}
      onSourceBranchInput={setSourceBranchInput}
      onFocusInput={setFocusInput}
    />
  );
}
