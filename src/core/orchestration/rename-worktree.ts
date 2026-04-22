import { basename, dirname, join } from "node:path";
import { GitWorktree, invalidateGitCache } from "../git.ts";
import { logActivity } from "../activity-log.ts";
import {
  RENAME_STEP_IDS,
  type RenameWorktreeOpts,
  type StepPlanEntry,
  type StepProgressHandler,
} from "./types.ts";

export interface RenameResult {
  oldBranch: string;
  newBranch: string;
  newWorktreePath: string;
  moved: boolean;
}

export async function renameWorktreeFlow(
  opts: RenameWorktreeOpts,
  handler: StepProgressHandler = {},
): Promise<RenameResult> {
  const { mainRepoPath, oldBranch, newBranch, worktreePath, movePath } = opts;

  const plan: StepPlanEntry[] = [
    { id: RENAME_STEP_IDS.renameBranch, label: `Renaming branch ${oldBranch} → ${newBranch}` },
  ];
  if (movePath) {
    plan.push({ id: RENAME_STEP_IDS.movePath, label: "Moving worktree directory" });
  }
  plan.push({ id: RENAME_STEP_IDS.activityLog, label: "Logging activity" });
  handler.onStepPlan?.(plan);

  handler.onStepStart?.(RENAME_STEP_IDS.renameBranch);
  await GitWorktree.exec(["branch", "-m", oldBranch, newBranch], mainRepoPath);
  invalidateGitCache();
  handler.onStepDone?.(RENAME_STEP_IDS.renameBranch);

  let newWorktreePath = worktreePath;
  let moved = false;
  if (movePath) {
    handler.onStepStart?.(RENAME_STEP_IDS.movePath);
    const branchSlug = newBranch.replace(/\//g, "-");
    const oldBranchSlug = oldBranch.replace(/\//g, "-");
    const parentDir = dirname(worktreePath);
    const oldBasename = basename(worktreePath);
    const newBasename = oldBasename.replace(oldBranchSlug, branchSlug);
    const candidate = join(parentDir, newBasename);

    if (candidate !== worktreePath) {
      await GitWorktree.move(worktreePath, candidate, mainRepoPath);
      invalidateGitCache();
      newWorktreePath = candidate;
      moved = true;
      handler.onStepDone?.(RENAME_STEP_IDS.movePath, `${worktreePath} → ${candidate}`);
    } else {
      handler.onStepDone?.(RENAME_STEP_IDS.movePath, "path already matches new branch slug");
    }
  }

  handler.onStepStart?.(RENAME_STEP_IDS.activityLog);
  try {
    logActivity(mainRepoPath, {
      timestamp: new Date().toISOString(),
      event: "rename",
      branch: newBranch,
      details: { oldBranch },
    });
    handler.onStepDone?.(RENAME_STEP_IDS.activityLog);
  } catch (err) {
    handler.onStepError?.(RENAME_STEP_IDS.activityLog, (err as Error).message);
  }

  return { oldBranch, newBranch, newWorktreePath, moved };
}
