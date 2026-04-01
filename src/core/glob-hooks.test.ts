import { afterEach, describe, expect, it } from "bun:test";
import { cleanupTempDirs, createTempRepo } from "./test-helpers";
import { expandHookCommand, executeGlobHooks, matchHooksForFocus } from "./glob-hooks";
import type { MonorepoHookConfig } from "./glob-hooks";

afterEach(cleanupTempDirs);

describe("matchHooksForFocus", () => {
  it("matches single-level glob to focus paths", () => {
    const hooks: MonorepoHookConfig[] = [
      { glob: "apps/domain/*", postCreate: ["pnpm install"] },
    ];
    const matches = matchHooksForFocus(hooks, ["apps/domain/coupon"]);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedPaths).toContain("apps/domain/coupon");
    expect(matches[0].postCreate).toEqual(["pnpm install"]);
  });

  it("matches multiple hooks with different globs", () => {
    const hooks: MonorepoHookConfig[] = [
      { glob: "apps/domain/*", postCreate: ["echo domain"] },
      { glob: "apps/core/*", postCreate: ["echo core"] },
    ];
    const matches = matchHooksForFocus(hooks, ["apps/domain/coupon", "apps/core/auth"]);
    expect(matches).toHaveLength(2);
    expect(matches[0].glob).toBe("apps/domain/*");
    expect(matches[1].glob).toBe("apps/core/*");
  });

  it("returns empty when no glob matches focus paths", () => {
    const hooks: MonorepoHookConfig[] = [{ glob: "packages/*", postCreate: ["npm test"] }];
    const matches = matchHooksForFocus(hooks, ["apps/web"]);
    expect(matches).toHaveLength(0);
  });

  it("preserves declaration order", () => {
    const hooks: MonorepoHookConfig[] = [
      { glob: "apps/*", postCreate: ["echo first"] },
      { glob: "apps/*", postCreate: ["echo second"] },
      { glob: "apps/*", postCreate: ["echo third"] },
    ];
    const matches = matchHooksForFocus(hooks, ["apps/web"]);
    expect(matches).toHaveLength(3);
    expect(matches[0].postCreate[0]).toBe("echo first");
    expect(matches[1].postCreate[0]).toBe("echo second");
    expect(matches[2].postCreate[0]).toBe("echo third");
  });

  it("matches two-level glob", () => {
    const hooks: MonorepoHookConfig[] = [{ glob: "apps/*/*", postCreate: ["echo msa"] }];
    // apps/core/auth should match apps/*/*
    const matches = matchHooksForFocus(hooks, ["apps/core/auth"]);
    expect(matches).toHaveLength(1);
  });

  it("does not match paths that are too shallow for glob", () => {
    const hooks: MonorepoHookConfig[] = [{ glob: "apps/*/*", postCreate: ["echo deep"] }];
    // apps/core should NOT match apps/*/*
    const matches = matchHooksForFocus(hooks, ["apps/core"]);
    expect(matches).toHaveLength(0);
  });
});

describe("expandHookCommand", () => {
  it("expands {packagePath}", () => {
    const result = expandHookCommand("cd {packagePath} && pnpm install", {
      packagePath: "apps/web",
      repo: "my-repo",
      branch: "main",
    });
    expect(result).toBe("cd apps/web && pnpm install");
  });

  it("expands {repo} and {branch}", () => {
    const result = expandHookCommand("echo {repo}-{branch}", {
      packagePath: "apps/web",
      repo: "my-repo",
      branch: "feature/auth",
    });
    expect(result).toBe("echo my-repo-feature/auth");
  });

  it("leaves unknown variables untouched", () => {
    const result = expandHookCommand("echo {unknown}", {
      packagePath: "apps/web",
      repo: "repo",
      branch: "main",
    });
    expect(result).toBe("echo {unknown}");
  });
});

describe("executeGlobHooks", () => {
  it("executes postCreate hooks for matched paths", async () => {
    const repoPath = await createTempRepo();
    const output: string[] = [];

    const matches = [
      {
        glob: "apps/*",
        matchedPaths: ["apps/web"],
        copyFiles: [],
        linkFiles: [],
        postCreate: ["echo HOOK_EXECUTED"],
        postRemove: [],
      },
    ];

    await executeGlobHooks(matches, "postCreate", {
      cwd: repoPath,
      repo: "my-repo",
      branch: "main",
      focusPaths: ["apps/web"],
      mainRepoPath: repoPath,
      onOutput: (line) => output.push(line),
    });

    expect(output.some(line => line.includes("HOOK_EXECUTED"))).toBeTrue();
  });

  it("sets OMW_PACKAGE_PATH env var in hooks", async () => {
    const repoPath = await createTempRepo();
    const output: string[] = [];

    const matches = [
      {
        glob: "apps/*",
        matchedPaths: ["apps/web"],
        copyFiles: [],
        linkFiles: [],
        postCreate: ["echo $OMW_PACKAGE_PATH"],
        postRemove: [],
      },
    ];

    await executeGlobHooks(matches, "postCreate", {
      cwd: repoPath,
      repo: "my-repo",
      branch: "main",
      focusPaths: ["apps/web"],
      mainRepoPath: repoPath,
      onOutput: (line) => output.push(line),
    });

    expect(output.some(line => line.includes("apps/web"))).toBeTrue();
  });

  it("skips phase when no commands for that phase", async () => {
    const repoPath = await createTempRepo();
    const output: string[] = [];

    const matches = [
      {
        glob: "apps/*",
        matchedPaths: ["apps/web"],
        copyFiles: [],
        linkFiles: [],
        postCreate: ["echo CREATE"],
        postRemove: [],
      },
    ];

    await executeGlobHooks(matches, "postRemove", {
      cwd: repoPath,
      repo: "my-repo",
      branch: "main",
      focusPaths: ["apps/web"],
      mainRepoPath: repoPath,
      onOutput: (line) => output.push(line),
    });

    expect(output).toHaveLength(0);  // No output since postRemove is empty
  });
});
