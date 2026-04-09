import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import type { OmwConfig } from "./config.ts";
import { cleanupTempDirs, createTempDir, runGit } from "./test-helpers.ts";
import { discoverRepos, expandWorkspaces } from "./workspace.ts";

async function initRepo(dir: string): Promise<void> {
  writeFileSync(join(dir, "README.md"), "# repo\n");
  await runGit(["init", "-b", "main"], dir);
  await runGit(["add", "."], dir);
  await runGit(["commit", "-m", "init"], dir);
}

function createSubDir(parent: string, name: string): string {
  const path = join(parent, name);
  mkdirSync(path, { recursive: true });
  return path;
}

afterEach(cleanupTempDirs);

describe("discoverRepos", () => {
  it("returns empty array when workspace path does not exist", () => {
    const result = discoverRepos("/tmp/omw-nonexistent-workspace-xyz");
    expect(result).toEqual([]);
  });

  it("returns empty array when workspace path is a file, not a directory", () => {
    const dir = createTempDir("omw-ws-file-");
    const filePath = join(dir, "not-a-dir.txt");
    writeFileSync(filePath, "content");

    const result = discoverRepos(filePath);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty directory", () => {
    const dir = createTempDir("omw-ws-empty-");
    const result = discoverRepos(dir);
    expect(result).toEqual([]);
  });

  it("discovers a single git repo at depth 1", async () => {
    const parent = createTempDir("omw-ws-single-");
    const repoA = createSubDir(parent, "repo-a");
    await initRepo(repoA);

    const result = discoverRepos(parent);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(resolve(repoA));
  });

  it("discovers multiple git repos at depth 1", async () => {
    const parent = createTempDir("omw-ws-multi-");
    const repoA = createSubDir(parent, "alpha");
    const repoB = createSubDir(parent, "beta");
    const repoC = createSubDir(parent, "gamma");
    await initRepo(repoA);
    await initRepo(repoB);
    await initRepo(repoC);

    const result = discoverRepos(parent);
    expect(result).toHaveLength(3);
    expect(result).toContain(resolve(repoA));
    expect(result).toContain(resolve(repoB));
    expect(result).toContain(resolve(repoC));
  });

  it("returns sorted results", async () => {
    const parent = createTempDir("omw-ws-sort-");
    const repoZ = createSubDir(parent, "zebra");
    const repoA = createSubDir(parent, "alpha");
    await initRepo(repoZ);
    await initRepo(repoA);

    const result = discoverRepos(parent);
    expect(result[0]).toBe(resolve(repoA));
    expect(result[1]).toBe(resolve(repoZ));
  });

  it("skips non-git directories", async () => {
    const parent = createTempDir("omw-ws-nongit-");
    const repoA = createSubDir(parent, "real-repo");
    createSubDir(parent, "not-a-repo");
    createSubDir(parent, "also-not-a-repo");
    await initRepo(repoA);

    const result = discoverRepos(parent);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(resolve(repoA));
  });

  it("skips sub-worktrees where .git is a file, not a directory", async () => {
    const parent = createTempDir("omw-ws-subworktree-");
    const realRepo = createSubDir(parent, "main-repo");
    await initRepo(realRepo);

    const fakeWorktree = createSubDir(parent, "linked-worktree");
    writeFileSync(join(fakeWorktree, ".git"), "gitdir: /some/other/path\n");

    const result = discoverRepos(parent);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(resolve(realRepo));
    expect(result).not.toContain(resolve(fakeWorktree));
  });

  it("skips directories matching exclude patterns", async () => {
    const parent = createTempDir("omw-ws-exclude-");
    const keep = createSubDir(parent, "keep-me");
    const skip = createSubDir(parent, "node_modules");
    await initRepo(keep);
    await initRepo(skip);

    const result = discoverRepos(parent, 1, ["node_modules"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(resolve(keep));
  });

  it("exclude supports glob patterns", async () => {
    const parent = createTempDir("omw-ws-exclude-glob-");
    const keep = createSubDir(parent, "keep");
    const skip1 = createSubDir(parent, "temp-one");
    const skip2 = createSubDir(parent, "temp-two");
    await initRepo(keep);
    await initRepo(skip1);
    await initRepo(skip2);

    const result = discoverRepos(parent, 1, ["temp-*"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(resolve(keep));
  });

  it("depth 1 does not descend into non-repo subdirectories", async () => {
    const parent = createTempDir("omw-ws-depth1-");
    const nested = createSubDir(join(parent, "nested-dir"), "deep-repo");
    await initRepo(nested);

    const result = discoverRepos(parent, 1);
    expect(result).toEqual([]);
  });

  it("depth 2 descends one level through non-repo directories", async () => {
    const parent = createTempDir("omw-ws-depth2-");
    const group = createSubDir(parent, "group-a");
    const nested = createSubDir(group, "nested-repo");
    await initRepo(nested);

    const result = discoverRepos(parent, 2);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(resolve(nested));
  });

  it("depth 3 can discover repos three levels deep", async () => {
    const parent = createTempDir("omw-ws-depth3-");
    const nested = createSubDir(join(parent, "group", "subgroup"), "target-repo");
    await initRepo(nested);

    const result = discoverRepos(parent, 3);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(resolve(nested));
  });

  it("depth requests beyond the max are clamped and cannot reach deeper repos", async () => {
    const parent = createTempDir("omw-ws-depth-clamp-");
    const tooDeep = createSubDir(join(parent, "a", "b", "c"), "too-deep");
    await initRepo(tooDeep);

    const result = discoverRepos(parent, 99);
    expect(result).toEqual([]);
  });

  it("does not recurse into discovered repos even at higher depths", async () => {
    const parent = createTempDir("omw-ws-no-recurse-");
    const outer = createSubDir(parent, "outer-repo");
    await initRepo(outer);

    const innerFake = createSubDir(outer, "inner-dir");
    mkdirSync(join(innerFake, ".git"), { recursive: true });

    const result = discoverRepos(parent, 3);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(resolve(outer));
    expect(result).not.toContain(resolve(innerFake));
  });

  it("expands leading tilde using HOME env var", async () => {
    const parent = createTempDir("omw-ws-home-");
    const repoA = createSubDir(parent, "home-repo");
    await initRepo(repoA);

    const originalHome = Bun.env.HOME;
    Bun.env.HOME = parent;
    try {
      const result = discoverRepos("~");
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(resolve(repoA));
    } finally {
      if (originalHome === undefined) {
        delete Bun.env.HOME;
      } else {
        Bun.env.HOME = originalHome;
      }
    }
  });
});

describe("expandWorkspaces", () => {
  it("returns input config unchanged when workspaces is undefined", () => {
    const config: OmwConfig = { version: 1, repos: [{ path: "/tmp/a" }] };
    const result = expandWorkspaces(config);
    expect(result).toBe(config);
  });

  it("returns input config unchanged when workspaces is empty", () => {
    const config: OmwConfig = { version: 1, workspaces: [], repos: [{ path: "/tmp/a" }] };
    const result = expandWorkspaces(config);
    expect(result).toBe(config);
  });

  it("adds discovered repos to an empty repos array", async () => {
    const parent = createTempDir("omw-expand-empty-");
    const repoA = createSubDir(parent, "a");
    const repoB = createSubDir(parent, "b");
    await initRepo(repoA);
    await initRepo(repoB);

    const config: OmwConfig = {
      version: 1,
      workspaces: [{ path: parent }],
    };

    const result = expandWorkspaces(config);
    expect(result.repos).toHaveLength(2);
    const paths = result.repos!.map((r) => r.path).sort();
    expect(paths).toEqual([resolve(repoA), resolve(repoB)]);
  });

  it("merges discovered repos alongside explicit repos", async () => {
    const parent = createTempDir("omw-expand-merge-");
    const discovered = createSubDir(parent, "discovered");
    await initRepo(discovered);

    const config: OmwConfig = {
      version: 1,
      workspaces: [{ path: parent }],
      repos: [{ path: "/tmp/explicit-repo", copyFiles: [".env"] }],
    };

    const result = expandWorkspaces(config);
    expect(result.repos).toHaveLength(2);
    expect(result.repos![0]).toEqual({ path: "/tmp/explicit-repo", copyFiles: [".env"] });
    expect(result.repos![1].path).toBe(resolve(discovered));
  });

  it("explicit repos take precedence over discovered repos with same path", async () => {
    const parent = createTempDir("omw-expand-precedence-");
    const shared = createSubDir(parent, "shared");
    await initRepo(shared);

    const config: OmwConfig = {
      version: 1,
      workspaces: [{ path: parent, defaults: { copyFiles: ["from-workspace"] } }],
      repos: [{ path: shared, copyFiles: ["from-explicit"] }],
    };

    const result = expandWorkspaces(config);
    expect(result.repos).toHaveLength(1);
    expect(result.repos![0].copyFiles).toEqual(["from-explicit"]);
  });

  it("applies workspace defaults to discovered repos", async () => {
    const parent = createTempDir("omw-expand-defaults-");
    const repoA = createSubDir(parent, "app");
    await initRepo(repoA);

    const config: OmwConfig = {
      version: 1,
      workspaces: [
        {
          path: parent,
          defaults: {
            copyFiles: [".env", ".env.local"],
            postCreate: ["bun install"],
            autoUpstream: false,
          },
        },
      ],
    };

    const result = expandWorkspaces(config);
    expect(result.repos).toHaveLength(1);
    const entry = result.repos![0];
    expect(entry.path).toBe(resolve(repoA));
    expect(entry.copyFiles).toEqual([".env", ".env.local"]);
    expect(entry.postCreate).toEqual(["bun install"]);
    expect(entry.autoUpstream).toBeFalse();
  });

  it("first workspace wins when multiple workspaces discover the same repo", async () => {
    const parent = createTempDir("omw-expand-dedup-");
    const repoA = createSubDir(parent, "app");
    await initRepo(repoA);

    const config: OmwConfig = {
      version: 1,
      workspaces: [
        { path: parent, defaults: { copyFiles: ["first"] } },
        { path: parent, defaults: { copyFiles: ["second"] } },
      ],
    };

    const result = expandWorkspaces(config);
    expect(result.repos).toHaveLength(1);
    expect(result.repos![0].copyFiles).toEqual(["first"]);
  });

  it("does not mutate the input config", async () => {
    const parent = createTempDir("omw-expand-immutable-");
    const repoA = createSubDir(parent, "app");
    await initRepo(repoA);

    const config: OmwConfig = {
      version: 1,
      workspaces: [{ path: parent }],
      repos: [{ path: "/tmp/explicit" }],
    };
    const originalRepos = config.repos;
    const originalLength = config.repos!.length;

    const result = expandWorkspaces(config);

    expect(config.repos).toBe(originalRepos);
    expect(config.repos).toHaveLength(originalLength);
    expect(result.repos).not.toBe(originalRepos);
  });

  it("returns input unchanged when workspace discovers nothing", () => {
    const parent = createTempDir("omw-expand-empty-ws-");
    const config: OmwConfig = {
      version: 1,
      workspaces: [{ path: parent }],
      repos: [{ path: "/tmp/a" }],
    };

    const result = expandWorkspaces(config);
    expect(result).toBe(config);
  });

  it("respects depth and exclude options per workspace", async () => {
    const parent = createTempDir("omw-expand-options-");
    const immediate = createSubDir(parent, "immediate-repo");
    const deep = createSubDir(join(parent, "nested"), "deep-repo");
    const excluded = createSubDir(parent, "temp-cache");
    await initRepo(immediate);
    await initRepo(deep);
    await initRepo(excluded);

    const config: OmwConfig = {
      version: 1,
      workspaces: [
        {
          path: parent,
          depth: 2,
          exclude: ["temp-*"],
        },
      ],
    };

    const result = expandWorkspaces(config);
    const paths = result.repos!.map((r) => r.path).sort();
    expect(paths).toEqual([resolve(immediate), resolve(deep)].sort());
  });
});
