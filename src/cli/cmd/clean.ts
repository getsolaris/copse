import type { CommandModule } from "yargs";
import { GitWorktree } from "../../core/git.ts";
import { loadConfig } from "../../core/config.ts";
import { mapWithLimit } from "../../core/concurrency.ts";
import { analyzeLifecycle, formatLifecycleReport } from "../../core/lifecycle.ts";
import { isPinned } from "../../core/pin.ts";
import { confirm, resolveMainRepo, handleCliError } from "../utils.ts";

const cmd: CommandModule = {
  command: "clean",
  describe: "Remove merged worktrees and prune stale entries",
  builder: (yargs) =>
    yargs
      .option("dry-run", { type: "boolean", alias: "n", describe: "Show what would be removed" })
      .option("yes", { type: "boolean", alias: "y", describe: "Skip confirmation" })
      .option("stale", { type: "boolean", describe: "Also show stale worktrees (based on lifecycle config)" }),
  handler: async (argv) => {
    const dryRun = !!(argv["dry-run"] || argv.n);
    const yes = !!argv.yes;

    try {
      const mainRepoPath = await resolveMainRepo();
      const worktrees = await GitWorktree.list(mainRepoPath);

      const mainWorktree = worktrees.find((wt) => wt.isMain) ?? worktrees[0];
      const mainBranch = mainWorktree?.branch ?? "main";

      const candidates = worktrees.filter((wt) => {
        if (wt.isMain) return false;
        if (isPinned(wt.path)) {
          console.log(`  Skipping (pinned): ${wt.branch}`);
          return false;
        }
        if (!wt.branch) return false;
        return true;
      });

      const checked = await mapWithLimit(candidates, 10, async (wt) => {
        const [merged, dirty] = await Promise.all([
          GitWorktree.isMergedInto(wt.branch!, mainBranch, mainRepoPath),
          GitWorktree.isDirty(wt.path),
        ]);
        return { wt, merged, dirty };
      });

      const toClean: typeof worktrees = [];
      for (const { wt, merged, dirty } of checked) {
        if (!merged) continue;
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

      if (!dryRun) {
        await GitWorktree.prune(mainRepoPath);
        console.log("Pruned stale worktree entries.");
      }

      if (argv.stale) {
        const config = loadConfig();
        if (config.lifecycle) {
          const report = await analyzeLifecycle(worktrees, config.lifecycle, mainBranch, mainRepoPath);
          console.log();
          console.log(formatLifecycleReport(report));
        } else {
          console.log("\nNo lifecycle config found. Add 'lifecycle' to your config to enable stale detection.");
        }
      }

      process.exit(0);
    } catch (err) {
      handleCliError(err);
    }
  },
};

export default cmd;
