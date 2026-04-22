import type { CommandModule } from "yargs";
import { basename } from "node:path";
import { GitWorktree } from "../../core/git.ts";
import { listArchives } from "../../core/archive.ts";
import { loadConfig } from "../../core/config.ts";
import { confirm, resolveMainRepo, findWorktreeOrExit, handleCliError } from "../utils.ts";
import { archiveWorktreeFlow, ARCHIVE_STEP_IDS, REMOVE_STEP_IDS } from "../../core/orchestration/index.ts";

const cmd: CommandModule = {
  command: "archive [branch]",
  describe: "Archive worktree changes and optionally remove",
  builder: (yargs) =>
    yargs
      .positional("branch", { type: "string", describe: "Branch name or worktree path" })
      .option("yes", { type: "boolean", alias: "y", describe: "Skip confirmation prompt" })
      .option("keep", { type: "boolean", describe: "Archive without removing the worktree" })
      .option("list", { type: "boolean", describe: "List all archives" })
      .option("json", { type: "boolean", alias: "j", describe: "Output as JSON (with --list)" }),
  handler: async (argv) => {
    const branch = argv.branch as string | undefined;
    const yes = !!argv.yes;
    const keep = !!argv.keep;
    const list = !!argv.list;
    const json = !!argv.json;

    try {
      if (list) {
        const archives = await listArchives();
        if (json) {
          console.log(JSON.stringify(archives, null, 2));
        } else if (archives.length === 0) {
          console.log("No archives found.");
        } else {
          console.log("Archives:\n");
          for (const entry of archives) {
            const date = new Date(entry.archivedAt).toLocaleString();
            console.log(`  ${entry.repo}/${entry.branch}`);
            console.log(`    Date:   ${date}`);
            console.log(`    Commit: ${entry.commitHash.slice(0, 8)} ${entry.message}`);
            console.log(`    Patch:  ${entry.patchPath}`);
            console.log();
          }
        }
        process.exit(0);
      }

      if (!branch) {
        console.error("Error: branch name is required (or use --list to view archives)");
        process.exit(1);
      }

      const mainRepoPath = await resolveMainRepo();
      const worktrees = await GitWorktree.list(mainRepoPath);
      const target = findWorktreeOrExit(worktrees, branch);

      if (target.isMain) {
        console.error(`Error: cannot archive the main worktree`);
        process.exit(1);
      }

      const action = keep ? "Archive" : "Archive and remove";
      if (!yes) {
        const confirmed = await confirm(`${action} worktree '${target.branch ?? basename(target.path)}'? [y/N] `);
        if (!confirmed) {
          console.log("Cancelled.");
          process.exit(0);
        }
      }

      const config = loadConfig();
      const repoName = basename(mainRepoPath);

      await archiveWorktreeFlow(
        config,
        {
          worktreePath: target.path,
          mainRepoPath,
          repoName,
          branch: target.branch ?? null,
          keep,
          force: false,
        },
        {
          onStepStart: (id) => {
            if (id === REMOVE_STEP_IDS.postRemove) console.log("Running postRemove hooks...");
            else if (id === REMOVE_STEP_IDS.monorepoHooks) console.log("  Running monorepo postRemove hooks...");
          },
          onStepDone: (id, message) => {
            if (id === ARCHIVE_STEP_IDS.createArchive && message) console.log(`Archived: ${message}`);
            else if (id === REMOVE_STEP_IDS.monorepoHooks) console.log("  ✓ Monorepo hooks completed");
            else if (id === REMOVE_STEP_IDS.session && message === "killed") console.log("  ✓ Session killed");
            else if (id === REMOVE_STEP_IDS.worktree) console.log(`Removed worktree: ${target.path}`);
          },
          onStepError: (id, message) => {
            if (id === REMOVE_STEP_IDS.postRemove) console.warn(`Warning: postRemove hook failed: ${message}`);
            else console.warn(`  ⚠ ${id}: ${message}`);
          },
          onHookOutput: (line) => console.log(`  ${line}`),
        },
      );

      process.exit(0);
    } catch (err) {
      handleCliError(err);
    }
  },
};

export default cmd;
