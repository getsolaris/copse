import type { CommandModule } from "yargs";
import { GitWorktree, invalidateGitCache } from "../../core/git.ts";
import { logActivity } from "../../core/activity-log.ts";
import { dirname, basename, join } from "node:path";
import { resolveMainRepo, findWorktreeOrExit, handleCliError } from "../utils.ts";

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

      await GitWorktree.exec(["branch", "-m", oldBranch, newBranch], mainRepoPath);
      invalidateGitCache();

      if (movePath) {
        const branchSlug = newBranch.replace(/\//g, "-");
        const parentDir = dirname(target.path);
        const oldBasename = basename(target.path);
        const oldBranchSlug = oldBranch.replace(/\//g, "-");
        const newBasename = oldBasename.replace(oldBranchSlug, branchSlug);
        const newPath = join(parentDir, newBasename);

        if (newPath !== target.path) {
          await GitWorktree.move(target.path, newPath, mainRepoPath);
          invalidateGitCache();
          console.log(`Moved worktree: ${target.path} → ${newPath}`);
        }
      }

      console.log(`Renamed branch: ${oldBranch} → ${newBranch}`);
      try {
        logActivity(mainRepoPath, {
          timestamp: new Date().toISOString(),
          event: "rename",
          branch: newBranch,
          details: { oldBranch: oldBranch },
        });
      } catch {}
      process.exit(0);
    } catch (err) {
      handleCliError(err);
    }
  },
};

export default cmd;
