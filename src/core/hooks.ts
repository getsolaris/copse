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
      const bufferChunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const parts = chunk.split("\n");

        if (parts.length === 1) {
          bufferChunks.push(parts[0]);
        } else {
          bufferChunks.push(parts[0]);
          const completeLine = bufferChunks.join("");
          bufferChunks.length = 0;
          if (completeLine) onOutput(completeLine);

          for (let i = 1; i < parts.length - 1; i++) {
            if (parts[i]) onOutput(parts[i]);
          }

          const last = parts[parts.length - 1];
          if (last) bufferChunks.push(last);
        }
      }

      const remaining = bufferChunks.join("") + decoder.decode();
      if (remaining) onOutput(remaining);
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
