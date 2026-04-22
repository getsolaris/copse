import { type OmlConfig } from "../config.ts";
import { createArchive } from "../archive.ts";
import { logActivity } from "../activity-log.ts";
import type { ArchiveEntry } from "../types.ts";
import {
  ARCHIVE_STEP_IDS,
  type ArchiveWorktreeOpts,
  type StepPlanEntry,
  type StepProgressHandler,
} from "./types.ts";
import { planRemoveWorktreeSteps, executeRemoveWorktreeFlow, type RemovePlan } from "./remove-worktree.ts";

export async function archiveWorktreeFlow(
  config: OmlConfig,
  opts: ArchiveWorktreeOpts,
  handler: StepProgressHandler = {},
): Promise<{ archiveEntry: ArchiveEntry }> {
  const { worktreePath, mainRepoPath, repoName, branch, keep, force } = opts;

  let removePlan: RemovePlan | null = null;
  if (!keep) {
    removePlan = await planRemoveWorktreeSteps(config, {
      worktreePath,
      mainRepoPath,
      repoName,
      branch,
      force: force ?? false,
    });
  }

  const archiveSteps: StepPlanEntry[] = [
    { id: ARCHIVE_STEP_IDS.createArchive, label: "Creating archive" },
    { id: ARCHIVE_STEP_IDS.activityLogArchive, label: "Logging archive event" },
  ];
  const fullPlan: StepPlanEntry[] = removePlan ? [...archiveSteps, ...removePlan.steps] : archiveSteps;
  handler.onStepPlan?.(fullPlan);

  handler.onStepStart?.(ARCHIVE_STEP_IDS.createArchive);
  const archiveEntry = await createArchive(worktreePath, mainRepoPath);
  handler.onStepDone?.(ARCHIVE_STEP_IDS.createArchive, archiveEntry.patchPath);

  handler.onStepStart?.(ARCHIVE_STEP_IDS.activityLogArchive);
  try {
    logActivity(mainRepoPath, {
      timestamp: new Date().toISOString(),
      event: "archive",
      branch: archiveEntry.branch,
      path: archiveEntry.patchPath,
    });
    handler.onStepDone?.(ARCHIVE_STEP_IDS.activityLogArchive);
  } catch (err) {
    handler.onStepError?.(ARCHIVE_STEP_IDS.activityLogArchive, (err as Error).message);
  }

  if (removePlan) {
    await executeRemoveWorktreeFlow(
      removePlan,
      {
        worktreePath,
        mainRepoPath,
        repoName,
        branch: branch ?? archiveEntry.branch,
        force: force ?? false,
      },
      {
        onStepStart: handler.onStepStart,
        onStepDone: handler.onStepDone,
        onStepError: handler.onStepError,
        onHookOutput: handler.onHookOutput,
      },
    );
  }

  return { archiveEntry };
}
