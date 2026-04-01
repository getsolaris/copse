import type { CommandModule } from "yargs";
import { GitWorktree } from "../../core/git.ts";
import { GitError } from "../../core/types.ts";
import { loadConfig, getConfiguredRepoPaths } from "../../core/config.ts";
import { readFocus } from "../../core/focus.ts";
import { relative, resolve } from "node:path";

const cmd: CommandModule = {
  command: "list",
  aliases: ["ls"],
  describe: "List all worktrees with their status",
  builder: (yargs) =>
    yargs
      .option("json", {
        type: "boolean",
        alias: "j",
        describe: "Output as JSON",
      })
      .option("porcelain", {
        type: "boolean",
        alias: "p",
        describe: "Machine-readable output",
      })
      .option("all", {
        type: "boolean",
        alias: "a",
        describe: "List worktrees from all configured repos",
      }),
  handler: async (argv) => {
    try {
      let worktrees;

      if (argv.all) {
        const config = loadConfig();
        const currentRepo = await GitWorktree.getMainRepoPath().catch(() => process.cwd());
        const configPaths = getConfiguredRepoPaths(config);

        const seen = new Set([resolve(currentRepo)]);
        const repoPaths = [currentRepo];
        for (const p of configPaths) {
          const resolved = resolve(p);
          if (!seen.has(resolved)) {
            seen.add(resolved);
            repoPaths.push(p);
          }
        }

        worktrees = await GitWorktree.listAll(repoPaths);
      } else {
        worktrees = await GitWorktree.list();
      }

      const worktreesWithFocus = await Promise.all(
        worktrees.map(async (wt) => ({
          ...wt,
          focus: readFocus(wt.path),
        })),
      );

      if (argv.json) {
        console.log(JSON.stringify(worktreesWithFocus, null, 2));
        process.exit(0);
      }

      if (argv.porcelain) {
        for (const wt of worktreesWithFocus) {
          if (argv.all) console.log(`repo\t${wt.repoName}`);
          console.log(`path\t${wt.path}`);
          console.log(`branch\t${wt.branch ?? "(detached)"}`);
          console.log(`head\t${wt.head}`);
          console.log(`dirty\t${wt.isDirty}`);
          console.log(`locked\t${wt.isLocked}`);
          if (wt.focus && wt.focus.length > 0) {
            console.log(`focus\t${wt.focus.join(",")}`);
          }
          console.log("");
        }

        process.exit(0);
      }

      if (worktrees.length === 0) {
        console.log("No worktrees found.");
        process.exit(0);
      }

      const cwd = resolve(process.cwd());
      const showRepo = argv.all && new Set(worktreesWithFocus.map((wt) => wt.repoName)).size > 1;

      const rows = worktreesWithFocus.map((wt) => ({
        repo: wt.repoName,
        branch: wt.branch ?? "(detached)",
        path: wt.path === cwd ? wt.path : relative(cwd, wt.path) || wt.path,
        status: wt.isLocked ? "locked" : wt.isDirty ? "dirty" : "clean",
        focus: wt.focus ? wt.focus.join(", ").slice(0, 40) + (wt.focus.join(", ").length > 40 ? "..." : "") : "—",
      }));

      if (showRepo) {
        const repoWidth = Math.max("Repo".length, ...rows.map((r) => r.repo.length));
        const branchWidth = Math.max("Branch".length, ...rows.map((r) => r.branch.length));
        const pathWidth = Math.max("Path".length, ...rows.map((r) => r.path.length));
        const statusWidth = Math.max("Status".length, ...rows.map((r) => r.status.length));
        const focusWidth = Math.max("Focus".length, ...rows.map((r) => r.focus.length));

        console.log(
          `${"Repo".padEnd(repoWidth)}  ${"Branch".padEnd(branchWidth)}  ${"Path".padEnd(pathWidth)}  ${"Status".padEnd(statusWidth)}  ${"Focus".padEnd(focusWidth)}`,
        );
        console.log(
          `${"-".repeat(repoWidth)}  ${"-".repeat(branchWidth)}  ${"-".repeat(pathWidth)}  ${"-".repeat(statusWidth)}  ${"-".repeat(focusWidth)}`,
        );

        for (const row of rows) {
          console.log(
            `${row.repo.padEnd(repoWidth)}  ${row.branch.padEnd(branchWidth)}  ${row.path.padEnd(pathWidth)}  ${row.status.padEnd(statusWidth)}  ${row.focus.padEnd(focusWidth)}`,
          );
        }
      } else {
        const branchWidth = Math.max("Branch".length, ...rows.map((r) => r.branch.length));
        const pathWidth = Math.max("Path".length, ...rows.map((r) => r.path.length));
        const statusWidth = Math.max("Status".length, ...rows.map((r) => r.status.length));
        const focusWidth = Math.max("Focus".length, ...rows.map((r) => r.focus.length));

        console.log(
          `${"Branch".padEnd(branchWidth)}  ${"Path".padEnd(pathWidth)}  ${"Status".padEnd(statusWidth)}  ${"Focus".padEnd(focusWidth)}`,
        );
        console.log(
          `${"-".repeat(branchWidth)}  ${"-".repeat(pathWidth)}  ${"-".repeat(statusWidth)}  ${"-".repeat(focusWidth)}`,
        );

        for (const row of rows) {
          console.log(
            `${row.branch.padEnd(branchWidth)}  ${row.path.padEnd(pathWidth)}  ${row.status.padEnd(statusWidth)}  ${row.focus.padEnd(focusWidth)}`,
          );
        }
      }

      process.exit(0);
    } catch (err) {
      if (err instanceof GitError) {
        if (err.stderr.includes("not a git repository")) {
          console.error("Error: not a git repository (or any of the parent directories): .git");
          console.error("Run omw from within a git repository.");
        } else {
          console.error(`Git error: ${err.message}`);
        }
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }

      process.exit(1);
    }
  },
};

export default cmd;
