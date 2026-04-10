import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { OmlConfig } from "./config.ts";
import {
  applyProfile,
  createProfile,
  deleteProfile,
  getActiveProfile,
  getProfile,
  listProfiles,
  setActiveProfile,
} from "./profiles.ts";
import { cleanupTempDirs, createTempDir } from "./test-helpers.ts";

interface ProfileValue {
  [key: string]: unknown;
}

interface ProfileConfig extends OmlConfig {
  profiles?: Record<string, ProfileValue>;
  activeProfile?: string;
}

const originalXdgConfigHome = Bun.env.XDG_CONFIG_HOME;
const originalHome = Bun.env.HOME;

function setupTempConfig(initial: ProfileConfig): string {
  const dir = createTempDir("copse-profiles-");
  const xdgConfigHome = join(dir, "xdg");
  const configDir = join(xdgConfigHome, "copse");
  const configPath = join(configDir, "config.json");

  mkdirSync(configDir, { recursive: true });
  Bun.env.XDG_CONFIG_HOME = xdgConfigHome;
  Bun.env.HOME = dir;

  writeFileSync(configPath, `${JSON.stringify(initial, null, 2)}\n`, "utf-8");
  return configPath;
}

function readRawConfig(configPath: string): ProfileConfig {
  return JSON.parse(readFileSync(configPath, "utf-8")) as ProfileConfig;
}

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

describe("profiles.listProfiles", () => {
  it("returns empty array when no profiles exist", () => {
    const config: ProfileConfig = { version: 1, repos: [] };

    expect(listProfiles(config)).toEqual([]);
  });
});

describe("profiles.getProfile", () => {
  it("returns null for unknown profile", () => {
    const config: ProfileConfig = {
      version: 1,
      profiles: { dev: { theme: "tokyo-night" } },
      repos: [],
    };

    expect(getProfile(config, "missing")).toBeNull();
  });
});

describe("profiles.createProfile", () => {
  it("creates a profile and persists it in config", () => {
    const configPath = setupTempConfig({ version: 1, repos: [] });

    createProfile("dev", { theme: "dracula", defaults: { autoUpstream: false } });

    expect(existsSync(configPath)).toBeTrue();
    const parsed = readRawConfig(configPath);
    expect(parsed.profiles?.dev).toEqual({
      theme: "dracula",
      defaults: { autoUpstream: false },
    });
  });
});

describe("profiles.setActiveProfile/getActiveProfile", () => {
  it("sets and reads active profile", () => {
    const configPath = setupTempConfig({
      version: 1,
      repos: [],
      profiles: {
        dev: { theme: "dracula" },
      },
    });

    setActiveProfile("dev");

    const stored = readRawConfig(configPath);
    expect(stored.activeProfile).toBe("dev");
    expect(getActiveProfile(stored)).toBe("dev");
  });
});

describe("profiles.applyProfile", () => {
  it("deep-merges profile over base config and replaces arrays", () => {
    const base: ProfileConfig = {
      version: 1,
      defaults: {
        copyFiles: [".env"],
        postCreate: ["bun install"],
      },
      repos: [{ path: "/tmp/repo-a" }],
      profiles: {
        mobile: {
          defaults: {
            copyFiles: [".env.mobile"],
          },
          repos: [{ path: "/tmp/repo-b" }],
          theme: "nord",
        },
      },
    };

    const applied = applyProfile(base, "mobile") as ProfileConfig;

    expect(applied.defaults?.copyFiles).toEqual([".env.mobile"]);
    expect(applied.defaults?.postCreate).toEqual(["bun install"]);
    expect(applied.repos).toEqual([{ path: "/tmp/repo-b" }]);
    expect(applied.theme).toBe("nord");

    expect(base.defaults?.copyFiles).toEqual([".env"]);
    expect(base.repos).toEqual([{ path: "/tmp/repo-a" }]);
    expect(base.theme).toBeUndefined();
  });

  it("returns a new unchanged object when profile is missing", () => {
    const base: ProfileConfig = { version: 1, repos: [] };

    const applied = applyProfile(base, "missing");

    expect(applied).toEqual(base);
    expect(applied).not.toBe(base);
  });
});

describe("profiles.deleteProfile", () => {
  it("deletes active profile and clears activeProfile", () => {
    const configPath = setupTempConfig({ version: 1, repos: [] });

    createProfile("dev", { theme: "dracula" });
    createProfile("qa", { theme: "nord" });
    setActiveProfile("dev");
    deleteProfile("dev");

    const parsed = readRawConfig(configPath);
    expect(parsed.profiles?.dev).toBeUndefined();
    expect(parsed.profiles?.qa).toEqual({ theme: "nord" });
    expect(parsed.activeProfile).toBeUndefined();
  });
});
