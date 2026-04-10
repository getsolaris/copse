import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import {
  ensureConfigInitialized,
  expandTemplate,
  getRepoConfig,
  initConfig,
  loadConfig,
  loadRawConfig,
  setNestedValue,
  type OmlConfig,
  validateConfig,
} from "./config";
import { cleanupTempDirs, createTempDir, runGit } from "./test-helpers";

const originalXdgConfigHome = Bun.env.XDG_CONFIG_HOME;
const originalHome = Bun.env.HOME;

afterEach(() => {
  if (originalXdgConfigHome === undefined) {
    delete Bun.env.XDG_CONFIG_HOME;
  } else {
    Bun.env.XDG_CONFIG_HOME = originalXdgConfigHome;
  }

  if (originalHome === undefined) {
    delete Bun.env.HOME;
  } else {
    Bun.env.HOME = originalHome;
  }

  cleanupTempDirs();
});

describe("validateConfig", () => {
  it("valid config passes with no errors", () => {
    const valid: OmlConfig = {
      version: 1,
      defaults: {
        worktreeDir: "../{repo}-{branch}",
        copyFiles: [".env"],
        linkFiles: ["node_modules"],
        postCreate: ["bun install"],
        postRemove: ["echo removed"],
      },
      repos: [
        {
          path: "/tmp/repo-a",
          worktreeDir: "../wt/{repo}-{branch}",
        },
      ],
    };

    expect(validateConfig(valid)).toEqual([]);
  });

  it("missing version returns version error", () => {
    const result = validateConfig({ defaults: {} });

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((error) => error.field.includes("version"))).toBeTrue();
  });

  it("version as string instead of number returns error", () => {
    const result = validateConfig({ version: "1" });

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((error) => error.field === "version")).toBeTrue();
  });

  it("unknown top-level key returns error", () => {
    const result = validateConfig({ version: 1, unknown: true });

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((error) => error.field === "unknown")).toBeTrue();
  });
});

describe("validateConfig - autoUpstream", () => {
  it("defaults.autoUpstream true passes validation", () => {
    expect(validateConfig({ version: 1, defaults: { autoUpstream: true } })).toEqual([]);
  });

  it("defaults.autoUpstream false passes validation", () => {
    expect(validateConfig({ version: 1, defaults: { autoUpstream: false } })).toEqual([]);
  });

  it("defaults.autoUpstream string fails validation", () => {
    const result = validateConfig({ version: 1, defaults: { autoUpstream: "true" } });

    expect(result.some((error) => error.field === "defaults.autoUpstream" && error.message === "Must be a boolean")).toBeTrue();
  });

  it("defaults.autoUpstream number fails validation", () => {
    const result = validateConfig({ version: 1, defaults: { autoUpstream: 1 } });

    expect(result.some((error) => error.field === "defaults.autoUpstream" && error.message === "Must be a boolean")).toBeTrue();
  });

  it("unknown defaults field still detected with autoUpstream present", () => {
    const result = validateConfig({ version: 1, defaults: { autoUpstream: true, unknownField: true } });

    expect(result.some((error) => error.field === "defaults.unknownField")).toBeTrue();
  });
});

