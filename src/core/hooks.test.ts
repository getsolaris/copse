import { afterEach, describe, expect, it } from "bun:test";
import { executeHooks, HookError, HookTimeoutError } from "./hooks";
import { cleanupTempDirs, createTempDir } from "./test-helpers";

const cwd = createTempDir("copse-hooks-");

afterEach(cleanupTempDirs);

describe("executeHooks", () => {
  it("captures output from a successful command", async () => {
    const lines: string[] = [];
    await executeHooks(["echo hello"], {
      cwd,
      onOutput: (line) => lines.push(line),
    });
    expect(lines).toContain("hello");
  });

  it("runs multiple commands sequentially in order", async () => {
    const lines: string[] = [];
    await executeHooks(["echo first", "echo second"], {
      cwd,
      onOutput: (line) => lines.push(line),
    });
    const firstIdx = lines.indexOf("first");
    const secondIdx = lines.indexOf("second");
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it("throws HookError on non-zero exit code", async () => {
    try {
      await executeHooks(["exit 1"], { cwd });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(HookError);
      expect((e as HookError).exitCode).toBe(1);
      expect((e as HookError).command).toBe("exit 1");
    }
  });

  it("throws HookTimeoutError when command exceeds timeout", async () => {
    const start = Date.now();
    try {
      await executeHooks(["sleep 60"], { cwd, timeout: 500 });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(HookTimeoutError);
      expect((e as HookTimeoutError).timeoutMs).toBe(500);
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });

  it("passes environment variables to the command", async () => {
    const lines: string[] = [];
    await executeHooks(["echo $COPSE_BRANCH"], {
      cwd,
      env: { COPSE_BRANCH: "main" },
      onOutput: (line) => lines.push(line),
    });
    expect(lines.some((l) => l.includes("main"))).toBe(true);
  });

  it("completes without error for empty commands array", async () => {
    await executeHooks([], { cwd });
  });
});
