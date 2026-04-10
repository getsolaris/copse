import type { CommandModule } from "yargs";
import { resolve } from "node:path";
import { importWorktree, validateImportTarget } from "../../core/import.ts";
import { invalidateGitCache } from "../../core/git.ts";
import { logActivity } from "../../core/activity-log.ts";
import { ImportError } from "../../core/types.ts";
import { resolveMainRepo } from "../utils.ts";

const cmd: CommandModule = {
  command: "import <path>",
  describe: "Adopt a worktree with copse metadata",
  builder: (yargs) =>
    yargs
      .positional("path", {
        type: "string",
        describe: "Existing worktree directory path",
        demandOption: true,
      })
      .option("focus", {
        type: "array",
        alias: "f",
        describe: "Focus packages for monorepo (comma or space separated paths)",
        string: true,
      })
      .option("pin", {
        type: "boolean",
        describe: "Pin the worktree",
      }),
  handler: async (argv) => {
    const path = resolve(argv.path as string);
    const validation = validateImportTarget(path);

    if (!validation.valid) {
      console.error(`Error: ${validation.reason ?? "invalid import target"}`);
      process.exit(1);
    }

    const rawFocus = argv.focus as string[] | undefined;
    const focusPaths = rawFocus?.flatMap((focus) => focus.split(/[,\s]+/)).map((focus) => focus.trim()).filter(Boolean) ?? [];
    const pin = !!argv.pin;

    try {
      const worktree = await importWorktree(path, {
        focus: focusPaths,
        pin,
      });

      invalidateGitCache();

      const branch = worktree.branch ?? validation.branch ?? "unknown";
      const mainRepoPath = worktree.repoPath ?? (await resolveMainRepo());
      console.log(`Imported worktree: ${branch} at ${worktree.path}`);
      try {
        logActivity(mainRepoPath, {
          timestamp: new Date().toISOString(),
          event: "import",
          branch: worktree.branch ?? validation.branch ?? "unknown",
          path: worktree.path,
        });
      } catch {}

      if (focusPaths.length > 0) {
        console.log(`  Focus: ${focusPaths.join(", ")}`);
      }

      if (pin) {
        console.log("  Pinned");
      }

      process.exit(0);
    } catch (err) {
      if (err instanceof ImportError) {
        console.error(`Error: ${err.reason}`);
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exit(1);
    }
  },
};

export default cmd;
