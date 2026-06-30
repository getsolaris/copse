import { afterEach, describe, expect, it } from "bun:test";
import { chmodSync, cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { cleanupTempDirs, createTempDir, createTempRepo } from "./test-helpers.ts";

const projectRoot = resolve(import.meta.dir, "../..");
const projectSrc = resolve(import.meta.dir, "..");
const releaseServers: Array<{ stop(): void }> = [];

interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

interface ReleaseServer {
  readonly url: string;
  stop(): void;
}

interface CliFixture {
  readonly cliPath: string;
  readonly preloadPath: string;
  readonly env: Record<string, string>;
}

async function runCli(args: readonly string[], cwd: string, fixture: CliFixture): Promise<CommandResult> {
  const proc = (Bun as any).spawn(["bun", "run", "--preload", fixture.preloadPath, fixture.cliPath, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...(Bun as any).env,
      ...fixture.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), exitCode };
}

function createCliFixture(root: string, releaseUrl: string, npmScript = "printf update-ok\n"): CliFixture {
  const xdgConfigHome = join(root, "xdg");
  const packageDir = join(root, "node_modules", "@getsolaris", "copse");
  const binDir = join(root, "bin");
  mkdirSync(xdgConfigHome, { recursive: true });
  mkdirSync(packageDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  cpSync(projectSrc, join(packageDir, "src"), { recursive: true });
  writeFileSync(join(packageDir, "package.json"), `${JSON.stringify({ version: "1.3.1", type: "module" }, null, 2)}\n`);
  symlinkSync(join(projectRoot, "node_modules"), join(packageDir, "node_modules"), "dir");

  const preloadPath = join(root, "mock-release-fetch.js");
  writeFileSync(preloadPath, `const releaseUrl = ${JSON.stringify(releaseUrl)};
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, init) => {
  const target = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
  if (target === "https://api.github.com/repos/getsolaris/copse/releases/latest") {
    return originalFetch(releaseUrl, init);
  }
  return originalFetch(url, init);
};
`);

  const npmPath = join(binDir, "npm");
  writeFileSync(npmPath, `#!/bin/sh\n${npmScript}`);
  chmodSync(npmPath, 0o755);

  return {
    cliPath: join(packageDir, "src", "index.ts"),
    preloadPath,
    env: {
      HOME: root,
      XDG_CONFIG_HOME: xdgConfigHome,
      XDG_CACHE_HOME: join(root, "cache"),
      PATH: `${binDir}:${(Bun as any).env.PATH ?? ""}`,
    },
  };
}

function startReleaseServer(): ReleaseServer {
  const release = {
    tag_name: "v9.9.9",
    html_url: "https://github.com/getsolaris/copse/releases/tag/v9.9.9",
    assets: [
      {
        name: "copse.js",
        browser_download_url: "http://127.0.0.1/copse.js",
        digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
    ],
  };
  const server = (Bun as any).serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      return new Response(JSON.stringify(release), {
        headers: { "content-type": "application/json" },
      });
    },
  });
  const handle = {
    url: `http://127.0.0.1:${server.port}/latest`,
    stop() {
      server.stop(true);
    },
  };
  releaseServers.push(handle);
  return handle;
}

function parseObject(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected JSON object");
  }
  return Object.fromEntries(Object.entries(value));
}

function readStatus(text: string): string | undefined {
  const status = parseObject(text).status;
  return typeof status === "string" ? status : undefined;
}

function readIgnoredVersion(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  for (const [key, fieldValue] of Object.entries(value)) {
    if (key === "ignoredVersion" && typeof fieldValue === "string") return fieldValue;
  }
  return undefined;
}

afterEach(() => {
  while (releaseServers.length > 0) {
    releaseServers.pop()?.stop();
  }
  cleanupTempDirs();
});

describe("update CLI command", () => {
  it("prints parseable update status when checking JSON", async () => {
    const repoPath = await createTempRepo("copse-update-check-");
    const root = createTempDir("copse-update-env-");
    const server = startReleaseServer();
    const fixture = createCliFixture(root, server.url);

    const result = await runCli(["update", "--check", "--json"], repoPath, fixture);

    expect(result.exitCode).toBe(0);
    expect(readStatus(result.stdout)).toBe("update-available");
    expect(result.stdout).toContain("\"latestVersion\": \"9.9.9\"");
    expect(result.stdout).not.toContain("update-ok");
  });

  it("does not prompt or install by default when stdin is not a TTY", async () => {
    const repoPath = await createTempRepo("copse-update-nontty-");
    const root = createTempDir("copse-update-env-");
    const server = startReleaseServer();
    const fixture = createCliFixture(root, server.url);

    const result = await runCli(["update"], repoPath, fixture);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Update available");
    expect(result.stdout).toContain("copse update --yes");
    expect(result.stdout).not.toContain("update-ok");
  });

  it("runs the planned update command when --yes is set", async () => {
    const repoPath = await createTempRepo("copse-update-yes-");
    const root = createTempDir("copse-update-env-");
    const server = startReleaseServer();
    const fixture = createCliFixture(root, server.url);

    const result = await runCli(["update", "--yes"], repoPath, fixture);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("update-ok");
  });

  it("exits 1 when explicit update execution fails", async () => {
    const repoPath = await createTempRepo("copse-update-fail-");
    const root = createTempDir("copse-update-env-");
    const server = startReleaseServer();
    const fixture = createCliFixture(root, server.url, "echo update-failed >&2\nexit 42\n");

    const result = await runCli(["update", "--yes"], repoPath, fixture);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("update-failed");
  });

  it("writes ignored latest version and suppresses that exact version", async () => {
    const repoPath = await createTempRepo("copse-update-ignore-");
    const root = createTempDir("copse-update-env-");
    const server = startReleaseServer();
    const fixture = createCliFixture(root, server.url);

    const ignore = await runCli(["update", "--ignore"], repoPath, fixture);
    const check = await runCli(["update", "--check", "--json"], repoPath, fixture);
    const config = parseObject(readFileSync(join(root, "xdg", "copse", "config.json"), "utf-8"));
    const updates = config.updates;

    expect(ignore.exitCode).toBe(0);
    expect(ignore.stdout).toContain("Ignored 9.9.9");
    expect(readStatus(check.stdout)).toBe("ignored-version");
    expect(readIgnoredVersion(updates)).toBe("9.9.9");
  });
});
