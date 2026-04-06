import type { CommandModule } from "yargs";
import { GitWorktree } from "../../core/git.ts";
import { listPinnedWorktrees, readPin, removePin, writePin } from "../../core/pin.ts";
import { handleCliError } from "../utils.ts";

const cmd: CommandModule = {
  command: "pin [branch]",
  aliases: ["unpin"],
  describe: "Pin or unpin a worktree",
  builder: (yargs) =>
    yargs
      .positional("branch", { type: "string", describe: "Branch name" })
      .option("reason", {
        type: "string",
        describe: "Reason for pinning",
      })
      .option("list", {
        type: "boolean",
        describe: "List pinned worktrees",
      })
      .option("json", {
        type: "boolean",
        alias: "j",
        describe: "Output as JSON",
      })
      .option("unpin", {
        type: "boolean",
        describe: "Unpin instead of pinning",
      }),
  handler: async (argv) => {
    try {
      const args = argv as unknown as { branch?: string; reason?: string };
      const worktrees = await GitWorktree.list();

      if (argv.list) {
        const pinned = listPinnedWorktrees(worktrees).map((worktree) => ({
          ...worktree,
          pin: readPin(worktree.path),
        }));

        if (argv.json) {
          console.log(JSON.stringify(pinned, null, 2));
          process.exit(0);
        }

        if (pinned.length === 0) {
          console.log("No pinned worktrees found.");
          process.exit(0);
        }

        const branchWidth = Math.max("Branch".length, ...pinned.map((wt) => (wt.branch ?? "(detached)").length));
        const pathWidth = Math.max("Path".length, ...pinned.map((wt) => wt.path.length));
        const reasonWidth = Math.max(
          "Reason".length,
          ...pinned.map((wt) => (wt.pin?.reason ?? "—").length),
        );
        const pinnedAtWidth = Math.max(
          "Pinned At".length,
          ...pinned.map((wt) => (wt.pin?.pinnedAt ?? "—").length),
        );

        console.log(
          `${"Branch".padEnd(branchWidth)}  ${"Path".padEnd(pathWidth)}  ${"Reason".padEnd(reasonWidth)}  ${"Pinned At".padEnd(pinnedAtWidth)}`,
        );
        console.log(
          `${"-".repeat(branchWidth)}  ${"-".repeat(pathWidth)}  ${"-".repeat(reasonWidth)}  ${"-".repeat(pinnedAtWidth)}`,
        );

        for (const wt of pinned) {
          console.log(
            `${(wt.branch ?? "(detached)").padEnd(branchWidth)}  ${wt.path.padEnd(pathWidth)}  ${(wt.pin?.reason ?? "—").padEnd(reasonWidth)}  ${(wt.pin?.pinnedAt ?? "—").padEnd(pinnedAtWidth)}`,
          );
        }

        process.exit(0);
      }

      const isUnpinMode = argv._[0] === "unpin" || !!argv.unpin;
      const branch = typeof args.branch === "string" ? args.branch : typeof argv._[1] === "string" ? argv._[1] : undefined;

      if (!branch) {
        console.error("Error: branch is required");
        process.exit(1);
      }

      const target = worktrees.find((wt) => wt.branch === branch);

      if (!target) {
        console.error(`Error: no worktree found for '${branch}'`);
        process.exit(1);
      }

      if (isUnpinMode) {
        if (!readPin(target.path)) {
          console.warn(`Warning: worktree is not pinned: ${target.path}`);
          process.exit(0);
        }

        removePin(target.path);
        console.log(`Unpinned worktree: ${target.path}`);
        process.exit(0);
      }

      if (readPin(target.path)) {
        console.warn(`Warning: worktree is already pinned: ${target.path}`);
        process.exit(0);
      }

      const reason = typeof args.reason === "string" ? args.reason : undefined;
      writePin(target.path, reason);
      console.log(`Pinned worktree: ${target.path}`);
      process.exit(0);
    } catch (err) {
      handleCliError(err);
    }
  },
};

export default cmd;
