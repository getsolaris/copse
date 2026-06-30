import type { Accessor, Setter } from "solid-js";
import { useKeyboard, usePaste } from "@opentui/solid";
import { decodePasteBytes } from "@opentui/core";
import { basename } from "node:path";
import { toast } from "@opentui-ui/toast/solid";
import { createWorktreeFlow } from "../../core/orchestration/index.ts";
import type { CreateWorktreeOpts } from "../../core/orchestration/types.ts";
import { loadConfig } from "../../core/config.ts";
import {
  createSourceBaseOption,
  nextCreateFocusField,
  type CreateFocusField,
} from "../create-worktree-input.ts";
import type { ProgressStep, WorktreeCreateStep } from "./WorktreeCreateContent.tsx";

interface WorktreeCreateControllerOptions {
  readonly activeTab: Accessor<string>;
  readonly showCommandPalette: Accessor<boolean>;
  readonly showUpdatePrompt: Accessor<boolean>;
  readonly inputFocused: Accessor<boolean>;
  readonly setActiveTab: (tab: "list") => void;
  readonly refetchWorktrees: () => void;
  readonly step: Accessor<WorktreeCreateStep>;
  readonly setStep: Setter<WorktreeCreateStep>;
  readonly branchInput: Accessor<string>;
  readonly setBranchInput: Setter<string>;
  readonly sourceBranchInput: Accessor<string>;
  readonly setSourceBranchInput: Setter<string>;
  readonly focusInput: Accessor<string>;
  readonly setFocusInput: Setter<string>;
  readonly focusField: Accessor<CreateFocusField>;
  readonly setFocusField: Setter<CreateFocusField>;
  readonly resolvedPath: Accessor<string>;
  readonly setResolvedPath: Setter<string>;
  readonly progressSteps: Accessor<readonly ProgressStep[]>;
  readonly setProgressSteps: Setter<ProgressStep[]>;
  readonly setStatusMsg: Setter<string>;
  readonly filteredBranches: Accessor<readonly { readonly name: string }[]>;
  readonly branchPickerIdx: Accessor<number>;
  readonly setBranchPickerIdx: Setter<number>;
  readonly showPicker: Accessor<boolean>;
  readonly setShowPicker: Setter<boolean>;
  readonly resolveTargetPath: () => string;
  readonly sourceFallbackBase: () => string | undefined;
  readonly activeRepoPath: () => string;
}

