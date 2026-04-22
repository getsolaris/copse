import { type OmlConfig, getRepoConfig, getSessionConfig } from "../config.ts";
import { GitWorktree } from "../git.ts";
import { executeHooks } from "../hooks.ts";
import { readFocus } from "../focus.ts";
import { logActivity } from "../activity-log.ts";
import { matchHooksForFocus, executeGlobHooks } from "../glob-hooks.ts";
import { isTmuxAvailable, closeSession } from "../session.ts";
import {
  REMOVE_STEP_IDS,
  type RemoveWorktreeOpts,
  type StepPlanEntry,
  type StepProgressHandler,
} from "./types.ts";

export interface RemovePlan {
  steps: StepPlanEntry[];
  postRemoveHooks: string[];
  monorepoMatches: ReturnType<typeof matchHooksForFocus>;
  focusPaths: string[];
  wantKill: boolean;
  tmuxOk: boolean;
  sessionPrefix: string | undefined;
}

export async function planRemoveWorktreeSteps(
  config: OmlConfig,
  opts: RemoveWorktreeOpts,
): Promise<RemovePlan> {
  const { worktreePath, mainRepoPath, branch } = opts;
  const repoConfig = getRepoConfig(config, mainRepoPath);
  const sessionConfig = getSessionConfig(config);

  const focusPaths = readFocus(worktreePath) ?? [];
  const monorepoMatches =
    focusPaths.length > 0 && repoConfig.monorepo?.hooks?.length
      ? matchHooksForFocus(repoConfig.monorepo.hooks, focusPaths)
      : [];

  const wantKill = Boolean(sessionConfig.autoKill && branch);
  const tmuxOk = wantKill ? await isTmuxAvailable() : false;

  const steps: StepPlanEntry[] = [];
  if (repoConfig.postRemove.length > 0) {
    steps.push({ id: REMOVE_STEP_IDS.postRemove, label: "Running postRemove hooks" });
  }
  if (monorepoMatches.length > 0) {
    steps.push({ id: REMOVE_STEP_IDS.monorepoHooks, label: "Running monorepo hooks" });
  }
  if (wantKill && tmuxOk) {
    steps.push({ id: REMOVE_STEP_IDS.session, label: "Killing session" });
  }
  steps.push({ id: REMOVE_STEP_IDS.worktree, label: "Removing worktree" });
  steps.push({ id: REMOVE_STEP_IDS.activityLog, label: "Logging activity" });

  return {
    steps,
    postRemoveHooks: repoConfig.postRemove,
    monorepoMatches,
    focusPaths,
    wantKill,
    tmuxOk,
    sessionPrefix: sessionConfig.prefix,
  };
}

export async function executeRemoveWorktreeFlow(
  plan: RemovePlan,
  opts: RemoveWorktreeOpts,
  handler: StepProgressHandler = {},
): Promise<void> {
  const { worktreePath, mainRepoPath, repoName, branch, force } = opts;

  const hookEnv: Record<string, string> = {
    COPSE_BRANCH: branch ?? "",
    COPSE_WORKTREE_PATH: worktreePath,
    COPSE_REPO_PATH: mainRepoPath,
  };
  if (plan.focusPaths.length > 0) {
    hookEnv.COPSE_FOCUS_PATHS = plan.focusPaths.join(",");
  }

  if (plan.postRemoveHooks.length > 0) {
    handler.onStepStart?.(REMOVE_STEP_IDS.postRemove);
    try {
      await executeHooks(plan.postRemoveHooks, {
        cwd: worktreePath,
        env: hookEnv,
        onOutput: handler.onHookOutput,
      });
      handler.onStepDone?.(REMOVE_STEP_IDS.postRemove);
    } catch (err) {
      handler.onStepError?.(REMOVE_STEP_IDS.postRemove, (err as Error).message);
    }
  }

  if (plan.monorepoMatches.length > 0) {
    handler.onStepStart?.(REMOVE_STEP_IDS.monorepoHooks);
    try {
      await executeGlobHooks(plan.monorepoMatches, "postRemove", {
        cwd: worktreePath,
        env: hookEnv,
        repo: repoName,
        branch: branch ?? "",
        focusPaths: plan.focusPaths,
        mainRepoPath,
        onOutput: handler.onHookOutput,
      });
      handler.onStepDone?.(REMOVE_STEP_IDS.monorepoHooks);
    } catch (err) {
      handler.onStepError?.(REMOVE_STEP_IDS.monorepoHooks, (err as Error).message);
    }
  }

  if (plan.wantKill && plan.tmuxOk && branch) {
    handler.onStepStart?.(REMOVE_STEP_IDS.session);
    try {
      const killed = await closeSession(branch, worktreePath, plan.sessionPrefix);
      handler.onStepDone?.(REMOVE_STEP_IDS.session, killed ? "killed" : "no active session");
    } catch (err) {
      handler.onStepError?.(REMOVE_STEP_IDS.session, (err as Error).message);
    }
  }

  handler.onStepStart?.(REMOVE_STEP_IDS.worktree);
  await GitWorktree.remove(worktreePath, { force }, mainRepoPath);
  handler.onStepDone?.(REMOVE_STEP_IDS.worktree);

  handler.onStepStart?.(REMOVE_STEP_IDS.activityLog);
  try {
    logActivity(mainRepoPath, {
      timestamp: new Date().toISOString(),
      event: "delete",
      branch: branch ?? "",
      path: worktreePath,
    });
    handler.onStepDone?.(REMOVE_STEP_IDS.activityLog);
  } catch (err) {
    handler.onStepError?.(REMOVE_STEP_IDS.activityLog, (err as Error).message);
  }
}

export async function removeWorktreeFlow(
  config: OmlConfig,
  opts: RemoveWorktreeOpts,
  handler: StepProgressHandler = {},
): Promise<void> {
  const plan = await planRemoveWorktreeSteps(config, opts);
  handler.onStepPlan?.(plan.steps);
  await executeRemoveWorktreeFlow(plan, opts, handler);
}
