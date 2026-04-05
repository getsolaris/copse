import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export class SessionError extends Error {
  constructor(
    message: string,
    public reason: string,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

export interface SessionWindowConfig {
  name: string;
  command?: string;
}

export interface SessionLayoutConfig {
  windows: SessionWindowConfig[];
}

export interface SessionInfo {
  name: string;
  branch: string;
  worktreePath: string;
  createdAt: string;
  layout?: string;
}

export interface TmuxSessionStatus {
  name: string;
  windows: number;
  attached: boolean;
  created: string;
}

const SESSION_PREFIX = "omw";

function sanitizeSessionPart(value: string): string {
  return value.replace(/\//g, "-").replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function runTmux(args: string[]): Promise<string> {
  const proc = (Bun as any).spawn(["tmux", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...(Bun as any).env,
      LC_ALL: "C",
    },
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new SessionError(
      `tmux ${args[0]} failed: ${stderr.trim()}`,
      stderr.trim(),
    );
  }

  return stdout.trim();
}

export function toSessionName(branch: string, prefix?: string): string {
  const p = sanitizeSessionPart(prefix ?? SESSION_PREFIX);
  const safe = sanitizeSessionPart(branch);
  return `${p}_${safe}`;
}

export function fromSessionName(sessionName: string, prefix?: string): string | null {
  const p = sanitizeSessionPart(prefix ?? SESSION_PREFIX);
  const prefixes = [`${p}_`, `${p}:`];

  for (const pattern of prefixes) {
    if (sessionName.startsWith(pattern)) {
      return sessionName.slice(pattern.length);
    }
  }

  return null;
}

function getSessionMetaPath(worktreePath: string): string {
  const gitPath = join(worktreePath, ".git");
  const stat = statSync(gitPath, { throwIfNoEntry: false });

  if (!stat) {
    return join(gitPath, "omw-session");
  }

  if (stat.isDirectory()) {
    return join(gitPath, "omw-session");
  }

  const content = readFileSync(gitPath, "utf-8").trim();
  const actualGitDir = content.replace(/^gitdir:\s*/, "").trim();
  const resolvedGitDir = resolve(worktreePath, actualGitDir);

  return join(resolvedGitDir, "omw-session");
}

export function writeSessionMeta(worktreePath: string, info: SessionInfo): void {
  const metaPath = getSessionMetaPath(worktreePath);
  mkdirSync(dirname(metaPath), { recursive: true });
  writeFileSync(metaPath, JSON.stringify(info), { encoding: "utf-8", mode: 0o600 });
}

export function readSessionMeta(worktreePath: string): SessionInfo | null {
  const metaPath = getSessionMetaPath(worktreePath);
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, "utf-8")) as SessionInfo;
  } catch {
    return null;
  }
}

export function removeSessionMeta(worktreePath: string): void {
  const metaPath = getSessionMetaPath(worktreePath);
  if (existsSync(metaPath)) {
    unlinkSync(metaPath);
  }
}

export async function isTmuxAvailable(): Promise<boolean> {
  try {
    const proc = (Bun as any).spawn(["tmux", "-V"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

export function isInsideTmux(): boolean {
  return Boolean((Bun as any).env.TMUX);
}

export async function sessionExists(sessionName: string): Promise<boolean> {
  try {
    await runTmux(["has-session", "-t", sessionName]);
    return true;
  } catch {
    return false;
  }
}

export async function createSession(
  sessionName: string,
  worktreePath: string,
  layout?: SessionLayoutConfig,
): Promise<void> {
  if (await sessionExists(sessionName)) {
    throw new SessionError(
      `Session '${sessionName}' already exists`,
      "session_exists",
    );
  }

  if (!existsSync(worktreePath)) {
    throw new SessionError(
      `Worktree path does not exist: ${worktreePath}`,
      "path_not_found",
    );
  }

  const windows = layout?.windows ?? [];
  const firstWindow = windows[0];

  const createArgs = ["new-session", "-d", "-s", sessionName, "-c", worktreePath];
  if (firstWindow) {
    createArgs.push("-n", firstWindow.name);
  }
  await runTmux(createArgs);

  if (firstWindow?.command) {
    await runTmux(["send-keys", "-t", `${sessionName}:${firstWindow.name}`, firstWindow.command, "Enter"]);
  }

  for (let i = 1; i < windows.length; i++) {
    const win = windows[i];
    await runTmux(["new-window", "-t", sessionName, "-n", win.name, "-c", worktreePath]);
    if (win.command) {
      await runTmux(["send-keys", "-t", `${sessionName}:${win.name}`, win.command, "Enter"]);
    }
  }

  if (windows.length > 0) {
    await runTmux(["select-window", "-t", `${sessionName}:${windows[0].name}`]);
  }
}

export async function killSession(sessionName: string): Promise<void> {
  if (!(await sessionExists(sessionName))) {
    return;
  }
  await runTmux(["kill-session", "-t", sessionName]);
}

export async function attachSession(sessionName: string): Promise<void> {
  if (!(await sessionExists(sessionName))) {
    throw new SessionError(
      `Session '${sessionName}' does not exist`,
      "session_not_found",
    );
  }

  if (isInsideTmux()) {
    await runTmux(["switch-client", "-t", sessionName]);
  } else {
    // attach-session hands control to tmux — stdin/stdout must be inherited
    const proc = (Bun as any).spawn(["tmux", "attach-session", "-t", sessionName], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new SessionError(`Failed to attach to session '${sessionName}'`, "attach_failed");
    }
  }
}

export async function listSessions(prefix?: string): Promise<TmuxSessionStatus[]> {
  const p = sanitizeSessionPart(prefix ?? SESSION_PREFIX);

  try {
    const output = await runTmux([
      "list-sessions",
      "-F",
      "#{session_name}\x1f#{session_windows}\x1f#{session_attached}\x1f#{session_created}",
    ]);

    if (!output) return [];

    return output
      .split("\n")
      .filter(Boolean)
       .filter((line) => line.startsWith(`${p}_`) || line.startsWith(`${p}:`))
      .map((line) => {
        const [name, windows, attached, created] = line.split("\x1f");
        return {
          name: name ?? "",
          windows: parseInt(windows ?? "0", 10),
          attached: attached === "1",
          created: created ?? "",
        };
      });
  } catch {
    return [];
  }
}

export async function openSession(
  branch: string,
  worktreePath: string,
  opts?: {
    layout?: SessionLayoutConfig;
    prefix?: string;
    attach?: boolean;
    layoutName?: string;
  },
): Promise<string> {
  const sessionName = toSessionName(branch, opts?.prefix);
  const shouldAttach = opts?.attach ?? true;

  if (await sessionExists(sessionName)) {
    if (shouldAttach) {
      await attachSession(sessionName);
    }
    return sessionName;
  }

  await createSession(sessionName, worktreePath, opts?.layout);

  writeSessionMeta(worktreePath, {
    name: sessionName,
    branch,
    worktreePath,
    createdAt: new Date().toISOString(),
    layout: opts?.layoutName,
  });

  if (shouldAttach) {
    await attachSession(sessionName);
  }

  return sessionName;
}

export async function closeSession(
  branch: string,
  worktreePath: string,
  prefix?: string,
): Promise<boolean> {
  const sessionName = toSessionName(branch, prefix);
  const existed = await sessionExists(sessionName);

  if (existed) {
    await killSession(sessionName);
  }

  removeSessionMeta(worktreePath);
  return existed;
}
