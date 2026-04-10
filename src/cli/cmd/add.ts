import type { CommandModule } from "yargs";
import { basename, resolve } from "node:path";
import { existsSync } from "node:fs";
import { GitWorktree } from "../../core/git.ts";
import { GitError } from "../../core/types.ts";
import { loadConfig, getRepoConfig, expandTemplate, resolveTemplate, mergeTemplateWithRepo, getSessionConfig, resolveSessionLayout } from "../../core/config.ts";
import { resolveMainRepo } from "../utils.ts";
import { executeHooks, HookError, HookTimeoutError } from "../../core/hooks.ts";
import { matchHooksForFocus, executeGlobHooks } from "../../core/glob-hooks.ts";
import { copyFiles, linkFiles, applySharedDeps } from "../../core/files.ts";
import { writeFocus } from "../../core/focus.ts";
import { writePRMeta } from "../../core/pr.ts";
import { logActivity } from "../../core/activity-log.ts";
import { validateFocusPaths } from "../../core/monorepo.ts";
import { isTmuxAvailable, openSession } from "../../core/session.ts";

const cmd: CommandModule = {
  command: "add [branch] [path]",
  describe: "Create a new worktree for a branch",
  builder: (yargs) =>
    yargs
      .positional("branch", {
        type: "string",
        describe: "Branch name",
      })
      .positional("path", {
        type: "string",
        describe: "Worktree directory path",
      })
      .option("create", {
        type: "boolean",
        alias: "c",
        describe: "Optional compatibility flag; missing branches are created automatically",
      })
      .option("base", {
        type: "string",
        alias: "b",
        describe: "Base branch/commit for new branch",
      })
      .option("focus", {
        type: "array",
        alias: "f",
        describe: "Focus packages for monorepo (comma or space separated paths)",
        string: true,
      })
      .option("template", {
        type: "string",
        alias: "t",
        describe: "Use a named template from config",
      })
      .option("pr", {
        type: "number",
        describe: "Create worktree from a GitHub PR number (requires gh CLI)",
      })
      .option("session", {
        type: "boolean",
        alias: "s",
        describe: "Create a tmux session for this worktree",
      })
      .option("layout", {
        type: "string",
        describe: "Session layout name from config",
      }),
  handler: async (argv) => {
    let branch = argv.branch as string | undefined;
    const prNumber = argv.pr as number | undefined;
    const mainRepoPath = await resolveMainRepo();
    const repoName = basename(mainRepoPath);

    if (!branch && !prNumber) {
      console.error("Error: specify a branch or use --pr <number>.");
      process.exit(1);
    }

    // PR integration: resolve PR number to branch name via gh CLI
    if (prNumber) {
      try {
        const proc = (Bun as any).spawn(["gh", "pr", "view", String(prNumber), "--json", "headRefName", "--jq", ".headRefName"], {
          cwd: mainRepoPath,
          stdout: "pipe",
          stderr: "pipe",
        });
        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
          proc.exited,
        ]);
        if (exitCode !== 0) {
          console.error(`Error: failed to resolve PR #${prNumber}: ${stderr.trim()}`);
          console.error("Make sure 'gh' CLI is installed and authenticated.");
          process.exit(1);
        }
        branch = stdout.trim();
        if (!branch) {
          console.error(`Error: PR #${prNumber} has no branch name`);
          process.exit(1);
        }
        console.log(`PR #${prNumber} → branch '${branch}'`);
      } catch {
        console.error("Error: 'gh' CLI not found. Install it from https://cli.github.com");
        process.exit(1);
      }
    }

    if (!branch) {
      console.error("Error: could not determine branch name.");
      process.exit(1);
    }

    const safeBranch = branch.replace(/\//g, "-");

    const config = loadConfig();
    let repoConfig = getRepoConfig(config, mainRepoPath);

    // Template: merge template config with repo config
    const templateName = argv.template as string | undefined;
    if (templateName) {
      const template = resolveTemplate(config, templateName);
      if (!template) {
        const available = Object.keys(config.templates ?? {});
        console.error(`Error: template '${templateName}' not found.`);
        if (available.length > 0) {
          console.error(`Available templates: ${available.join(", ")}`);
        } else {
          console.error("No templates configured. Add templates to your config file.");
        }
        process.exit(1);
      }
      repoConfig = mergeTemplateWithRepo(repoConfig, template);
      // Template can override base branch
      if (template.base && !argv.base) {
        (argv as Record<string, unknown>).base = template.base;
      }
      console.log(`Using template '${templateName}'`);
    }

    const pathTemplate = (argv.path as string | undefined) ?? repoConfig.worktreeDir;
    const expandedPath = expandTemplate(pathTemplate, {
      repo: repoName,
      branch: safeBranch,
    });
    const worktreePath = resolve(mainRepoPath, expandedPath);

    console.log(`Creating worktree for branch '${branch}'...`);
    console.log(`  Target: ${worktreePath}`);

    const existing = await GitWorktree.list(mainRepoPath);
    const alreadyCheckedOut = existing.find((worktree) => worktree.branch === branch);
    if (alreadyCheckedOut) {
      console.error(
        `Error: branch '${branch}' is already checked out in ${alreadyCheckedOut.path}`,
      );
      process.exit(1);
    }

    if (existsSync(worktreePath)) {
      console.error(`Error: directory already exists: ${worktreePath}`);
      process.exit(1);
    }

    try {
      await GitWorktree.add(
        branch,
        worktreePath,
        {
          createBranch: Boolean(argv.create),
          base: argv.base as string | undefined,
        },
        mainRepoPath,
      );
      console.log("  ✓ Worktree created");
      try { logActivity(mainRepoPath, { timestamp: new Date().toISOString(), event: "create", branch: branch as string, path: worktreePath }); } catch {}

      if (prNumber) {
        writePRMeta(worktreePath, { number: prNumber, branch, createdAt: new Date().toISOString() });
        console.log(`  ✓ PR #${prNumber} metadata saved`);
      }
    } catch (err) {
      if (err instanceof GitError) {
        console.error(`Error creating worktree: ${err.stderr || err.message}`);
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exit(1);
    }

    if (repoConfig.autoUpstream) {
      try {
        const remote = await GitWorktree.getDefaultRemote(mainRepoPath);
        const exists = await GitWorktree.remoteBranchExists(branch, remote, mainRepoPath);
        if (exists) {
          await GitWorktree.setUpstream(branch, remote, mainRepoPath);
          console.log(`  ✓ Upstream tracking set → ${remote}/${branch}`);
        } else {
          console.log("  ℹ No remote branch found — upstream tracking skipped");
        }
      } catch (err) {
        console.warn(`  ⚠ Could not set upstream tracking: ${(err as Error).message}`);
      }
    }

    try {
      if (repoConfig.copyFiles.length > 0) {
        console.log(`  Copying files: ${repoConfig.copyFiles.join(", ")}`);
        const copyResult = copyFiles(mainRepoPath, worktreePath, repoConfig.copyFiles);
        for (const warning of copyResult.warnings) {
          console.log(`  ⚠ ${warning}`);
        }
        if (copyResult.copied.length > 0) {
          console.log(`  ✓ Copied: ${copyResult.copied.join(", ")}`);
        }
      }

      if (repoConfig.linkFiles.length > 0) {
        console.log(`  Linking files: ${repoConfig.linkFiles.join(", ")}`);
        const linkResult = linkFiles(mainRepoPath, worktreePath, repoConfig.linkFiles);
        for (const warning of linkResult.warnings) {
          console.log(`  ⚠ ${warning}`);
        }
        if (linkResult.linked.length > 0) {
          console.log(`  ✓ Linked: ${linkResult.linked.join(", ")}`);
        }
      }

      if (repoConfig.sharedDeps && repoConfig.sharedDeps.paths && repoConfig.sharedDeps.paths.length > 0) {
        const strategy = repoConfig.sharedDeps.strategy ?? "symlink";
        console.log(`  Sharing dependencies (${strategy}): ${repoConfig.sharedDeps.paths.join(", ")}`);
        const depsResult = applySharedDeps(mainRepoPath, worktreePath, repoConfig.sharedDeps);
        for (const warning of depsResult.warnings) {
          console.log(`  ⚠ ${warning}`);
        }
        if (depsResult.linked.length > 0) {
          console.log(`  ✓ Shared (${strategy}): ${depsResult.linked.join(", ")}`);
        }
        if (depsResult.copied.length > 0) {
          console.log(`  ✓ Copied: ${depsResult.copied.join(", ")}`);
        }
      }

      const hookEnv: Record<string, string> = {
        COPSE_BRANCH: branch,
        COPSE_WORKTREE_PATH: worktreePath,
        COPSE_REPO_PATH: mainRepoPath,
      };

      // Parse --focus flag (supports: --focus a,b --focus c  OR  --focus "a b")
      const rawFocus = argv.focus as string[] | undefined;
      let focusPaths: string[] = [];

      if (rawFocus && rawFocus.length > 0) {
        focusPaths = rawFocus
          .flatMap((f) => f.split(/[,\s]+/))
          .map((f) => f.trim())
          .filter(Boolean);
      }

      if (focusPaths.length > 0) {
        const { valid, invalid } = validateFocusPaths(worktreePath, focusPaths);

        if (invalid.length > 0) {
          console.log(`  ⚠ Focus paths not found (will be skipped): ${invalid.join(", ")}`);
        }

        if (valid.length > 0) {
          writeFocus(worktreePath, valid);
          console.log(`  ✓ Focus set: ${valid.join(", ")}`);
        }

        hookEnv.COPSE_FOCUS_PATHS = valid.join(",");
      }

      if (repoConfig.postCreate.length > 0) {
        console.log("  Running postCreate hooks...");
        await executeHooks(repoConfig.postCreate, {
          cwd: worktreePath,
          env: hookEnv,
          onOutput: (line) => console.log(`    ${line}`),
        });
        console.log("  ✓ Hooks completed");
      }

      // Run monorepo glob hooks (if focus + monorepo config)
      if (focusPaths.length > 0 && repoConfig.monorepo?.hooks && repoConfig.monorepo.hooks.length > 0) {
        const matches = matchHooksForFocus(repoConfig.monorepo.hooks, focusPaths);
        if (matches.length > 0) {
          console.log("  Running monorepo hooks...");
          await executeGlobHooks(matches, "postCreate", {
            cwd: worktreePath,
            env: hookEnv,
            repo: repoName,
            branch,
            focusPaths,
            mainRepoPath,
            onOutput: (line) => console.log(`    ${line}`),
          });
          console.log("  ✓ Monorepo hooks completed");
        }
      }

      const sessionConfig = getSessionConfig(config);
      const wantSession = (argv.session as boolean) || sessionConfig.autoCreate;
      if (wantSession) {
        const tmuxOk = await isTmuxAvailable();
        if (tmuxOk) {
          const sessionLayoutName = (argv.layout as string | undefined) ?? sessionConfig.defaultLayout;
          const sessionLayout = resolveSessionLayout(config, sessionLayoutName);
          const sessionName = await openSession(branch, worktreePath, {
            layout: sessionLayout,
            prefix: sessionConfig.prefix,
            attach: false,
            layoutName: sessionLayoutName,
          });
          console.log(`  ✓ Session created: ${sessionName}`);
        } else {
          console.log("  ⚠ tmux not found — session skipped");
        }
      }

      console.log(`\nWorktree ready: ${worktreePath}`);
      process.exit(0);
    } catch (err) {
      console.error("\nSetup failed, rolling back...");
      try {
        await GitWorktree.remove(worktreePath, { force: true }, mainRepoPath);
        console.error("Rolled back worktree.");
      } catch (rollbackErr) {
        console.error(`Warning: rollback failed: ${(rollbackErr as Error).message}`);
      }

      if (err instanceof HookTimeoutError) {
        console.error(`Error: hook timed out: ${err.command}`);
      } else if (err instanceof HookError) {
        console.error(`Error: hook failed (exit ${err.exitCode}): ${err.command}`);
        if (err.stderr) {
          console.error(err.stderr);
        }
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exit(1);
    }
  },
};

export default cmd;