describe("getRepoConfig", () => {
  it("returns defaults when no repo match", () => {
    const config: OmlConfig = {
      version: 1,
      defaults: {
        worktreeDir: "../defaults/{repo}-{branch}",
        copyFiles: [".env.example"],
        linkFiles: ["node_modules"],
        postCreate: ["bun install"],
        postRemove: ["echo cleanup"],
      },
      repos: [{ path: "/tmp/another-repo", worktreeDir: "../custom" }],
    };

    const resolved = getRepoConfig(config, "/tmp/missing-repo");
    expect(resolved.worktreeDir).toBe("../defaults/{repo}-{branch}");
    expect(resolved.copyFiles).toEqual([".env.example"]);
    expect(resolved.linkFiles).toEqual(["node_modules"]);
    expect(resolved.postCreate).toEqual(["bun install"]);
    expect(resolved.postRemove).toEqual(["echo cleanup"]);
  });

  it("repo overrides take precedence over defaults", () => {
    const repoPath = "/tmp/repo-override";
    const config: OmlConfig = {
      version: 1,
      defaults: {
        worktreeDir: "../defaults/{repo}-{branch}",
        copyFiles: [".env.example"],
        linkFiles: ["node_modules"],
        postCreate: ["bun install"],
        postRemove: ["echo cleanup"],
      },
      repos: [
        {
          path: repoPath,
          worktreeDir: "../repo-specific/{repo}-{branch}",
          copyFiles: [".env.local"],
          linkFiles: ["vendor"],
          postCreate: ["pnpm install"],
          postRemove: ["echo repo remove"],
        },
      ],
    };

    const resolved = getRepoConfig(config, repoPath);
    expect(resolved.worktreeDir).toBe("../repo-specific/{repo}-{branch}");
    expect(resolved.copyFiles).toEqual([".env.local"]);
    expect(resolved.linkFiles).toEqual(["vendor"]);
    expect(resolved.postCreate).toEqual(["pnpm install"]);
    expect(resolved.postRemove).toEqual(["echo repo remove"]);
  });

  it("partial override merges with defaults", () => {
    const repoPath = "/tmp/repo-partial";
    const config: OmlConfig = {
      version: 1,
      defaults: {
        worktreeDir: "../defaults/{repo}-{branch}",
        copyFiles: [".env.example"],
        linkFiles: ["node_modules"],
        postCreate: ["bun install"],
        postRemove: ["echo cleanup"],
      },
      repos: [{ path: repoPath, postCreate: ["pnpm install"] }],
    };

    const resolved = getRepoConfig(config, repoPath);
    expect(resolved.worktreeDir).toBe("../defaults/{repo}-{branch}");
    expect(resolved.copyFiles).toEqual([".env.example"]);
    expect(resolved.linkFiles).toEqual(["node_modules"]);
    expect(resolved.postCreate).toEqual(["pnpm install"]);
    expect(resolved.postRemove).toEqual(["echo cleanup"]);
  });
});

describe("getRepoConfig - autoUpstream", () => {
  it("defaults to true when autoUpstream is missing", () => {
    const config: OmlConfig = { version: 1, repos: [{ path: "/tmp/repo" }] };

    expect(getRepoConfig(config, "/tmp/repo").autoUpstream).toBeTrue();
  });

  it("defaults.autoUpstream false resolves to false", () => {
    const config: OmlConfig = {
      version: 1,
      defaults: { autoUpstream: false },
      repos: [{ path: "/tmp/repo" }],
    };

    expect(getRepoConfig(config, "/tmp/repo").autoUpstream).toBeFalse();
  });

  it("repo override false beats defaults true", () => {
    const config: OmlConfig = {
      version: 1,
      defaults: { autoUpstream: true },
      repos: [{ path: "/tmp/repo", autoUpstream: false }],
    };

    expect(getRepoConfig(config, "/tmp/repo").autoUpstream).toBeFalse();
  });

  it("repo inherits defaults when autoUpstream missing", () => {
    const config: OmlConfig = {
      version: 1,
      defaults: { autoUpstream: false },
      repos: [{ path: "/tmp/repo", worktreeDir: "/tmp/wt" }],
    };

    expect(getRepoConfig(config, "/tmp/repo").autoUpstream).toBeFalse();
  });
});

describe("expandTemplate", () => {
  it("replaces {repo} and {branch}", () => {
    const result = expandTemplate("../{repo}-{branch}", {
      repo: "my-repo",
      branch: "feature/test",
    });

    expect(result).toBe("../my-repo-feature/test");
  });

  it("replaces multiple occurrences", () => {
    const result = expandTemplate("{repo}-{repo}-{branch}-{branch}", {
      repo: "api",
      branch: "main",
    });

    expect(result).toBe("api-api-main-main");
  });

  it("expands tilde to home directory", () => {
    const result = expandTemplate("~/.copse/worktrees/{repo}-{branch}", {
      repo: "my-app",
      branch: "feature-login",
    });

    const home = Bun.env.HOME ?? "~";
    expect(result).toBe(`${home}/.copse/worktrees/my-app-feature-login`);
  });

  it("does not expand tilde in middle of path", () => {
    const result = expandTemplate("../some~path/{repo}", {
      repo: "test",
      branch: "main",
    });

    expect(result).toBe("../some~path/test");
  });
});

