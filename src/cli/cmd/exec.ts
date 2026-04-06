import type { CommandModule } from "yargs";
import { GitWorktree } from "../../core/git.ts";
import { loadConfig, getConfiguredRepoPaths } from "../../core/config.ts";
import { mapWithLimit } from "../../core/concurrency.ts";
import { resolve } from "node:path";
import { resolveMainRepo, handleCliError } from "../utils.ts";

interface ExecResult {
  branch: string;
  path: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

const cmd: CommandModule = {
  command: "exec <command>",
  describe: "Run a command in each worktree",
  builder: (yargs) =>
    yargs
      .positional("command", {
        type: "string",
        describe: "Shell command to execute",
        demandOption: true,
      })
      .option("all", {
        type: "boolean",
        alias: "a",
        describe: "Run across all configured repos",
      })
      .option("dirty", {
        type: "boolean",
        describe: "Only run in dirty worktrees",
      })
      .option("clean", {
        type: "boolean",
        describe: "Only run in clean worktrees",
      })
      .option("behind", {
        type: "boolean",
        describe: "Only run in worktrees behind upstream",
      })
      .option("parallel", {
        type: "boolean",
        alias: "p",
        describe: "Run commands in parallel (default: sequential)",
      })
      .option("json", {
        type: "boolean",
        alias: "j",
        describe: "Output results as JSON",
      }),
  handler: async (argv) => {
    const shellCommand = argv.command as string;
    const parallel = !!argv.parallel;
    const jsonOutput = !!argv.json;

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

      let filtered = worktrees.filter((wt) => !wt.isMain);

      if (argv.dirty) {
        filtered = filtered.filter((wt) => wt.isDirty);
      }
      if (argv.clean) {
        filtered = filtered.filter((wt) => !wt.isDirty);
      }
      if (argv.behind) {
        const withSync = await mapWithLimit(filtered, 10, async (wt) => {
          if (!wt.branch) return { wt, behind: false };
          const sync = await GitWorktree.getAheadBehind(wt.branch, wt.path);
          return { wt, behind: sync.behind > 0 };
        });
        filtered = withSync.filter((s) => s.behind).map((s) => s.wt);
      }

      if (filtered.length === 0) {
        console.log("No matching worktrees found.");
        process.exit(0);
      }

      if (!jsonOutput) {
        console.log(`Running '${shellCommand}' in ${filtered.length} worktree(s)...\n`);
      }

      const runOne = async (wt: typeof filtered[0]): Promise<ExecResult> => {
        const proc = (Bun as any).spawn(["sh", "-c", shellCommand], {
          cwd: wt.path,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...(Bun as any).env,
            OMW_BRANCH: wt.branch ?? "",
            OMW_WORKTREE_PATH: wt.path,
            OMW_REPO_PATH: wt.repoPath,
          },
        });

        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
          proc.exited,
        ]);

        return {
          branch: wt.branch ?? "(detached)",
          path: wt.path,
          exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        };
      };

      let results: ExecResult[];

      if (parallel) {
        results = await mapWithLimit(filtered, 10, runOne);
      } else {
        results = [];
        for (const wt of filtered) {
          results.push(await runOne(wt));
        }
      }

      if (jsonOutput) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        for (const r of results) {
          const icon = r.exitCode === 0 ? "✓" : "✗";
          console.log(`${icon} ${r.branch} (exit ${r.exitCode})`);
          if (r.stdout) {
            for (const line of r.stdout.split("\n")) {
              console.log(`    ${line}`);
            }
          }
          if (r.stderr) {
            for (const line of r.stderr.split("\n")) {
              console.log(`    ${line}`);
            }
          }
          console.log();
        }

        const passed = results.filter((r) => r.exitCode === 0).length;
        const failed = results.length - passed;
        console.log(`Done: ${passed} passed, ${failed} failed`);
      }

      const hasFailure = results.some((r) => r.exitCode !== 0);
      process.exit(hasFailure ? 1 : 0);
    } catch (err) {
      handleCliError(err);
    }
  },
};

export default cmd;
