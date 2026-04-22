import {
  type OmlConfig,
  getRepoConfig,
  resolveTemplate,
  mergeTemplateWithRepo,
  getSessionConfig,
  resolveSessionLayout,
} from "../config.ts";
import { GitWorktree, parseRemoteRef } from "../git.ts";
import { GitError } from "../types.ts";
import { copyFiles, linkFiles, applySharedDeps } from "../files.ts";
import { executeHooks } from "../hooks.ts";
import { writeFocus } from "../focus.ts";
import { writePRMeta } from "../pr.ts";
import { logActivity } from "../activity-log.ts";
import { matchHooksForFocus, executeGlobHooks } from "../glob-hooks.ts";
import { isTmuxAvailable, openSession } from "../session.ts";
import { validateFocusPaths } from "../monorepo.ts";
import {
  CREATE_STEP_IDS,
  type CreateWorktreeOpts,
  type CreateWorktreeResult,
  type StepPlanEntry,
  type StepProgressHandler,
} from "./types.ts";

export async function createWorktreeFlow(
  config: OmlConfig,
  opts: CreateWorktreeOpts,
  handler: StepProgressHandler = {},
): Promise<CreateWorktreeResult> {
  const { branch, worktreePath, mainRepoPath, repoName } = opts;

  let repoConfig = getRepoConfig(config, mainRepoPath);
  let templateBase: string | undefined;
  if (opts.templateName) {
    const template = resolveTemplate(config, opts.templateName);
    if (!template) {
      throw new Error(`Template '${opts.templateName}' not found`);
    }
    repoConfig = mergeTemplateWithRepo(repoConfig, template);
    templateBase = template.base;
  }

  const resolvedBase = opts.base ?? templateBase ?? repoConfig.base;
  const focusPaths = opts.focusPaths ?? [];
  const sessionConfig = getSessionConfig(config);
  const wantSession = opts.session ?? sessionConfig.autoCreate ?? false;
  const shouldFetch = opts.fetch !== false;

  const branchAlreadyExists = await GitWorktree.localBranchExists(branch, mainRepoPath);
  let remoteRef: { remote: string; branch: string } | null = null;
  if (resolvedBase && shouldFetch && !branchAlreadyExists) {
    const remotes = await GitWorktree.getRemotes(mainRepoPath);
    remoteRef = parseRemoteRef(resolvedBase, remotes);
  }

  const tmuxOk = wantSession ? await isTmuxAvailable() : false;

  const plan: StepPlanEntry[] = [];
  if (remoteRef) {
    plan.push({ id: CREATE_STEP_IDS.fetch, label: `Fetching ${remoteRef.remote}/${remoteRef.branch}` });
  }
  plan.push({ id: CREATE_STEP_IDS.worktree, label: "Creating worktree" });
  if (repoConfig.autoUpstream) {
    plan.push({ id: CREATE_STEP_IDS.upstream, label: "Setting upstream" });
  }
  if (repoConfig.copyFiles.length > 0) {
    plan.push({ id: CREATE_STEP_IDS.copyFiles, label: "Copying files" });
  }
  if (repoConfig.linkFiles.length > 0) {
    plan.push({ id: CREATE_STEP_IDS.linkFiles, label: "Creating symlinks" });
  }
  if (repoConfig.sharedDeps?.paths?.length) {
    plan.push({ id: CREATE_STEP_IDS.sharedDeps, label: "Sharing dependencies" });
  }
  if (focusPaths.length > 0) {
    plan.push({ id: CREATE_STEP_IDS.focus, label: "Setting focus" });
  }
  if (repoConfig.postCreate.length > 0) {
    plan.push({ id: CREATE_STEP_IDS.postCreate, label: "Running postCreate hooks" });
  }
  if (focusPaths.length > 0 && repoConfig.monorepo?.hooks?.length) {
    plan.push({ id: CREATE_STEP_IDS.monorepoHooks, label: "Running monorepo hooks" });
  }
  if (wantSession && tmuxOk) {
    plan.push({ id: CREATE_STEP_IDS.session, label: "Creating session" });
  }
  if (opts.prNumber) {
    plan.push({ id: CREATE_STEP_IDS.prMeta, label: "Writing PR metadata" });
  }
  plan.push({ id: CREATE_STEP_IDS.activityLog, label: "Logging activity" });

  handler.onStepPlan?.(plan);

  const result: CreateWorktreeResult = {
    validFocusPaths: [],
    invalidFocusPaths: [],
  };

  if (remoteRef) {
    handler.onStepStart?.(CREATE_STEP_IDS.fetch);
    try {
      await GitWorktree.fetchRemote(remoteRef.remote, remoteRef.branch, mainRepoPath);
      handler.onStepDone?.(CREATE_STEP_IDS.fetch);
    } catch (err) {
      const raw = err instanceof GitError ? (err.stderr || err.message) : (err as Error).message;
      result.fetchWarning = raw.split("\n")[0];
      handler.onStepError?.(CREATE_STEP_IDS.fetch, `${result.fetchWarning} — continuing with local ref`);
    }
  }

  handler.onStepStart?.(CREATE_STEP_IDS.worktree);
  try {
    await GitWorktree.add(
      branch,
      worktreePath,
      { createBranch: !branchAlreadyExists, base: resolvedBase },
      mainRepoPath,
    );
    handler.onStepDone?.(CREATE_STEP_IDS.worktree);
  } catch (err) {
    handler.onStepError?.(CREATE_STEP_IDS.worktree, (err as Error).message);
    throw err;
  }

  try {
    if (repoConfig.autoUpstream) {
      handler.onStepStart?.(CREATE_STEP_IDS.upstream);
      try {
        const remote = await GitWorktree.getDefaultRemote(mainRepoPath);
        const exists = await GitWorktree.remoteBranchExists(branch, remote, mainRepoPath);
        if (exists) {
          await GitWorktree.setUpstream(branch, remote, mainRepoPath);
          handler.onStepDone?.(CREATE_STEP_IDS.upstream, `→ ${remote}/${branch}`);
        } else {
          handler.onStepDone?.(CREATE_STEP_IDS.upstream, "no remote branch");
        }
      } catch (err) {
        handler.onStepError?.(CREATE_STEP_IDS.upstream, (err as Error).message);
      }
    }

    if (repoConfig.copyFiles.length > 0) {
      handler.onStepStart?.(CREATE_STEP_IDS.copyFiles);
      copyFiles(mainRepoPath, worktreePath, repoConfig.copyFiles);
      handler.onStepDone?.(CREATE_STEP_IDS.copyFiles);
    }

    if (repoConfig.linkFiles.length > 0) {
      handler.onStepStart?.(CREATE_STEP_IDS.linkFiles);
      linkFiles(mainRepoPath, worktreePath, repoConfig.linkFiles);
      handler.onStepDone?.(CREATE_STEP_IDS.linkFiles);
    }

    if (repoConfig.sharedDeps?.paths?.length) {
      handler.onStepStart?.(CREATE_STEP_IDS.sharedDeps);
      applySharedDeps(mainRepoPath, worktreePath, repoConfig.sharedDeps);
      handler.onStepDone?.(CREATE_STEP_IDS.sharedDeps);
    }

    if (focusPaths.length > 0) {
      handler.onStepStart?.(CREATE_STEP_IDS.focus);
      const { valid, invalid } = validateFocusPaths(worktreePath, focusPaths);
      result.validFocusPaths = valid;
      result.invalidFocusPaths = invalid;
      if (valid.length > 0) {
        writeFocus(worktreePath, valid);
      }
      handler.onStepDone?.(CREATE_STEP_IDS.focus, valid.join(", "));
    }

    const hookEnv: Record<string, string> = {
      COPSE_BRANCH: branch,
      COPSE_WORKTREE_PATH: worktreePath,
      COPSE_REPO_PATH: mainRepoPath,
    };
    if (result.validFocusPaths.length > 0) {
      hookEnv.COPSE_FOCUS_PATHS = result.validFocusPaths.join(",");
    }

    if (repoConfig.postCreate.length > 0) {
      handler.onStepStart?.(CREATE_STEP_IDS.postCreate);
      await executeHooks(repoConfig.postCreate, {
        cwd: worktreePath,
        env: hookEnv,
        onOutput: handler.onHookOutput,
      });
      handler.onStepDone?.(CREATE_STEP_IDS.postCreate);
    }

    if (result.validFocusPaths.length > 0 && repoConfig.monorepo?.hooks?.length) {
      const matches = matchHooksForFocus(repoConfig.monorepo.hooks, result.validFocusPaths);
      if (matches.length > 0) {
        handler.onStepStart?.(CREATE_STEP_IDS.monorepoHooks);
        await executeGlobHooks(matches, "postCreate", {
          cwd: worktreePath,
          env: hookEnv,
          repo: repoName,
          branch,
          focusPaths: result.validFocusPaths,
          mainRepoPath,
          onOutput: handler.onHookOutput,
        });
        handler.onStepDone?.(CREATE_STEP_IDS.monorepoHooks);
      }
    }

    if (wantSession && tmuxOk) {
      handler.onStepStart?.(CREATE_STEP_IDS.session);
      try {
        const sessionLayoutName = opts.layoutName ?? sessionConfig.defaultLayout;
        const sessionLayout = resolveSessionLayout(config, sessionLayoutName);
        const sessionName = await openSession(branch, worktreePath, {
          layout: sessionLayout,
          prefix: sessionConfig.prefix,
          attach: false,
          layoutName: sessionLayoutName,
        });
        result.sessionName = sessionName;
        handler.onStepDone?.(CREATE_STEP_IDS.session, sessionName);
      } catch (err) {
        handler.onStepError?.(CREATE_STEP_IDS.session, (err as Error).message.split("\n")[0]);
      }
    }

    if (opts.prNumber) {
      handler.onStepStart?.(CREATE_STEP_IDS.prMeta);
      writePRMeta(worktreePath, {
        number: opts.prNumber,
        branch,
        createdAt: new Date().toISOString(),
      });
      handler.onStepDone?.(CREATE_STEP_IDS.prMeta);
    }

    handler.onStepStart?.(CREATE_STEP_IDS.activityLog);
    try {
      logActivity(mainRepoPath, {
        timestamp: new Date().toISOString(),
        event: "create",
        branch,
        path: worktreePath,
      });
      handler.onStepDone?.(CREATE_STEP_IDS.activityLog);
    } catch (err) {
      handler.onStepError?.(CREATE_STEP_IDS.activityLog, (err as Error).message);
    }

    return result;
  } catch (err) {
    await GitWorktree.remove(worktreePath, { force: true }, mainRepoPath).catch(() => {});
    throw err;
  }
}
