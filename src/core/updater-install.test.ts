import { describe, expect, it } from "bun:test";
import {
  detectInstallMethod,
  planInstallUpdate,
  type InstallDetectionOptions,
  type InstallMethod,
} from "./updater.ts";

function detector(path: string, extra: Partial<InstallDetectionOptions> = {}): InstallDetectionOptions {
  return {
    executablePath: path,
    realpath: (value) => value,
    which: () => undefined,
    pathExists: () => false,
    ...extra,
  };
}

describe("install method detection", () => {
  it("detects Homebrew Bun npm standalone and source installs", () => {
    const cases: readonly [InstallDetectionOptions, InstallMethod][] = [
      [detector("/opt/homebrew/Cellar/copse/1.3.2/bin/copse", { env: { HOMEBREW_PREFIX: "/opt/homebrew" } }), "homebrew"],
      [detector("/Users/me/.bun/install/global/node_modules/.bin/copse"), "bun"],
      [detector("/usr/local/lib/node_modules/@getsolaris/copse/dist/copse.js"), "npm"],
      [detector("/usr/local/bin/copse.js"), "standalone"],
      [detector("/repo/copse/src/index.ts"), "source"],
    ];

    for (const [options, expected] of cases) {
      expect(detectInstallMethod(options)).toBe(expected);
    }
  });

  it("keeps priority stable when paths expose multiple signals", () => {
    const options = detector("/opt/homebrew/Cellar/copse/1.3.2/libexec/node_modules/.bin/copse", {
      env: { HOMEBREW_PREFIX: "/opt/homebrew" },
    });

    expect(detectInstallMethod(options)).toBe("homebrew");
  });
});

describe("install update planning", () => {
  it("maps managed install methods to exact package manager commands", () => {
    expect(planInstallUpdate({ method: "homebrew", latestVersion: "1.3.2", executablePath: "/opt/homebrew/bin/copse" }))
      .toEqual({ kind: "command", method: "homebrew", command: ["brew", "upgrade", "getsolaris/tap/copse"] });
    expect(planInstallUpdate({ method: "bun", latestVersion: "1.3.2", executablePath: "/tmp/copse" }))
      .toEqual({ kind: "command", method: "bun", command: ["bun", "install", "-g", "@getsolaris/copse@1.3.2"] });
    expect(planInstallUpdate({ method: "npm", latestVersion: "1.3.2", executablePath: "/tmp/copse" }))
      .toEqual({ kind: "command", method: "npm", command: ["npm", "install", "-g", "@getsolaris/copse@1.3.2"] });
  });

  it("plans standalone replacement only when a sha256 digest is present", () => {
    expect(planInstallUpdate({ method: "standalone", latestVersion: "1.3.2", executablePath: "/usr/local/bin/copse.js" }))
      .toEqual({ kind: "unsupported-install", method: "standalone", reason: "digest-required" });
    expect(planInstallUpdate({
      method: "standalone",
      latestVersion: "1.3.2",
      executablePath: "/usr/local/bin/copse.js",
      standaloneAsset: {
        downloadUrl: "https://github.com/getsolaris/copse/releases/download/v1.3.2/copse.js",
        digest: "sha256:abc123",
      },
    })).toEqual({
      kind: "standalone",
      method: "standalone",
      targetPath: "/usr/local/bin/copse.js",
      preserveModeFrom: "/usr/local/bin/copse.js",
      downloadUrl: "https://github.com/getsolaris/copse/releases/download/v1.3.2/copse.js",
      digest: "sha256:abc123",
    });
  });

  it("does not execute package managers or mutate files while planning", () => {
    let probeCount = 0;
    const method = detectInstallMethod(detector("/usr/local/lib/node_modules/@getsolaris/copse/dist/copse.js", {
      which: () => {
        probeCount += 1;
        return undefined;
      },
    }));
    const plan = planInstallUpdate({ method, latestVersion: "1.3.2", executablePath: "/tmp/copse" });

    expect(method).toBe("npm");
    expect(plan).toMatchObject({ kind: "command", method: "npm" });
    expect(probeCount).toBe(0);
  });

  it("refuses source checkouts instead of overwriting them", () => {
    expect(planInstallUpdate({ method: "source", latestVersion: "1.3.2", executablePath: "/repo/copse/src/index.ts" }))
      .toEqual({ kind: "unsupported-install", method: "source", reason: "source-checkout" });
  });
});
