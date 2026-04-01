import type { CommandModule } from "yargs";
import { basename, resolve } from "node:path";
import { existsSync } from "node:fs";
import { GitWorktree } from "../../core/git.ts";
import { GitError } from "../../core/types.ts";
import { loadConfig, getRepoConfig, expandTemplate } from "../../core/config.ts";
import { executeHooks, HookError, HookTimeoutError } from "../../core/hooks.ts";
import { matchHooksForFocus, executeGlobHooks } from "../../core/glob-hooks.ts";
import { copyFiles, linkFiles } from "../../core/files.ts";
import { writeFocus } from "../../core/focus.ts";
import { validateFocusPaths } from "../../core/monorepo.ts";

const cmd: CommandModule = {
  command: "add <branch> [path]",
  describe: "Create a new worktree for a branch",
  builder: (yargs) =>
    yargs
      .positional("branch", {
        type: "string",
        describe: "Branch name",
        demandOption: true,
      })
      .positional("path", {
        type: "string",
        describe: "Worktree directory path",
      })
      .option("create", {
        type: "boolean",
        alias: "c",
        describe: "Create branch if it doesn't exist",
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
      }),
  handler: async (argv) => {
    const branch = argv.branch as string;
    const mainRepoPath = await GitWorktree.getMainRepoPath().catch(() => process.cwd());
    const repoName = basename(mainRepoPath);
    const safeBranch = branch.replace(/\//g, "-");

    const config = loadConfig();
    const repoConfig = getRepoConfig(config, mainRepoPath);

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
          createBranch: argv.create as boolean,
          base: argv.base as string | undefined,
        },
        mainRepoPath,
      );
      console.log("  ✓ Worktree created");
    } catch (err) {
      if (err instanceof GitError) {
        console.error(`Error creating worktree: ${err.stderr || err.message}`);
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exit(1);
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

      const hookEnv: Record<string, string> = {
        OMW_BRANCH: branch,
        OMW_WORKTREE_PATH: worktreePath,
        OMW_REPO_PATH: mainRepoPath,
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

        hookEnv.OMW_FOCUS_PATHS = valid.join(",");
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

      console.log(`\nWorktree ready: ${worktreePath}`);
      process.exit(0);
    } catch (err) {
      console.error("\nSetup failed, rolling back...");
      try {
        await GitWorktree.remove(worktreePath, { force: true }, mainRepoPath);
        console.error("Rolled back worktree.");
      } catch {
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
