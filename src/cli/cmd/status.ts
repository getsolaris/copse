import type { CommandModule } from "yargs";
import { GitWorktree } from "../../core/git.ts";
import { GitError } from "../../core/types.ts";
import { loadConfig, getConfiguredRepoPaths } from "../../core/config.ts";
import { readFocus } from "../../core/focus.ts";
import { resolve } from "node:path";
import { resolveMainRepo } from "../utils.ts";

interface StatusRow {
  repo: string;
  branch: string;
  dirty: string;
  sync: string;
  lastCommit: string;
  focus: string;
}

const cmd: CommandModule = {
  command: "status",
  aliases: ["st"],
  describe: "Show status overview of all worktrees",
  builder: (yargs) =>
    yargs
      .option("json", {
        type: "boolean",
        alias: "j",
        describe: "Output as JSON",
      })
      .option("all", {
        type: "boolean",
        alias: "a",
        describe: "Show worktrees from all configured repos",
      }),
  handler: async (argv) => {
    try {
      let worktrees;

      if (argv.all) {
        const config = loadConfig();
        const currentRepo = await resolveMainRepo();
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

      if (worktrees.length === 0) {
        console.log("No worktrees found.");
        process.exit(0);
      }

      const statusData = await Promise.all(
        worktrees.map(async (wt) => {
          const [aheadBehind, lastCommit, dirtyCount, focus] = await Promise.all([
            wt.branch
              ? GitWorktree.getAheadBehind(wt.branch, wt.path)
              : Promise.resolve({ ahead: 0, behind: 0 }),
            GitWorktree.getLastCommit(wt.path),
            GitWorktree.getDirtyCount(wt.path),
            Promise.resolve(readFocus(wt.path)),
          ]);

          return {
            ...wt,
            aheadBehind,
            lastCommit,
            dirtyCount,
            focus,
          };
        }),
      );

      if (argv.json) {
        console.log(JSON.stringify(statusData, null, 2));
        process.exit(0);
      }

      const cwd = resolve(process.cwd());
      const showRepo = argv.all && new Set(statusData.map((s) => s.repoName)).size > 1;

      const rows: StatusRow[] = statusData.map((s) => {
        const isCurrent = resolve(s.path) === cwd;
        const branchLabel = (isCurrent ? "* " : "  ") + (s.branch ?? "(detached)");

        let dirtyLabel: string;
        if (s.isLocked) {
          dirtyLabel = "locked";
        } else if (s.dirtyCount > 0) {
          dirtyLabel = `${s.dirtyCount} dirty`;
        } else {
          dirtyLabel = "clean";
        }

        const parts: string[] = [];
        if (s.aheadBehind.ahead > 0) parts.push(`+${s.aheadBehind.ahead}`);
        if (s.aheadBehind.behind > 0) parts.push(`-${s.aheadBehind.behind}`);
        const syncLabel = parts.length > 0 ? parts.join(" ") : "=";

        const commitLabel = s.lastCommit
          ? `${s.lastCommit.relativeDate}  ${truncate(s.lastCommit.message, 30)}`
          : "—";

        const focusLabel =
          s.focus && s.focus.length > 0
            ? truncate(s.focus.join(", "), 30)
            : "—";

        return {
          repo: s.repoName,
          branch: branchLabel,
          dirty: dirtyLabel,
          sync: syncLabel,
          lastCommit: commitLabel,
          focus: focusLabel,
        };
      });

      const cols = {
        branch: Math.max("Branch".length, ...rows.map((r) => r.branch.length)),
        dirty: Math.max("Status".length, ...rows.map((r) => r.dirty.length)),
        sync: Math.max("Sync".length, ...rows.map((r) => r.sync.length)),
        lastCommit: Math.max("Last Commit".length, ...rows.map((r) => r.lastCommit.length)),
        focus: Math.max("Focus".length, ...rows.map((r) => r.focus.length)),
        repo: Math.max("Repo".length, ...rows.map((r) => r.repo.length)),
      };

      if (showRepo) {
        const header =
          `${"Repo".padEnd(cols.repo)}  ${"Branch".padEnd(cols.branch)}  ${"Status".padEnd(cols.dirty)}  ${"Sync".padEnd(cols.sync)}  ${"Last Commit".padEnd(cols.lastCommit)}  ${"Focus".padEnd(cols.focus)}`;
        const separator =
          `${"-".repeat(cols.repo)}  ${"-".repeat(cols.branch)}  ${"-".repeat(cols.dirty)}  ${"-".repeat(cols.sync)}  ${"-".repeat(cols.lastCommit)}  ${"-".repeat(cols.focus)}`;

        console.log(header);
        console.log(separator);

        for (const row of rows) {
          console.log(
            `${row.repo.padEnd(cols.repo)}  ${row.branch.padEnd(cols.branch)}  ${row.dirty.padEnd(cols.dirty)}  ${row.sync.padEnd(cols.sync)}  ${row.lastCommit.padEnd(cols.lastCommit)}  ${row.focus.padEnd(cols.focus)}`,
          );
        }
      } else {
        const header =
          `${"Branch".padEnd(cols.branch)}  ${"Status".padEnd(cols.dirty)}  ${"Sync".padEnd(cols.sync)}  ${"Last Commit".padEnd(cols.lastCommit)}  ${"Focus".padEnd(cols.focus)}`;
        const separator =
          `${"-".repeat(cols.branch)}  ${"-".repeat(cols.dirty)}  ${"-".repeat(cols.sync)}  ${"-".repeat(cols.lastCommit)}  ${"-".repeat(cols.focus)}`;

        console.log(header);
        console.log(separator);

        for (const row of rows) {
          console.log(
            `${row.branch.padEnd(cols.branch)}  ${row.dirty.padEnd(cols.dirty)}  ${row.sync.padEnd(cols.sync)}  ${row.lastCommit.padEnd(cols.lastCommit)}  ${row.focus.padEnd(cols.focus)}`,
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

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

export default cmd;
