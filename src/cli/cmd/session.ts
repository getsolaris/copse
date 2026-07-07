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
import type { SessionInfo } from "../../core/session.ts";
import type { Worktree } from "../../core/types.ts";
import { resolveMainRepo, findWorktreeOrExit, handleCliError } from "../utils.ts";

interface SessionWorktreeEntry {
  branch: string | null;
  path: string;
  meta: SessionInfo | null;
}

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
        describe: "List active copse tmux sessions",
      })
      .option("kill", {
        type: "boolean",
        alias: "k",
        describe: "Kill the session for the specified worktree",
      })
      .option("kill-all", {
        type: "boolean",
        describe: "Kill all copse tmux sessions",
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

function buildSessionWorktreeIndex(
  worktrees: readonly Worktree[],
  prefix: string | undefined,
): Map<string, SessionWorktreeEntry> {
  const index = new Map<string, SessionWorktreeEntry>();

  for (const worktree of worktrees) {
    const branch = worktree.branch;
    const sessionBranch = branch ?? basename(worktree.path);
    const meta = readSessionMeta(worktree.path);
    const entry = { branch, path: worktree.path, meta };

    index.set(toSessionName(sessionBranch, prefix), entry);
    if (meta?.name) {
      index.set(meta.name, entry);
    }
  }

  return index;
}

async function handleList(
  mainRepoPath: string,
  prefix: string | undefined,
  json: boolean,
): Promise<void> {
  const [sessions, worktrees] = await Promise.all([
    listSessions(prefix),
    GitWorktree.list(mainRepoPath),
  ]);

  if (sessions.length === 0) {
    if (json) {
      console.log(JSON.stringify([], null, 2));
      return;
    }

    console.log("No active copse sessions.");
    return;
  }

  const sessionIndex = buildSessionWorktreeIndex(worktrees, prefix);

  if (json) {
    const enriched = sessions.map((s) => {
      const entry = sessionIndex.get(s.name);
      return {
        ...s,
        branch: entry?.branch ?? null,
        worktreePath: entry?.path ?? null,
        layout: entry?.meta?.layout ?? null,
      };
    });
    console.log(JSON.stringify(enriched, null, 2));
    return;
  }

  console.log(`Active sessions (${sessions.length}):\n`);
  for (const s of sessions) {
    const entry = sessionIndex.get(s.name);
    const attachedTag = s.attached ? " (attached)" : "";
    const layoutTag = entry?.meta?.layout ? ` [${entry.meta.layout}]` : "";
    const branchInfo = entry?.branch ? `  ${entry.branch}` : "";
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
    console.log("No active copse sessions.");
    return;
  }

  const sessionIndex = buildSessionWorktreeIndex(worktrees, prefix);

  let killed = 0;
  for (const s of sessions) {
    const entry = sessionIndex.get(s.name);

    await killSession(s.name);
    if (entry) {
      removeSessionMeta(entry.path);
    }
    killed++;
    console.log(`  ✓ Killed ${s.name}`);
  }

  console.log(`\nKilled ${killed} session${killed !== 1 ? "s" : ""}.`);
}

export default cmd;
