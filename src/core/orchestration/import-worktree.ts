import { resolve } from "node:path";
import { importWorktree, validateImportTarget } from "../import.ts";
import { invalidateGitCache } from "../git.ts";
import { logActivity } from "../activity-log.ts";
import { ImportError, type Worktree } from "../types.ts";
import {
  IMPORT_STEP_IDS,
  type ImportWorktreeOpts,
  type StepPlanEntry,
  type StepProgressHandler,
} from "./types.ts";

export async function importWorktreeFlow(
  opts: ImportWorktreeOpts,
  handler: StepProgressHandler = {},
): Promise<Worktree> {
  const targetPath = resolve(opts.targetPath);
  const focusPaths = opts.focusPaths ?? [];
  const pin = opts.pin ?? false;

  const plan: StepPlanEntry[] = [
    { id: IMPORT_STEP_IDS.validate, label: "Validating import target" },
    { id: IMPORT_STEP_IDS.importWorktree, label: "Importing worktree metadata" },
    { id: IMPORT_STEP_IDS.activityLog, label: "Logging activity" },
  ];
  handler.onStepPlan?.(plan);

  handler.onStepStart?.(IMPORT_STEP_IDS.validate);
  const validation = validateImportTarget(targetPath);
  if (!validation.valid) {
    const reason = validation.reason ?? "invalid import target";
    handler.onStepError?.(IMPORT_STEP_IDS.validate, reason);
    throw new ImportError(`Cannot import worktree: ${reason}`, targetPath, reason);
  }
  handler.onStepDone?.(IMPORT_STEP_IDS.validate);

  handler.onStepStart?.(IMPORT_STEP_IDS.importWorktree);
  const worktree = await importWorktree(targetPath, { focus: focusPaths, pin });
  invalidateGitCache();
  handler.onStepDone?.(IMPORT_STEP_IDS.importWorktree, worktree.branch ?? "");

  handler.onStepStart?.(IMPORT_STEP_IDS.activityLog);
  try {
    logActivity(worktree.repoPath, {
      timestamp: new Date().toISOString(),
      event: "import",
      branch: worktree.branch ?? validation.branch ?? "unknown",
      path: worktree.path,
    });
    handler.onStepDone?.(IMPORT_STEP_IDS.activityLog);
  } catch (err) {
    handler.onStepError?.(IMPORT_STEP_IDS.activityLog, (err as Error).message);
  }

  return worktree;
}
