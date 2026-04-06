import type { CommandModule } from "yargs";
import { basename } from "node:path";
import { GitWorktree } from "../../core/git.ts";
import { logActivity } from "../../core/activity-log.ts";
import { loadConfig, getSessionConfig } from "../../core/config.ts";
import { isInsideTmux, sessionExists, toSessionName, attachSession } from "../../core/session.ts";
import { resolveMainRepo, findWorktreeOrExit, handleCliError } from "../utils.ts";

const cmd: CommandModule = {
  command: "switch <branch-or-path>",
  aliases: ["sw"],
  describe: "Switch to a worktree directory (outputs cd command for shell eval)",
  builder: (yargs) =>
    yargs.positional("branch-or-path", { type: "string", demandOption: true }),
  handler: async (argv) => {
    const branchOrPath = argv["branch-or-path"] as string;

    try {
      const mainRepoPath = await resolveMainRepo();
      const worktrees = await GitWorktree.list(mainRepoPath);
      const target = findWorktreeOrExit(worktrees, branchOrPath);

      try { logActivity(mainRepoPath, { timestamp: new Date().toISOString(), event: "switch", branch: target.branch ?? branchOrPath, path: target.path }); } catch {}

      const config = loadConfig();
      const sessionConfig = getSessionConfig(config);
      if (sessionConfig.enabled && isInsideTmux()) {
        const branch = target.branch ?? basename(target.path);
        const sessionName = toSessionName(branch, sessionConfig.prefix);
        if (await sessionExists(sessionName)) {
          try {
            await attachSession(sessionName);
            process.exit(0);
          } catch {}
        }
      }

      console.log(`cd ${JSON.stringify(target.path)}`);
      process.exit(0);
    } catch (err) {
      handleCliError(err);
    }
  },
};

export default cmd;