describe("initConfig", () => {
  it("creates config file in temp dir", async () => {
    const dir = createTempDir("copse-config-init-");
    const configPath = join(dir, "nested", "config.json");

    const createdPath = initConfig(configPath);
    expect(createdPath).toBe(configPath);
    expect(existsSync(configPath)).toBeTrue();

    const content = await Bun.file(configPath).text();
    const parsed = JSON.parse(content);
    expect(parsed.version).toBe(1);
  });

  it("returns existing config path without overwriting the file", async () => {
    const dir = createTempDir("copse-config-existing-");
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, JSON.stringify({ version: 1, defaults: { worktreeDir: "custom" } }, null, 2), "utf-8");

    const returnedPath = initConfig(configPath);

    expect(returnedPath).toBe(configPath);
    const content = await Bun.file(configPath).text();
    expect(content).toContain('"worktreeDir": "custom"');
  });
});

describe("loadConfig", () => {
  it("returns default when no file exists", () => {
    const dir = createTempDir("copse-config-missing-");
    const configPath = join(dir, "no-config.json");

    const loaded = loadConfig(configPath);
    expect(loaded).toEqual({
      version: 1,
      defaults: {
        worktreeDir: "~/.copse/worktrees/{repo}-{branch}",
        copyFiles: [],
        linkFiles: [],
        postCreate: [],
        postRemove: [],
        autoUpstream: true,
      },
      repos: [],
    });
  });

  it("throws on invalid JSON", () => {
    const dir = createTempDir("copse-config-invalid-json-");
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, "{ invalid json", "utf-8");

    expect(() => loadConfig(configPath)).toThrow("Invalid JSON in config file");
  });

  it("throws on schema validation failure", () => {
    const dir = createTempDir("copse-config-invalid-schema-");
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, JSON.stringify({ version: 2 }, null, 2), "utf-8");

    expect(() => loadConfig(configPath)).toThrow("Config validation failed");
  });

  it("applies activeProfile overrides safely", () => {
    const dir = createTempDir("copse-config-profile-");
    const xdgConfigHome = join(dir, "xdg");
    const configDir = join(xdgConfigHome, "copse");
    const configPath = join(configDir, "config.json");

    mkdirSync(configDir, { recursive: true });
    Bun.env.XDG_CONFIG_HOME = xdgConfigHome;
    Bun.env.HOME = dir;

    writeFileSync(configPath, JSON.stringify({
      version: 1,
      defaults: {
        worktreeDir: "~/.copse/worktrees/{repo}-{branch}",
        autoUpstream: true,
      },
      profiles: {
        work: {
          defaults: {
            autoUpstream: false,
          },
          theme: "nord",
        },
      },
      activeProfile: "work",
    }, null, 2), "utf-8");

    const loaded = loadConfig();

    expect(loaded.defaults?.autoUpstream).toBeFalse();
    expect(loaded.theme).toBe("nord");
    expect(loaded.activeProfile).toBe("work");
  });

  it("throws when activeProfile produces an invalid resolved config", () => {
    const dir = createTempDir("copse-config-profile-invalid-");
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, JSON.stringify({
      version: 1,
      profiles: {
        broken: {
          defaults: {
            autoUpstream: "nope",
          },
        },
      },
      activeProfile: "broken",
    }, null, 2), "utf-8");

    expect(() => loadConfig(configPath)).toThrow("Config validation failed after applying activeProfile");
  });
});

