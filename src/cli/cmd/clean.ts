import type { CommandModule } from "yargs";
import { GitWorktree } from "../../core/git.ts";
import { GitError } from "../../core/types.ts";
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
  command: "clean",
  describe: "Remove merged worktrees and prune stale entries",
  builder: (yargs) =>
    yargs
      .option("dry-run", { type: "boolean", alias: "n", describe: "Show what would be removed" })
      .option("yes", { type: "boolean", alias: "y", describe: "Skip confirmation" }),
  handler: async (argv) => {
    const dryRun = !!(argv["dry-run"] || argv.n);
    const yes = !!argv.yes;

    try {
      const mainRepoPath = await GitWorktree.getMainRepoPath().catch(() => process.cwd());
      const worktrees = await GitWorktree.list(mainRepoPath);

      const mainWorktree = worktrees.find((wt) => wt.isMain) ?? worktrees[0];
      const mainBranch = mainWorktree?.branch ?? "main";

      const toClean: typeof worktrees = [];
      for (const wt of worktrees) {
        if (wt.isMain) continue;
        if (!wt.branch) continue;
        const merged = await GitWorktree.isMergedInto(wt.branch, mainBranch, mainRepoPath);
        if (!merged) continue;
        const dirty = await GitWorktree.isDirty(wt.path);
        if (dirty) {
          console.log(`  Skipping (dirty): ${wt.branch}`);
          continue;
        }
        toClean.push(wt);
      }

      if (toClean.length === 0) {
        console.log("No merged worktrees to clean.");
      } else {
        console.log(dryRun ? "Would remove:" : "To remove:");
        for (const wt of toClean) {
          console.log(`  ${wt.branch} (${wt.path})`);
        }
      }

      if (!dryRun && toClean.length > 0) {
        if (!yes) {
          const confirmed = await confirm(`\nRemove ${toClean.length} worktree(s)? [y/N] `);
          if (!confirmed) {
            console.log("Cancelled.");
            process.exit(0);
          }
        }
        for (const wt of toClean) {
          await GitWorktree.remove(wt.path, { force: false }, mainRepoPath);
          console.log(`  Removed: ${wt.branch}`);
        }
      }

      await GitWorktree.prune(mainRepoPath);
      if (!dryRun) console.log("Pruned stale worktree entries.");

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
