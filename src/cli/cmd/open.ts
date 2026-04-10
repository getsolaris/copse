import type { CommandModule } from "yargs";
import { GitWorktree } from "../../core/git.ts";
import { existsSync } from "node:fs";
import { FocusNotFoundError, resolveFocusOpenTarget } from "../../core/focus.ts";
import { resolveMainRepo, findWorktreeOrExit, handleCliError } from "../utils.ts";

const KNOWN_EDITORS = ["code", "cursor", "vim", "nvim", "emacs", "nano", "subl", "zed", "idea", "webstorm"] as const;

function detectEditor(override?: string): string | null {
  if (override) return override;

  const envEditor = process.env.VISUAL || process.env.EDITOR;
  if (envEditor) return envEditor;

  for (const editor of KNOWN_EDITORS) {
    try {
      const proc = Bun.spawnSync(["which", editor], { stdout: "pipe", stderr: "pipe" });
      if (proc.exitCode === 0) return editor;
    } catch {
      continue;
    }
  }

  return null;
}

const cmd: CommandModule = {
  command: "open [branch-or-path]",
  describe: "Open a worktree in your editor/IDE",
  builder: (yargs) =>
    yargs
      .positional("branch-or-path", {
        type: "string",
        describe: "Branch name or worktree path (defaults to current worktree)",
      })
      .option("editor", {
        type: "string",
        alias: "e",
        describe: "Editor command to use (overrides $VISUAL/$EDITOR)",
      })
      .option("focus", {
        type: "string",
        alias: "f",
        describe: "Open a specific focus path (must match an existing focus entry)",
      })
      .option("root", {
        type: "boolean",
        describe: "Force opening the worktree root, ignoring focus paths",
        default: false,
      })
      .option("list-editors", {
        type: "boolean",
        describe: "List detected editors",
      }),
  handler: async (argv) => {
    if (argv["list-editors"]) {
      const envEditor = process.env.VISUAL || process.env.EDITOR;
      if (envEditor) {
        console.log(`$VISUAL/$EDITOR: ${envEditor}`);
      }

      for (const editor of KNOWN_EDITORS) {
        try {
          const proc = Bun.spawnSync(["which", editor], { stdout: "pipe", stderr: "pipe" });
          if (proc.exitCode === 0) {
            const path = new TextDecoder().decode(proc.stdout).trim();
            console.log(`  ${editor}: ${path}`);
          }
        } catch {
        }
      }

      process.exit(0);
    }

    try {
      const branchOrPath = argv["branch-or-path"] as string | undefined;
      const explicitFocus = argv.focus as string | undefined;
      const forceRoot = Boolean(argv.root);

      let worktreePath: string;

      if (!branchOrPath) {
        worktreePath = process.cwd();
      } else {
        const mainRepoPath = await resolveMainRepo();
        const worktrees = await GitWorktree.list(mainRepoPath);
        const target = findWorktreeOrExit(worktrees, branchOrPath);
        worktreePath = target.path;
      }

      if (!existsSync(worktreePath)) {
        console.error(`Error: worktree path does not exist: ${worktreePath}`);
        process.exit(1);
      }

      let resolution;
      try {
        resolution = resolveFocusOpenTarget(worktreePath, { explicitFocus, forceRoot });
      } catch (err) {
        if (err instanceof FocusNotFoundError) {
          console.error(`Error: ${err.message}`);
          process.exit(1);
        }
        throw err;
      }

      let targetPath: string;
      if (resolution.kind === "multiple") {
        console.error(
          `Error: worktree has multiple focus paths set: ${resolution.focusPaths.join(", ")}`,
        );
        console.error(
          "Use --focus <path> to pick one, or --root to open the worktree root.",
        );
        process.exit(1);
      }

      targetPath = resolution.path;

      if (!existsSync(targetPath)) {
        console.error(`Error: target path does not exist: ${targetPath}`);
        if (resolution.kind === "single") {
          console.error("The focus path may have been deleted. Try --root to open the worktree root.");
        }
        process.exit(1);
      }

      const editor = detectEditor(argv.editor as string | undefined);

      if (!editor) {
        console.error("Error: no editor detected.");
        console.error("Set $VISUAL or $EDITOR, or use --editor <command>.");
        console.error("Detected editors can be listed with: copse open --list-editors");
        process.exit(1);
      }

      const focusLabel = resolution.kind === "single" ? ` [focus: ${resolution.focus}]` : "";
      console.log(`Opening ${targetPath} with ${editor}${focusLabel}...`);

      const proc = Bun.spawn([editor, targetPath], {
        stdout: "inherit",
        stderr: "inherit",
        stdin: "inherit",
      });

      await proc.exited;
      process.exit(0);
    } catch (err) {
      handleCliError(err);
    }
  },
};

export default cmd;