describe("validateConfig - monorepo", () => {
  it("valid monorepo config passes validation", () => {
    const config = {
      version: 1,
      repos: [{
        path: "/tmp/test",
        monorepo: {
          autoDetect: true,
          extraPatterns: ["apps/*/*"],
          hooks: [{ glob: "apps/*", postCreate: ["pnpm install"] }],
        },
      }],
    };
    expect(validateConfig(config)).toEqual([]);
  });

  it("monorepo with only autoDetect validates", () => {
    expect(validateConfig({ version: 1, repos: [{ path: "/tmp", monorepo: { autoDetect: false } }] })).toEqual([]);
  });

  it("monorepo with only extraPatterns validates", () => {
    expect(validateConfig({ version: 1, repos: [{ path: "/tmp", monorepo: { extraPatterns: ["apps/*"] } }] })).toEqual([]);
  });

  it("monorepo with hooks array validates", () => {
    const config = {
      version: 1,
      repos: [{ path: "/tmp", monorepo: { hooks: [{ glob: "apps/*", postCreate: ["echo hi"] }] } }],
    };
    expect(validateConfig(config)).toEqual([]);
  });

  it("invalid extraPatterns (not string array) fails", () => {
    const result = validateConfig({
      version: 1,
      repos: [{ path: "/tmp", monorepo: { extraPatterns: 123 } }],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(e => e.field.includes("extraPatterns"))).toBeTrue();
  });

  it("invalid hooks missing glob fails", () => {
    const result = validateConfig({
      version: 1,
      repos: [{ path: "/tmp", monorepo: { hooks: [{ postCreate: ["echo hi"] }] } }],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(e => e.field.includes("glob"))).toBeTrue();
  });

  it("config without monorepo still validates (backward compat)", () => {
    const config = { version: 1, repos: [{ path: "/tmp/test", postCreate: ["bun install"] }] };
    expect(validateConfig(config)).toEqual([]);
  });

  it("unknown monorepo field returns error", () => {
    const result = validateConfig({
      version: 1,
      repos: [{ path: "/tmp", monorepo: { unknownField: true } }],
    });
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("getRepoConfig - monorepo", () => {
  it("repo with monorepo config resolves correctly", () => {
    const repoPath = "/tmp/mono-repo";
    const monorepoConfig = {
      autoDetect: true,
      extraPatterns: ["apps/*/*"],
      hooks: [{ glob: "apps/*", postCreate: ["pnpm install"] }],
    };
    const config: OmlConfig = {
      version: 1,
      repos: [{ path: repoPath, monorepo: monorepoConfig }],
    };
    const resolved = getRepoConfig(config, repoPath);
    expect(resolved.monorepo).toEqual(monorepoConfig);
  });

  it("repo without monorepo config returns undefined monorepo", () => {
    const config: OmlConfig = { version: 1, repos: [{ path: "/tmp/no-mono" }] };
    const resolved = getRepoConfig(config, "/tmp/no-mono");
    expect(resolved.monorepo).toBeUndefined();
  });
});

describe("validateConfig - workspaces", () => {
  it("valid workspaces config passes validation", () => {
    const config = {
      version: 1,
      workspaces: [
        {
          path: "~/Desktop/work",
          depth: 1,
          exclude: ["node_modules", ".cache"],
          defaults: {
            copyFiles: [".env"],
            postCreate: ["bun install"],
          },
        },
      ],
    };
    expect(validateConfig(config)).toEqual([]);
  });

  it("workspaces with only path validates", () => {
    expect(validateConfig({ version: 1, workspaces: [{ path: "/tmp/work" }] })).toEqual([]);
  });

  it("workspaces with depth at boundaries (1 and 3) validates", () => {
    expect(validateConfig({ version: 1, workspaces: [{ path: "/tmp", depth: 1 }] })).toEqual([]);
    expect(validateConfig({ version: 1, workspaces: [{ path: "/tmp", depth: 3 }] })).toEqual([]);
  });

  it("workspaces as non-array returns error", () => {
    const result = validateConfig({ version: 1, workspaces: "not-an-array" });
    expect(result.some((e) => e.field === "workspaces")).toBeTrue();
  });

  it("workspaces missing path returns error", () => {
    const result = validateConfig({ version: 1, workspaces: [{ depth: 1 }] });
    expect(result.some((e) => e.field === "workspaces[0].path")).toBeTrue();
  });

  it("workspaces depth below 1 returns error", () => {
    const result = validateConfig({ version: 1, workspaces: [{ path: "/tmp", depth: 0 }] });
    expect(result.some((e) => e.field === "workspaces[0].depth")).toBeTrue();
  });

  it("workspaces depth above 3 returns error", () => {
    const result = validateConfig({ version: 1, workspaces: [{ path: "/tmp", depth: 4 }] });
    expect(result.some((e) => e.field === "workspaces[0].depth")).toBeTrue();
  });

  it("workspaces depth as non-integer returns error", () => {
    const result = validateConfig({ version: 1, workspaces: [{ path: "/tmp", depth: 1.5 }] });
    expect(result.some((e) => e.field === "workspaces[0].depth")).toBeTrue();
  });

  it("workspaces exclude not string array returns error", () => {
    const result = validateConfig({ version: 1, workspaces: [{ path: "/tmp", exclude: [123] }] });
    expect(result.some((e) => e.field === "workspaces[0].exclude")).toBeTrue();
  });

  it("workspaces unknown field returns error", () => {
    const result = validateConfig({ version: 1, workspaces: [{ path: "/tmp", bogus: true }] });
    expect(result.some((e) => e.field === "workspaces[0].bogus")).toBeTrue();
  });

  it("workspaces defaults with monorepo field returns error", () => {
    const result = validateConfig({
      version: 1,
      workspaces: [{ path: "/tmp", defaults: { monorepo: { autoDetect: true } } }],
    });
    expect(result.some((e) => e.field === "workspaces[0].defaults.monorepo")).toBeTrue();
  });

  it("workspaces defaults invalid autoUpstream returns error", () => {
    const result = validateConfig({
      version: 1,
      workspaces: [{ path: "/tmp", defaults: { autoUpstream: "yes" } }],
    });
    expect(result.some((e) => e.field === "workspaces[0].defaults.autoUpstream")).toBeTrue();
  });
});

describe("loadConfig - workspaces expansion", () => {
  async function initTempRepo(dir: string): Promise<void> {
    writeFileSync(join(dir, "README.md"), "# tmp\n");
    await runGit(["init", "-b", "main"], dir);
    await runGit(["add", "."], dir);
    await runGit(["commit", "-m", "init"], dir);
  }

  it("expands workspace discovered repos into config.repos", async () => {
    const parent = createTempDir("copse-load-ws-expand-");
    const repoA = join(parent, "project-a");
    const repoB = join(parent, "project-b");
    mkdirSync(repoA);
    mkdirSync(repoB);
    await initTempRepo(repoA);
    await initTempRepo(repoB);

    const configDir = createTempDir("copse-load-ws-config-");
    const configPath = join(configDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        version: 1,
        workspaces: [{ path: parent }],
      }),
    );

    const loaded = loadConfig(configPath);
    expect(loaded.repos).toHaveLength(2);
    const paths = loaded.repos!.map((r) => r.path).sort();
    expect(paths).toEqual([resolve(repoA), resolve(repoB)]);
  });

  it("explicit repos take precedence over workspace-discovered repos with same path", async () => {
    const parent = createTempDir("copse-load-ws-precedence-");
    const repoPath = join(parent, "shared-repo");
    mkdirSync(repoPath);
    await initTempRepo(repoPath);

    const configDir = createTempDir("copse-load-ws-pre-config-");
    const configPath = join(configDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        version: 1,
        workspaces: [
          {
            path: parent,
            defaults: { copyFiles: ["from-workspace"] },
          },
        ],
        repos: [
          { path: repoPath, copyFiles: ["from-explicit"] },
        ],
      }),
    );

    const loaded = loadConfig(configPath);
    expect(loaded.repos).toHaveLength(1);
    expect(loaded.repos![0].copyFiles).toEqual(["from-explicit"]);
  });

  it("discovered repos inherit workspace defaults via getRepoConfig", async () => {
    const parent = createTempDir("copse-load-ws-defaults-");
    const repoA = join(parent, "app");
    mkdirSync(repoA);
    await initTempRepo(repoA);

    const configDir = createTempDir("copse-load-ws-def-config-");
    const configPath = join(configDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        version: 1,
        defaults: {
          worktreeDir: "~/.copse/global/{repo}-{branch}",
          postCreate: ["global-post"],
        },
        workspaces: [
          {
            path: parent,
            defaults: {
              copyFiles: [".env.workspace"],
              postCreate: ["workspace-post"],
            },
          },
        ],
      }),
    );

    const loaded = loadConfig(configPath);
    const resolved = getRepoConfig(loaded, resolve(repoA));
    expect(resolved.copyFiles).toEqual([".env.workspace"]);
    expect(resolved.postCreate).toEqual(["workspace-post"]);
    expect(resolved.worktreeDir).toBe("~/.copse/global/{repo}-{branch}");
  });

  it("loadConfig without workspaces behaves unchanged", async () => {
    const configDir = createTempDir("copse-load-ws-none-");
    const configPath = join(configDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        version: 1,
        repos: [{ path: "/tmp/explicit" }],
      }),
    );

    const loaded = loadConfig(configPath);
    expect(loaded.repos).toEqual([{ path: "/tmp/explicit" }]);
  });

  it("throws validation error for invalid workspaces config", () => {
    const configDir = createTempDir("copse-load-ws-invalid-");
    const configPath = join(configDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        version: 1,
        workspaces: [{ depth: 1 }],
      }),
    );

    expect(() => loadConfig(configPath)).toThrow("Config validation failed");
  });
});

