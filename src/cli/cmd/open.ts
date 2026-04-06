import type { CommandModule } from "yargs";
import { GitWorktree } from "../../core/git.ts";
import { existsSync } from "node:fs";
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

      let targetPath: string;

      if (!branchOrPath) {
        targetPath = process.cwd();
      } else {
        const mainRepoPath = await resolveMainRepo();
        const worktrees = await GitWorktree.list(mainRepoPath);
        const target = findWorktreeOrExit(worktrees, branchOrPath);
        targetPath = target.path;
      }

      if (!existsSync(targetPath)) {
        console.error(`Error: worktree path does not exist: ${targetPath}`);
        process.exit(1);
      }

      const editor = detectEditor(argv.editor as string | undefined);

      if (!editor) {
        console.error("Error: no editor detected.");
        console.error("Set $VISUAL or $EDITOR, or use --editor <command>.");
        console.error("Detected editors can be listed with: omw open --list-editors");
        process.exit(1);
      }

      console.log(`Opening ${targetPath} with ${editor}...`);

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
