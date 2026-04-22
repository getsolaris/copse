import type { CommandModule } from "yargs";
import { basename } from "node:path";
import { GitWorktree } from "../../core/git.ts";
import { loadConfig } from "../../core/config.ts";
import { confirm, resolveMainRepo, findWorktreeOrExit, handleCliError } from "../utils.ts";
import { removeWorktreeFlow, REMOVE_STEP_IDS } from "../../core/orchestration/index.ts";

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
      const mainRepoPath = await resolveMainRepo();
      const worktrees = await GitWorktree.list(mainRepoPath);
      const target = findWorktreeOrExit(worktrees, branchOrPath);

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
        const confirmed = await confirm(
          `Remove worktree '${target.branch ?? basename(target.path)}' at ${target.path}? [y/N] `,
        );
        if (!confirmed) {
          console.log("Cancelled.");
          process.exit(0);
        }
      }

      const config = loadConfig();
      const repoName = basename(mainRepoPath);

      await removeWorktreeFlow(
        config,
        {
          worktreePath: target.path,
          mainRepoPath,
          repoName,
          branch: target.branch ?? branchOrPath,
          force,
        },
        {
          onStepStart: (id) => {
            if (id === REMOVE_STEP_IDS.postRemove) console.log("Running postRemove hooks...");
            else if (id === REMOVE_STEP_IDS.monorepoHooks) console.log("  Running monorepo postRemove hooks...");
          },
          onStepDone: (id, message) => {
            if (id === REMOVE_STEP_IDS.monorepoHooks) console.log("  ✓ Monorepo hooks completed");
            else if (id === REMOVE_STEP_IDS.session && message === "killed") console.log("  ✓ Session killed");
          },
          onStepError: (id, message) => {
            if (id === REMOVE_STEP_IDS.postRemove) console.warn(`Warning: postRemove hook failed: ${message}`);
            else console.warn(`  ⚠ ${id}: ${message}`);
          },
          onHookOutput: (line) => console.log(`    ${line}`),
        },
      );

      console.log(`Removed worktree: ${target.path}`);
      process.exit(0);
    } catch (err) {
      handleCliError(err);
    }
  },
};

export default cmd;
