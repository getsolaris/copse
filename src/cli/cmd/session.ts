import type { CommandModule } from "yargs";
import { basename } from "node:path";
import { GitWorktree } from "../../core/git.ts";
import { loadConfig, getSessionConfig, resolveSessionLayout } from "../../core/config.ts";
import {
  isTmuxAvailable,
  openSession,
  closeSession,
  killSession,
  listSessions,
  readSessionMeta,
  removeSessionMeta,
  toSessionName,
} from "../../core/session.ts";
import { resolveMainRepo, findWorktreeOrExit, handleCliError } from "../utils.ts";

const cmd: CommandModule = {
  command: "session [branch-or-path]",
  aliases: ["ss"],
  describe: "Manage tmux sessions for worktrees",
  builder: (yargs) =>
    yargs
      .positional("branch-or-path", {
        type: "string",
        describe: "Branch name or worktree path to open session for",
      })
      .option("list", {
        type: "boolean",
        alias: "l",
        describe: "List active omw tmux sessions",
      })
      .option("kill", {
        type: "boolean",
        alias: "k",
        describe: "Kill the session for the specified worktree",
      })
      .option("kill-all", {
        type: "boolean",
        describe: "Kill all omw tmux sessions",
      })
      .option("layout", {
        type: "string",
        describe: "Use a named layout from config",
      })
      .option("json", {
        type: "boolean",
        alias: "j",
        describe: "Output in JSON format",
      }),
  handler: async (argv) => {
    const branchOrPath = argv["branch-or-path"] as string | undefined;
    const listFlag = !!argv.list;
    const killFlag = !!argv.kill;
    const killAllFlag = !!argv["kill-all"];
    const layoutName = argv.layout as string | undefined;
    const json = !!argv.json;

    if (!(await isTmuxAvailable())) {
      console.error("Error: tmux is not installed or not in PATH.");
      console.error("Install tmux to use session management.");
      process.exit(1);
    }

    try {
      const mainRepoPath = await resolveMainRepo();
      const config = loadConfig();
      const sessionConfig = getSessionConfig(config);

      if (listFlag) {
        await handleList(mainRepoPath, sessionConfig.prefix, json);
        process.exit(0);
      }

      if (killAllFlag) {
        await handleKillAll(mainRepoPath, sessionConfig.prefix);
        process.exit(0);
      }

      if (!branchOrPath) {
        console.error("Error: specify a branch or worktree path, or use --list.");
        process.exit(1);
      }

      const worktrees = await GitWorktree.list(mainRepoPath);
      const target = findWorktreeOrExit(worktrees, branchOrPath);

      const branch = target.branch ?? basename(target.path);

      if (killFlag) {
        const killed = await closeSession(branch, target.path, sessionConfig.prefix);
        if (killed) {
          console.log(`Killed session for '${branch}'`);
        } else {
          console.log(`No active session for '${branch}'`);
        }
        process.exit(0);
      }

      const layout = resolveSessionLayout(config, layoutName);
      const sessionName = await openSession(branch, target.path, {
        layout,
        prefix: sessionConfig.prefix,
        attach: true,
        layoutName: layoutName ?? sessionConfig.defaultLayout,
      });

      console.log(`Session: ${sessionName}`);
      process.exit(0);
    } catch (err) {
      handleCliError(err);
    }
  },
};

async function handleList(
  mainRepoPath: string,
  prefix: string | undefined,
  json: boolean,
): Promise<void> {
  const [sessions, worktrees] = await Promise.all([
    listSessions(prefix),
    GitWorktree.list(mainRepoPath),
  ]);

  if (json) {
    const enriched = sessions.map((s) => {
      const wt = worktrees.find((w) => {
        const branch = w.branch ?? basename(w.path);
        return toSessionName(branch, prefix) === s.name;
      });
      const meta = wt ? readSessionMeta(wt.path) : null;
      return {
        ...s,
        branch: wt?.branch ?? null,
        worktreePath: wt?.path ?? null,
        layout: meta?.layout ?? null,
      };
    });
    console.log(JSON.stringify(enriched, null, 2));
    return;
  }

  if (sessions.length === 0) {
    console.log("No active omw sessions.");
    return;
  }

  console.log(`Active sessions (${sessions.length}):\n`);
  for (const s of sessions) {
    const wt = worktrees.find((w) => {
      const branch = w.branch ?? basename(w.path);
      return toSessionName(branch, prefix) === s.name;
    });
    const meta = wt ? readSessionMeta(wt.path) : null;
    const attachedTag = s.attached ? " (attached)" : "";
    const layoutTag = meta?.layout ? ` [${meta.layout}]` : "";
    const branchInfo = wt?.branch ? `  ${wt.branch}` : "";
    console.log(`  ${s.name}${branchInfo}  ${s.windows} windows${layoutTag}${attachedTag}`);
  }
}

async function handleKillAll(
  mainRepoPath: string,
  prefix: string | undefined,
): Promise<void> {
  const [sessions, worktrees] = await Promise.all([
    listSessions(prefix),
    GitWorktree.list(mainRepoPath),
  ]);

  if (sessions.length === 0) {
    console.log("No active omw sessions.");
    return;
  }

  let killed = 0;
  for (const s of sessions) {
    const wt = worktrees.find((w) => {
      const meta = readSessionMeta(w.path);
      const branch = w.branch ?? basename(w.path);
      return meta?.name === s.name || toSessionName(branch, prefix) === s.name;
    });

    await killSession(s.name);
    if (wt) {
      removeSessionMeta(wt.path);
    }
    killed++;
    console.log(`  ✓ Killed ${s.name}`);
  }

  console.log(`\nKilled ${killed} session${killed !== 1 ? "s" : ""}.`);
}

export default cmd;
