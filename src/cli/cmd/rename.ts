import type { CommandModule } from "yargs";
import { GitWorktree } from "../../core/git.ts";
import { resolveMainRepo, findWorktreeOrExit, handleCliError } from "../utils.ts";
import { renameWorktreeFlow, RENAME_STEP_IDS } from "../../core/orchestration/index.ts";

const cmd: CommandModule = {
  command: "rename <old> <new>",
  describe: "Rename worktree branch",
  builder: (yargs) =>
    yargs
      .positional("old", { type: "string", demandOption: true, describe: "Current branch name" })
      .positional("new", { type: "string", demandOption: true, describe: "New branch name" })
      .option("move-path", { type: "boolean", describe: "Also rename the worktree directory path" }),
  handler: async (argv) => {
    const oldBranch = argv.old as string;
    const newBranch = argv.new as string;
    const movePath = !!argv["move-path"];

    try {
      const mainRepoPath = await resolveMainRepo();
      const worktrees = await GitWorktree.list(mainRepoPath);
      const target = findWorktreeOrExit(worktrees, oldBranch);

      if (target.isMain) {
        console.error(`Error: cannot rename the main worktree branch`);
        process.exit(1);
      }

      const existing = worktrees.find((wt) => wt.branch === newBranch);
      if (existing) {
        console.error(`Error: branch '${newBranch}' already exists`);
        process.exit(1);
      }

      await renameWorktreeFlow(
        {
          mainRepoPath,
          oldBranch,
          newBranch,
          worktreePath: target.path,
          movePath,
        },
        {
          onStepDone: (id, message) => {
            if (id === RENAME_STEP_IDS.renameBranch) console.log(`Renamed branch: ${oldBranch} → ${newBranch}`);
            else if (id === RENAME_STEP_IDS.movePath && message && message.includes("→")) {
              console.log(`Moved worktree: ${message}`);
            }
          },
          onStepError: (id, message) => console.warn(`  ⚠ ${id}: ${message}`),
        },
      );

      process.exit(0);
    } catch (err) {
      handleCliError(err);
    }
  },
};

export default cmd;
