import { existsSync, mkdirSync } from "node:fs";

export class HookError extends Error {
  constructor(
    public command: string,
    public exitCode: number,
    public stderr: string,
  ) {
    super(`Hook command failed (exit ${exitCode}): ${command}\n${stderr}`);
    this.name = "HookError";
  }
}

export class HookTimeoutError extends Error {
  constructor(
    public command: string,
    public timeoutMs: number,
  ) {
    super(`Hook command timed out after ${timeoutMs}ms: ${command}`);
    this.name = "HookTimeoutError";
  }
}

export interface HookOptions {
  cwd: string;
  timeout?: number;
  env?: Record<string, string>;
  onOutput?: (line: string) => void;
}

export async function executeHooks(
  commands: string[],
  opts: HookOptions,
): Promise<void> {
  const timeout = opts.timeout ?? 30_000;
  for (const command of commands) {
    await runSingleHook(
      command,
      opts.cwd,
      timeout,
      opts.env ?? {},
      opts.onOutput,
    );
  }
}

async function runSingleHook(
  command: string,
  cwd: string,
  timeoutMs: number,
  extraEnv: Record<string, string>,
  onOutput?: (line: string) => void,
): Promise<void> {
  if (!existsSync(cwd)) {
    mkdirSync(cwd, { recursive: true });
  }

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(["sh", "-c", command], {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (error) {
    const spawnError = error as NodeJS.ErrnoException;
    if (spawnError.code !== "ENOENT") {
      throw error;
    }

    proc = Bun.spawn(["/bin/sh", "-c", command], {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdout: "pipe",
      stderr: "pipe",
    });
  }

  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);

  const stderrPromise = proc.stderr
    ? new Response(proc.stderr).text()
    : Promise.resolve("");

  try {
    if (onOutput && proc.stdout) {
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line) onOutput(line);
        }
      }

      buffer += decoder.decode();
      if (buffer) onOutput(buffer);
    }

    const exitCode = await proc.exited;

    if (timedOut) {
      throw new HookTimeoutError(command, timeoutMs);
    }

    if (exitCode !== 0) {
      const stderr = (await stderrPromise).trim();
      throw new HookError(command, exitCode, stderr);
    }
  } finally {
    clearTimeout(timeoutHandle);
  }
}
