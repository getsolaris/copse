import { existsSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import type { OmwConfig, RepoConfig } from "./config.ts";

const DEFAULT_DEPTH = 1;
const MAX_DEPTH = 3;

function expandHome(path: string): string {
  const home = Bun.env.HOME ?? "~";
  return path.replace(/^~(?=\/|$)/, home);
}

function resolveWorkspacePath(path: string): string {
  return resolve(expandHome(path));
}

function isMainGitRepo(candidatePath: string): boolean {
  const gitPath = join(candidatePath, ".git");
  if (!existsSync(gitPath)) {
    return false;
  }
  try {
    return statSync(gitPath).isDirectory();
  } catch {
    return false;
  }
}

function hasGitMarker(candidatePath: string): boolean {
  return existsSync(join(candidatePath, ".git"));
}

function isExistingDirectory(path: string): boolean {
  if (!existsSync(path)) {
    return false;
  }
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function compileExcludeMatcher(patterns: string[]): (name: string) => boolean {
  const globs = patterns
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .map((pattern) => new Bun.Glob(pattern));

  if (globs.length === 0) {
    return () => false;
  }

  return (name: string): boolean => globs.some((glob) => glob.match(name));
}

export function discoverRepos(
  workspacePath: string,
  depth: number = DEFAULT_DEPTH,
  exclude: string[] = [],
): string[] {
  const clampedDepth = Math.max(1, Math.min(depth, MAX_DEPTH));
  const root = resolveWorkspacePath(workspacePath);

  if (!isExistingDirectory(root)) {
    return [];
  }

  const isExcluded = compileExcludeMatcher(exclude);
  const found = new Set<string>();

  const scan = (currentDir: string, currentDepth: number): void => {
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || isExcluded(entry.name)) {
        continue;
      }

      const fullPath = join(currentDir, entry.name);

      if (hasGitMarker(fullPath)) {
        if (isMainGitRepo(fullPath)) {
          found.add(fullPath);
        }
        continue;
      }

      if (currentDepth < clampedDepth) {
        scan(fullPath, currentDepth + 1);
      }
    }
  };

  scan(root, 1);

  return [...found].sort((a, b) => a.localeCompare(b));
}

export function expandWorkspaces(config: OmwConfig): OmwConfig {
  const workspaces = config.workspaces;
  if (!workspaces || workspaces.length === 0) {
    return config;
  }

  const seen = new Set<string>(
    (config.repos ?? []).map((repo) => resolveWorkspacePath(repo.path)),
  );

  const discoveredRepos: RepoConfig[] = [];

  for (const workspace of workspaces) {
    const depth = workspace.depth ?? DEFAULT_DEPTH;
    const exclude = workspace.exclude ?? [];
    const discovered = discoverRepos(workspace.path, depth, exclude);

    for (const repoPath of discovered) {
      if (seen.has(repoPath)) {
        continue;
      }
      seen.add(repoPath);

      discoveredRepos.push({
        path: repoPath,
        ...(workspace.defaults ?? {}),
      });
    }
  }

  if (discoveredRepos.length === 0) {
    return config;
  }

  return {
    ...config,
    repos: [...(config.repos ?? []), ...discoveredRepos],
  };
}
