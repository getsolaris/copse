import { afterEach, describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
import { cleanupTempDirs, createTempDir, createTempRepo, runGit } from "./test-helpers";
import {
  toSessionName,
  fromSessionName,
  writeSessionMeta,
  readSessionMeta,
  removeSessionMeta,
} from "./session";

async function runBunEval(script: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = (Bun as any).spawn(["bun", "-e", script], {
    cwd: process.cwd(),
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

  return { stdout, stderr, exitCode };
}

afterEach(cleanupTempDirs);

describe("toSessionName", () => {
  it("converts branch with slashes to safe session name", () => {
    expect(toSessionName("feat/auth-token")).toBe("copse_feat-auth-token");
  });

  it("converts branch with multiple slashes", () => {
    expect(toSessionName("fix/ui/sidebar")).toBe("copse_fix-ui-sidebar");
  });

  it("handles simple branch name", () => {
    expect(toSessionName("main")).toBe("copse_main");
  });

  it("replaces special characters with underscore", () => {
    expect(toSessionName("feat/auth@v2#test")).toBe("copse_feat-auth_v2_test");
  });

  it("uses custom prefix", () => {
    expect(toSessionName("main", "wt")).toBe("wt_main");
  });

  it("sanitizes special characters in prefix", () => {
    expect(toSessionName("main", "es:dev")).toBe("es_dev_main");
  });
});

describe("fromSessionName", () => {
  it("extracts branch from session name", () => {
    expect(fromSessionName("copse_feat-auth-token")).toBe("feat-auth-token");
  });

  it("supports legacy colon session names", () => {
    expect(fromSessionName("copse:feat-auth-token")).toBe("feat-auth-token");
  });

  it("returns null for non-copse session", () => {
    expect(fromSessionName("other:session")).toBeNull();
  });

  it("returns null for plain name", () => {
    expect(fromSessionName("my-session")).toBeNull();
  });

  it("uses custom prefix", () => {
    expect(fromSessionName("wt_main", "wt")).toBe("main");
  });
});

describe("session metadata", () => {
  it("writes and reads metadata for main worktree", async () => {
    const repoPath = await createTempRepo();
    const info = {
      name: "copse_test-branch",
      branch: "test-branch",
      worktreePath: repoPath,
      createdAt: "2025-01-01T00:00:00.000Z",
    };

    writeSessionMeta(repoPath, info);
    const result = readSessionMeta(repoPath);
    expect(result).toEqual(info);
  });

  it("writes and reads metadata for linked worktree", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("copse-session-wt-");
    await runGit(["worktree", "add", wtPath, "-b", "test-session"], repoPath);

    const info = {
      name: "copse_test-session",
      branch: "test-session",
      worktreePath: wtPath,
      createdAt: "2025-01-01T00:00:00.000Z",
      layout: "api",
    };

    writeSessionMeta(wtPath, info);
    const result = readSessionMeta(wtPath);
    expect(result).toEqual(info);

    expect(existsSync(join(wtPath, ".copse-session"))).toBeFalse();
  });

  it("returns null when no metadata exists", async () => {
    const repoPath = await createTempRepo();
    expect(readSessionMeta(repoPath)).toBeNull();
  });

  it("removes metadata", async () => {
    const repoPath = await createTempRepo();
    writeSessionMeta(repoPath, {
      name: "copse_test",
      branch: "test",
      worktreePath: repoPath,
      createdAt: "2025-01-01T00:00:00.000Z",
    });

    expect(readSessionMeta(repoPath)).not.toBeNull();
    removeSessionMeta(repoPath);
    expect(readSessionMeta(repoPath)).toBeNull();
  });

  it("removeSessionMeta is idempotent", async () => {
    const repoPath = await createTempRepo();
    removeSessionMeta(repoPath);
    removeSessionMeta(repoPath);
  });
});

describe("session command metadata lookup", () => {
  it("indexes worktrees once for session --list --json", async () => {
    const script = String.raw`
      import { mock } from "bun:test";

      let branchReads = 0;
      let metaReads = 0;
      const worktrees = ["a", "b", "c"].map((branch) => ({
        path: "/tmp/" + branch,
        get branch() {
          branchReads++;
          return branch;
        },
      }));

      mock.module("./src/core/session.ts", () => ({
        isTmuxAvailable: async () => true,
        openSession: async () => "",
        closeSession: async () => false,
        killSession: async () => {},
        listSessions: async () => [
          { name: "copse_a", windows: 1, attached: false, created: "1" },
          { name: "copse_b", windows: 1, attached: false, created: "1" },
          { name: "copse_c", windows: 1, attached: false, created: "1" },
        ],
        readSessionMeta: (worktreePath) => {
          metaReads++;
          const branch = worktreePath.slice(-1);
          return {
            name: "copse_" + branch,
            branch,
            worktreePath,
            createdAt: "2026-01-01T00:00:00.000Z",
            layout: "qa",
          };
        },
        removeSessionMeta: () => {},
        toSessionName: (branch, prefix) => (prefix ?? "copse") + "_" + branch,
      }));
      mock.module("./src/core/git.ts", () => ({
        GitWorktree: { list: async () => worktrees },
      }));
      mock.module("./src/core/config.ts", () => ({
        loadConfig: () => ({ version: 1 }),
        getSessionConfig: () => ({ prefix: "copse" }),
        resolveSessionLayout: () => undefined,
      }));
      mock.module("./src/cli/utils.ts", () => ({
        resolveMainRepo: async () => "/repo",
        findWorktreeOrExit: () => worktrees[0],
        handleCliError: (err) => { throw err; },
      }));

      const { default: command } = await import("./src/cli/cmd/session.ts");
      const originalExit = process.exit;
      process.exit = (code = 0) => {
        throw Object.assign(new Error("exit"), { code });
      };

      try {
        await command.handler({ list: true, json: true, _: [], $0: "copse" });
      } catch (err) {
        if (err?.code !== 0) throw err;
      } finally {
        process.exit = originalExit;
      }

      console.error(JSON.stringify({ branchReads, metaReads }));
      if (branchReads !== 3 || metaReads !== 3) {
        process.exit(1);
      }
    `;

    const result = await runBunEval(script);
    expect(result.exitCode, result.stderr).toBe(0);
  });
});