export function useWorktreeCreateController(opts: WorktreeCreateControllerOptions): void {
  const updateStep = (index: number, updates: Partial<ProgressStep>) => {
    opts.setProgressSteps((steps) => steps.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const resetInput = () => {
    opts.setBranchInput("");
    opts.setSourceBranchInput("");
    opts.setFocusInput("");
    opts.setFocusField("branch");
  };

  useKeyboard(async (event) => {
    if (opts.activeTab() !== "add") return;
    if (opts.showCommandPalette()) return;
    if (opts.showUpdatePrompt()) return;
    const key = event.name;

    if (key === "escape") {
      if (opts.step() === "preview") {
        opts.setStep("input");
        return;
      }
      opts.setActiveTab("list");
      resetInput();
      opts.setStep("input");
      return;
    }

    if (opts.step() === "input") {
      if (key === "tab") {
        if (opts.showPicker() && opts.focusField() === "branch") {
          opts.setShowPicker(false);
          opts.setBranchPickerIdx(-1);
        }
        opts.setFocusField((field) => nextCreateFocusField(field));
        return;
      }
      if (opts.focusField() === "branch" && opts.showPicker() && opts.filteredBranches().length > 0) {
        if (key === "down" || event.sequence === "\u001b[B") {
          opts.setBranchPickerIdx((i) => Math.min(i + 1, opts.filteredBranches().length - 1));
          return;
        }
        if (key === "up" || event.sequence === "\u001b[A") {
          opts.setBranchPickerIdx((i) => Math.max(i - 1, -1));
          return;
        }
      }
      if (key === "return" || key === "enter") {
        if (opts.focusField() === "branch" && opts.branchPickerIdx() >= 0) {
          const selected = opts.filteredBranches()[opts.branchPickerIdx()];
          if (selected) {
            opts.setBranchInput(selected.name);
            opts.setShowPicker(false);
            opts.setBranchPickerIdx(-1);
            return;
          }
        }
        if (!opts.branchInput()) return;
        opts.setShowPicker(false);
        opts.setResolvedPath(opts.resolveTargetPath());
        opts.setStep("preview");
        return;
      }
    }

    if (opts.step() === "preview" && (key === "return" || key === "enter")) {
      await createWorktree(opts, updateStep, resetInput);
      return;
    }

    if (opts.step() === "error" && (key === "escape" || key === "return" || key === "enter")) {
      opts.setStep("input");
      opts.setStatusMsg("");
    }
  });

  usePaste((event) => {
    if (!opts.inputFocused()) return;
    const text = decodePasteBytes(event.bytes).replace(/\r?\n/g, "");
    if (!text) return;
    if (opts.focusField() === "branch") {
      opts.setBranchInput((value) => value + text);
      return;
    }
    if (opts.focusField() === "source") {
      opts.setSourceBranchInput((value) => value + text);
      return;
    }
    if (opts.focusField() === "focus") {
      opts.setFocusInput((value) => value + text);
    }
  });
}

async function createWorktree(
  opts: WorktreeCreateControllerOptions,
  updateStep: (index: number, updates: Partial<ProgressStep>) => void,
  resetInput: () => void,
): Promise<void> {
  opts.setStep("creating");
  const branch = opts.branchInput();
  const wtPath = opts.resolvedPath();
  const repoPath = opts.activeRepoPath();
  const repoName = basename(repoPath);

  try {
    const config = loadConfig();
    const rawFocus = opts.focusInput();
    const focusPaths = rawFocus
      ? rawFocus.split(/[,\s]+/).map((f) => f.trim()).filter(Boolean)
      : [];
    const stepIndexById: Record<string, number> = {};
    const createOpts: CreateWorktreeOpts = {
      branch,
      worktreePath: wtPath,
      mainRepoPath: repoPath,
      repoName,
      focusPaths,
      session: undefined,
      ...createSourceBaseOption(opts.sourceBranchInput(), opts.sourceFallbackBase()),
    };

    await createWorktreeFlow(
      config,
      createOpts,
      {
        onStepPlan: (plan) => {
          const steps: ProgressStep[] = plan.map((entry, idx) => {
            stepIndexById[entry.id] = idx;
            return { label: entry.label, status: "pending" };
          });
          opts.setProgressSteps(steps);
        },
        onStepStart: (id) => {
          const idx = stepIndexById[id];
          if (idx !== undefined) updateStep(idx, { status: "running" });
        },
        onStepDone: (id, message) => {
          const idx = stepIndexById[id];
          if (idx !== undefined) updateStep(idx, { status: "done", message });
        },
        onStepError: (id, message) => {
          const idx = stepIndexById[id];
          if (idx !== undefined) updateStep(idx, { status: "error", message });
        },
        onHookOutput: (line) => {
          const lastRunning = opts.progressSteps().findLastIndex((s) => s.status === "running");
          if (lastRunning >= 0) updateStep(lastRunning, { message: line });
        },
      },
    );

    opts.setStatusMsg("Worktree created successfully!");
    opts.setStep("done");
    toast.success(`Worktree created: ${branch}`);
    opts.refetchWorktrees();
    setTimeout(() => {
      opts.setActiveTab("list");
      resetInput();
      opts.setStep("input");
    }, 1500);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    toast.error(message);
    const runningIdx = opts.progressSteps().findIndex((s) => s.status === "running");
    if (runningIdx >= 0) {
      updateStep(runningIdx, { status: "error", message });
    }
    opts.setStatusMsg(message);
    opts.setStep("error");
  }
}
