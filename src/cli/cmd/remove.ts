import type { CommandModule } from "yargs";
import { GitWorktree } from "../../core/git.ts";
import { GitError } from "../../core/types.ts";
import { loadConfig, getRepoConfig } from "../../core/config.ts";
import { executeHooks } from "../../core/hooks.ts";
import { readFocus } from "../../core/focus.ts";
import { matchHooksForFocus, executeGlobHooks } from "../../core/glob-hooks.ts";
import { basename } from "node:path";
import * as readline from "node:readline";

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

const cmd: CommandModule = {
  command: "remove <branch-or-path>",
  aliases: ["rm"],
  describe: "Remove a worktree",
  builder: (yargs) =>
    yargs
      .positional("branch-or-path", { type: "string", demandOption: true })
      .option("force", { type: "boolean", alias: "f", describe: "Force removal even with uncommitted changes" })
      .option("yes", { type: "boolean", alias: "y", describe: "Skip confirmation prompt" }),
  handler: async (argv) => {
    const branchOrPath = argv["branch-or-path"] as string;
    const force = !!argv.force;
    const yes = !!argv.yes;

    try {
      const mainRepoPath = await GitWorktree.getMainRepoPath().catch(() => process.cwd());
      const worktrees = await GitWorktree.list(mainRepoPath);

      const target = worktrees.find(
        (wt) => wt.branch === branchOrPath || wt.path === branchOrPath || wt.path.endsWith("/" + branchOrPath),
      );
      if (!target) {
        console.error(`Error: no worktree found for '${branchOrPath}'`);
        process.exit(1);
      }
      if (target.isMain) {
        console.error(`Error: cannot remove the main worktree`);
        process.exit(1);
      }

      const dirty = await GitWorktree.isDirty(target.path);
      if (dirty && !force) {
        console.error(`Error: worktree has uncommitted changes: ${target.path}`);
        console.error(`Use --force to remove anyway.`);
        process.exit(1);
      }
      if (target.isLocked) {
        console.error(`Error: worktree is locked: ${target.path}`);
        if (target.lockReason) console.error(`Lock reason: ${target.lockReason}`);
        process.exit(1);
      }

      if (!yes) {
        const confirmed = await confirm(`Remove worktree '${target.branch ?? basename(target.path)}' at ${target.path}? [y/N] `);
        if (!confirmed) {
          console.log("Cancelled.");
          process.exit(0);
        }
      }

      const config = loadConfig();
      const repoConfig = getRepoConfig(config, mainRepoPath);
      if (repoConfig.postRemove.length > 0) {
        console.log("Running postRemove hooks...");
        await executeHooks(repoConfig.postRemove, {
          cwd: target.path,
          env: {
            OMW_BRANCH: target.branch ?? "",
            OMW_WORKTREE_PATH: target.path,
            OMW_REPO_PATH: mainRepoPath,
          },
          onOutput: (line) => console.log(`  ${line}`),
        }).catch((err) => console.warn(`Warning: postRemove hook failed: ${(err as Error).message}`));
      }

      const focusPaths = readFocus(target.path) ?? [];
      if (focusPaths.length > 0 && repoConfig.monorepo?.hooks && repoConfig.monorepo.hooks.length > 0) {
        const matches = matchHooksForFocus(repoConfig.monorepo.hooks, focusPaths);
        if (matches.length > 0) {
          const repoName = basename(mainRepoPath);
          const removeBranch = target.branch ?? "unknown";
          console.log("  Running monorepo postRemove hooks...");
          await executeGlobHooks(matches, "postRemove", {
            cwd: target.path,
            env: {
              OMW_BRANCH: removeBranch,
              OMW_WORKTREE_PATH: target.path,
              OMW_REPO_PATH: mainRepoPath,
              OMW_FOCUS_PATHS: focusPaths.join(","),
            },
            repo: repoName,
            branch: removeBranch,
            focusPaths,
            mainRepoPath,
            onOutput: (line) => console.log(`    ${line}`),
          });
          console.log("  ✓ Monorepo hooks completed");
        }
      }

      await GitWorktree.remove(target.path, { force }, mainRepoPath);
      console.log(`Removed worktree: ${target.path}`);
      process.exit(0);
    } catch (err) {
      if (err instanceof GitError) {
        console.error(`Git error: ${err.message}`);
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exit(1);
    }
  },
};

export default cmd;
