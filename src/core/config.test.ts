import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import {
  expandTemplate,
  getRepoConfig,
  initConfig,
  loadConfig,
  type OmwConfig,
  validateConfig,
} from "./config";
import { cleanupTempDirs, createTempDir } from "./test-helpers";

afterEach(() => {
  cleanupTempDirs();
});

describe("validateConfig", () => {
  it("valid config passes with no errors", () => {
    const valid: OmwConfig = {
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
    const config: OmwConfig = {
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
    const config: OmwConfig = {
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
    const config: OmwConfig = {
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
    const config: OmwConfig = { version: 1, repos: [{ path: "/tmp/repo" }] };

    expect(getRepoConfig(config, "/tmp/repo").autoUpstream).toBeTrue();
  });

  it("defaults.autoUpstream false resolves to false", () => {
    const config: OmwConfig = {
      version: 1,
      defaults: { autoUpstream: false },
      repos: [{ path: "/tmp/repo" }],
    };

    expect(getRepoConfig(config, "/tmp/repo").autoUpstream).toBeFalse();
  });

  it("repo override false beats defaults true", () => {
    const config: OmwConfig = {
      version: 1,
      defaults: { autoUpstream: true },
      repos: [{ path: "/tmp/repo", autoUpstream: false }],
    };

    expect(getRepoConfig(config, "/tmp/repo").autoUpstream).toBeFalse();
  });

  it("repo inherits defaults when autoUpstream missing", () => {
    const config: OmwConfig = {
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
    const result = expandTemplate("~/.omw/worktrees/{repo}-{branch}", {
      repo: "my-app",
      branch: "feature-login",
    });

    const home = Bun.env.HOME ?? "~";
    expect(result).toBe(`${home}/.omw/worktrees/my-app-feature-login`);
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
    const dir = createTempDir("omw-config-init-");
    const configPath = join(dir, "nested", "config.json");

    const createdPath = initConfig(configPath);
    expect(createdPath).toBe(configPath);
    expect(existsSync(configPath)).toBeTrue();

    const content = await Bun.file(configPath).text();
    const parsed = JSON.parse(content);
    expect(parsed.version).toBe(1);
  });
});

describe("loadConfig", () => {
  it("returns default when no file exists", () => {
    const dir = createTempDir("omw-config-missing-");
    const configPath = join(dir, "no-config.json");

    const loaded = loadConfig(configPath);
    expect(loaded).toEqual({
      version: 1,
      defaults: {
        worktreeDir: "~/.omw/worktrees/{repo}-{branch}",
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
    const dir = createTempDir("omw-config-invalid-json-");
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, "{ invalid json", "utf-8");

    expect(() => loadConfig(configPath)).toThrow("Invalid JSON in config file");
  });

  it("throws on schema validation failure", () => {
    const dir = createTempDir("omw-config-invalid-schema-");
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, JSON.stringify({ version: 2 }, null, 2), "utf-8");

    expect(() => loadConfig(configPath)).toThrow("Config validation failed");
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
    const config: OmwConfig = {
      version: 1,
      repos: [{ path: repoPath, monorepo: monorepoConfig }],
    };
    const resolved = getRepoConfig(config, repoPath);
    expect(resolved.monorepo).toEqual(monorepoConfig);
  });

  it("repo without monorepo config returns undefined monorepo", () => {
    const config: OmwConfig = { version: 1, repos: [{ path: "/tmp/no-mono" }] };
    const resolved = getRepoConfig(config, "/tmp/no-mono");
    expect(resolved.monorepo).toBeUndefined();
  });
});