describe("loadRawConfig", () => {
  async function initTempRepo(dir: string): Promise<void> {
    writeFileSync(join(dir, "README.md"), "# tmp\n");
    await runGit(["init", "-b", "main"], dir);
    await runGit(["add", "."], dir);
    await runGit(["commit", "-m", "init"], dir);
  }

  it("returns default config when no file exists", () => {
    const dir = createTempDir("copse-raw-missing-");
    const configPath = join(dir, "no-config.json");

    const loaded = loadRawConfig(configPath);
    expect(loaded.repos).toEqual([]);
    expect(loaded.version).toBe(1);
  });

  it("does NOT expand workspace-discovered repos into repos[]", async () => {
    const parent = createTempDir("copse-raw-no-expand-");
    const repoA = join(parent, "discovered-a");
    const repoB = join(parent, "discovered-b");
    mkdirSync(repoA);
    mkdirSync(repoB);
    await initTempRepo(repoA);
    await initTempRepo(repoB);

    const configDir = createTempDir("copse-raw-no-expand-config-");
    const configPath = join(configDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        version: 1,
        workspaces: [{ path: parent }],
        repos: [{ path: "/tmp/explicit-only" }],
      }),
    );

    const raw = loadRawConfig(configPath);
    expect(raw.repos).toHaveLength(1);
    expect(raw.repos![0]!.path).toBe("/tmp/explicit-only");
    expect(raw.workspaces).toHaveLength(1);

    const expanded = loadConfig(configPath);
    expect(expanded.repos!.length).toBeGreaterThanOrEqual(3);
    const expandedPaths = expanded.repos!.map((r) => r.path);
    expect(expandedPaths).toContain(resolve(repoA));
    expect(expandedPaths).toContain(resolve(repoB));
  });

  it("returns empty repos when only workspaces are configured", async () => {
    const parent = createTempDir("copse-raw-only-ws-");
    const repoA = join(parent, "alpha");
    mkdirSync(repoA);
    await initTempRepo(repoA);

    const configDir = createTempDir("copse-raw-only-ws-config-");
    const configPath = join(configDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        version: 1,
        workspaces: [{ path: parent }],
      }),
    );

    const raw = loadRawConfig(configPath);
    expect(raw.repos ?? []).toEqual([]);
    expect(raw.workspaces).toHaveLength(1);
  });

  it("preserves explicit repos exactly as authored", () => {
    const dir = createTempDir("copse-raw-explicit-");
    const configPath = join(dir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        version: 1,
        repos: [
          { path: "/tmp/repo-a", copyFiles: [".env"] },
          { path: "/tmp/repo-b" },
        ],
      }),
    );

    const raw = loadRawConfig(configPath);
    expect(raw.repos).toEqual([
      { path: "/tmp/repo-a", copyFiles: [".env"] },
      { path: "/tmp/repo-b" },
    ]);
  });

  it("throws on invalid JSON", () => {
    const dir = createTempDir("copse-raw-invalid-json-");
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, "{ invalid json", "utf-8");

    expect(() => loadRawConfig(configPath)).toThrow("Invalid JSON in config file");
  });

  it("throws on schema validation failure", () => {
    const dir = createTempDir("copse-raw-invalid-schema-");
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, JSON.stringify({ version: 2 }, null, 2), "utf-8");

    expect(() => loadRawConfig(configPath)).toThrow("Config validation failed");
  });

  it("applies activeProfile but skips workspace expansion", async () => {
    const parent = createTempDir("copse-raw-profile-");
    const repoA = join(parent, "discovered");
    mkdirSync(repoA);
    await initTempRepo(repoA);

    const configDir = createTempDir("copse-raw-profile-config-");
    const configPath = join(configDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        version: 1,
        defaults: { autoUpstream: true },
        workspaces: [{ path: parent }],
        profiles: {
          work: { defaults: { autoUpstream: false }, theme: "nord" },
        },
        activeProfile: "work",
      }),
    );

    const raw = loadRawConfig(configPath);
    expect(raw.defaults?.autoUpstream).toBeFalse();
    expect(raw.theme).toBe("nord");
    expect(raw.repos ?? []).toEqual([]);
  });
});

