import type { CommandModule } from "yargs";
import { clearActivityLog, readActivityLog } from "../../core/activity-log.ts";
import { confirm, resolveMainRepo, handleCliError } from "../utils.ts";

function colorEvent(event: string): string {
  const colors: Record<string, string> = {
    create: "\x1b[32m",
    delete: "\x1b[31m",
    switch: "\x1b[34m",
    rename: "\x1b[33m",
    archive: "\x1b[35m",
    import: "\x1b[36m",
    reset: "\x1b[0m",
  };

  const color = colors[event] ?? colors.reset;
  return `${color}${event}${colors.reset}`;
}

const cmd: CommandModule = {
  command: "log",
  aliases: ["logs"],
  describe: "Show worktree activity log",
  builder: (yargs) =>
    yargs
      .option("limit", {
        type: "number",
        default: 20,
        describe: "Show the last N entries",
      })
      .option("json", {
        type: "boolean",
        alias: "j",
        describe: "Output as JSON",
      })
      .option("clear", {
        type: "boolean",
        describe: "Clear the activity log",
      }),
  handler: async (argv) => {
    try {
      const mainRepoPath = await resolveMainRepo();

      if (argv.clear) {
        const confirmed = await confirm("Clear activity log? [y/N] ");
        if (!confirmed) {
          console.log("Cancelled.");
          process.exit(0);
        }

        clearActivityLog(mainRepoPath);
        console.log("Activity log cleared.");
        process.exit(0);
      }

      const limit = typeof argv.limit === "number" ? argv.limit : 20;
      const entries = readActivityLog(mainRepoPath, { limit });

      if (argv.json) {
        console.log(JSON.stringify(entries, null, 2));
        process.exit(0);
      }

      for (const entry of entries) {
        const event = colorEvent(entry.event);
        const branch = entry.branch ?? "(unknown)";
        const details = entry.details
          ? Object.entries(entry.details).map(([k, v]) => `${k}=${v}`).join(" ")
          : "";
        console.log(`[${entry.timestamp}] ${event} ${branch}${details ? ` (${details})` : ""}`);
      }

      process.exit(0);
    } catch (err) {
      handleCliError(err);
    }
  },
};

export default cmd;
