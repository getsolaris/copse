import type { CommandModule } from "yargs";
import { ImportError } from "../../core/types.ts";
import { importWorktreeFlow } from "../../core/orchestration/index.ts";

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
    const rawPath = argv.path as string;
    const rawFocus = argv.focus as string[] | undefined;
    const focusPaths = rawFocus?.flatMap((focus) => focus.split(/[,\s]+/)).map((focus) => focus.trim()).filter(Boolean) ?? [];
    const pin = !!argv.pin;

    try {
      const worktree = await importWorktreeFlow({
        targetPath: rawPath,
        focusPaths,
        pin,
      });

      const branch = worktree.branch ?? "unknown";
      console.log(`Imported worktree: ${branch} at ${worktree.path}`);
      if (focusPaths.length > 0) console.log(`  Focus: ${focusPaths.join(", ")}`);
      if (pin) console.log("  Pinned");

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