describe("ensureConfigInitialized", () => {
  it("creates config file when missing and reports created=true", () => {
    const dir = createTempDir("copse-ensure-create-");
    const configPath = join(dir, "nested", "config.json");
    expect(existsSync(configPath)).toBeFalse();

    const result = ensureConfigInitialized(configPath);
    expect(result.path).toBe(configPath);
    expect(result.created).toBeTrue();
    expect(existsSync(configPath)).toBeTrue();
  });

  it("is idempotent: second call reports created=false", () => {
    const dir = createTempDir("copse-ensure-idempotent-");
    const configPath = join(dir, "config.json");

    const first = ensureConfigInitialized(configPath);
    expect(first.created).toBeTrue();

    const second = ensureConfigInitialized(configPath);
    expect(second.created).toBeFalse();
    expect(second.path).toBe(configPath);
  });

  it("does not overwrite an existing config file", async () => {
    const dir = createTempDir("copse-ensure-no-overwrite-");
    const configPath = join(dir, "config.json");
    const customConfig = JSON.stringify(
      { version: 1, defaults: { worktreeDir: "custom-marker" } },
      null,
      2,
    );
    writeFileSync(configPath, customConfig, "utf-8");

    const result = ensureConfigInitialized(configPath);
    expect(result.created).toBeFalse();

    const content = await Bun.file(configPath).text();
    expect(content).toContain("custom-marker");
  });

  it("respects XDG_CONFIG_HOME when no override path is given", () => {
    const dir = createTempDir("copse-ensure-xdg-");
    Bun.env.XDG_CONFIG_HOME = dir;
    Bun.env.HOME = dir;

    const result = ensureConfigInitialized();
    expect(result.created).toBeTrue();
    expect(result.path).toBe(join(dir, "copse", "config.json"));
    expect(existsSync(result.path)).toBeTrue();
  });
});

describe("setNestedValue", () => {
  it("sets a top-level scalar on an empty object", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, ["theme"], "dracula");
    expect(obj).toEqual({ theme: "dracula" });
  });

  it("overwrites an existing top-level scalar", () => {
    const obj: Record<string, unknown> = { theme: "opencode" };
    setNestedValue(obj, ["theme"], "nord");
    expect(obj).toEqual({ theme: "nord" });
  });

  it("creates intermediate object when the next key is a string", () => {
    const obj: Record<string, unknown> = { version: 1 };
    setNestedValue(obj, ["defaults", "worktreeDir"], "~/wt/{repo}-{branch}");
    expect(obj).toEqual({ version: 1, defaults: { worktreeDir: "~/wt/{repo}-{branch}" } });
  });

  it("creates intermediate array when the next key is a number", () => {
    const obj: Record<string, unknown> = { version: 1 };
    setNestedValue(obj, ["repos", 0, "path"], "/tmp/a");
    expect(obj).toEqual({ version: 1, repos: [{ path: "/tmp/a" }] });
  });

  it("sets a deeply nested monorepo hook field without disturbing siblings", () => {
    const obj: Record<string, unknown> = {
      version: 1,
      repos: [
        {
          path: "/tmp/a",
          monorepo: {
            autoDetect: true,
            hooks: [
              { glob: "apps/*", copyFiles: [".env"], postCreate: ["pnpm install"] },
            ],
          },
        },
      ],
    };
    setNestedValue(obj, ["repos", 0, "monorepo", "hooks", 0, "copyFiles"], [".env", ".env.local"]);
    expect(obj).toEqual({
      version: 1,
      repos: [
        {
          path: "/tmp/a",
          monorepo: {
            autoDetect: true,
            hooks: [
              { glob: "apps/*", copyFiles: [".env", ".env.local"], postCreate: ["pnpm install"] },
            ],
          },
        },
      ],
    });
  });

  it("updates a value inside an array element without touching other elements", () => {
    const obj: Record<string, unknown> = {
      version: 1,
      repos: [{ path: "/tmp/a" }, { path: "/tmp/b" }],
    };
    setNestedValue(obj, ["repos", 1, "worktreeDir"], "~/wt/b");
    expect(obj).toEqual({
      version: 1,
      repos: [{ path: "/tmp/a" }, { path: "/tmp/b", worktreeDir: "~/wt/b" }],
    });
  });

  it("deletes a field when given undefined", () => {
    const obj: Record<string, unknown> = {
      version: 1,
      defaults: { worktreeDir: "~/wt", copyFiles: [".env"] },
    };
    setNestedValue(obj, ["defaults", "copyFiles"], undefined);
    expect(obj).toEqual({ version: 1, defaults: { worktreeDir: "~/wt" } });
  });

  it("removes an array element when given undefined and a numeric tail key", () => {
    const obj: Record<string, unknown> = {
      version: 1,
      repos: [{ path: "/tmp/a" }, { path: "/tmp/b" }, { path: "/tmp/c" }],
    };
    setNestedValue(obj, ["repos", 1], undefined);
    expect(obj).toEqual({
      version: 1,
      repos: [{ path: "/tmp/a" }, { path: "/tmp/c" }],
    });
  });

  it("produces a structure that passes validateConfig after edits", () => {
    const obj: Record<string, unknown> = { version: 1 };
    setNestedValue(obj, ["theme"], "github-dark");
    setNestedValue(obj, ["defaults", "worktreeDir"], "~/wt/{repo}-{branch}");
    setNestedValue(obj, ["defaults", "postRemove"], ["echo removed"]);
    setNestedValue(obj, ["repos", 0, "path"], "/tmp/work/msa");
    setNestedValue(obj, ["repos", 0, "monorepo", "autoDetect"], true);
    setNestedValue(obj, ["repos", 0, "monorepo", "extraPatterns"], ["apps/*/*"]);
    setNestedValue(obj, ["repos", 0, "monorepo", "hooks", 0, "glob"], "apps/*/*");
    setNestedValue(obj, ["repos", 0, "monorepo", "hooks", 0, "copyFiles"], [".env"]);
    setNestedValue(obj, ["repos", 0, "monorepo", "hooks", 0, "postCreate"], ["cd {packagePath} && pnpm install"]);

    expect(validateConfig(obj)).toEqual([]);
  });

  it("is a no-op for an empty path", () => {
    const obj: Record<string, unknown> = { version: 1 };
    setNestedValue(obj, [], "ignored");
    expect(obj).toEqual({ version: 1 });
  });
});
