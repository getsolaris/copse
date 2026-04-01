import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

export type MonorepoTool =
  | "pnpm"
  | "turbo"
  | "nx"
  | "lerna"
  | "npm-workspaces"
  | "yarn-workspaces";

export interface DetectionResult {
  tool: MonorepoTool;
  configFile: string;
  packagePaths: string[];
}

export interface MonorepoPackages {
  detected: DetectionResult[];
  extra: string[];
  all: string[];
}

function normalizePattern(pattern: string): string {
  const trimmed = pattern.trim();
  const quoteMatch = trimmed.match(/^['"](.*)['"]$/);
  return quoteMatch ? quoteMatch[1] : trimmed;
}

function readPackageWorkspacePatterns(rootDir: string): string[] {
  const packageJsonPath = join(rootDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      workspaces?: string[] | { packages?: string[] };
    };

    const { workspaces } = parsed;
    if (Array.isArray(workspaces)) {
      return workspaces.map(normalizePattern).filter(Boolean);
    }

    if (workspaces && Array.isArray(workspaces.packages)) {
      return workspaces.packages.map(normalizePattern).filter(Boolean);
    }
  } catch {
    return [];
  }

  return [];
}

export function expandPackageGlobs(rootDir: string, patterns: string[]): string[] {
  const found = new Set<string>();

  try {
    for (const rawPattern of patterns) {
      const pattern = normalizePattern(rawPattern);
      if (!pattern) {
        continue;
      }

      const glob = new Bun.Glob(pattern);
      for (const match of glob.scanSync({ cwd: rootDir, onlyFiles: false })) {
        const absolutePath = join(rootDir, match);
        if (!statSync(absolutePath).isDirectory()) {
          continue;
        }

        const relPath = relative(rootDir, absolutePath) || match;
        found.add(relPath.replace(/\\/g, "/"));
      }
    }
  } catch {
    return [];
  }

  return [...found].sort((a, b) => a.localeCompare(b));
}

function parsePnpmWorkspacePatterns(rootDir: string): string[] {
  const workspacePath = join(rootDir, "pnpm-workspace.yaml");
  if (!existsSync(workspacePath)) {
    return [];
  }

  try {
    const lines = readFileSync(workspacePath, "utf-8").split(/\r?\n/);
    const patterns: string[] = [];
    let inPackagesBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!inPackagesBlock) {
        if (trimmed === "packages:" || trimmed.startsWith("packages:")) {
          inPackagesBlock = true;
        }
        continue;
      }

      if (line.startsWith("  - ")) {
        patterns.push(normalizePattern(line.slice(4)));
        continue;
      }

      if (trimmed.length === 0) {
        continue;
      }

      if (!line.startsWith(" ")) {
        break;
      }
    }

    return patterns.filter(Boolean);
  } catch {
    return [];
  }
}

function scanNxProjects(rootDir: string): string[] {
  const found = new Set<string>();

  const scan = (currentDir: string, depth: number): void => {
    if (depth > 3) {
      return;
    }

    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isFile() && entry.name === "project.json") {
        const packageDir = relative(rootDir, currentDir).replace(/\\/g, "/");
        if (packageDir) {
          found.add(packageDir);
        }
        continue;
      }

      if (entry.isDirectory()) {
        scan(fullPath, depth + 1);
      }
    }
  };

  scan(rootDir, 0);

  return [...found].sort((a, b) => a.localeCompare(b));
}

export function detectMonorepoTools(rootDir: string): DetectionResult[] {
  const results: DetectionResult[] = [];

  const pnpmWorkspacePath = join(rootDir, "pnpm-workspace.yaml");
  if (existsSync(pnpmWorkspacePath)) {
    const pnpmPatterns = parsePnpmWorkspacePatterns(rootDir);
    results.push({
      tool: "pnpm",
      configFile: "pnpm-workspace.yaml",
      packagePaths: expandPackageGlobs(rootDir, pnpmPatterns),
    });
  }

  const turboPath = join(rootDir, "turbo.json");
  if (existsSync(turboPath)) {
    const workspacePatterns = readPackageWorkspacePatterns(rootDir);
    results.push({
      tool: "turbo",
      configFile: "turbo.json",
      packagePaths:
        workspacePatterns.length > 0 ? expandPackageGlobs(rootDir, workspacePatterns) : [],
    });
  }

  const nxPath = join(rootDir, "nx.json");
  if (existsSync(nxPath)) {
    results.push({
      tool: "nx",
      configFile: "nx.json",
      packagePaths: scanNxProjects(rootDir),
    });
  }

  const lernaPath = join(rootDir, "lerna.json");
  if (existsSync(lernaPath)) {
    try {
      const lernaRaw = readFileSync(lernaPath, "utf-8");
      const lernaConfig = JSON.parse(lernaRaw) as { packages?: string[] };
      const lernaPatterns =
        Array.isArray(lernaConfig.packages) && lernaConfig.packages.length > 0
          ? lernaConfig.packages.map(normalizePattern)
          : ["packages/*"];

      results.push({
        tool: "lerna",
        configFile: "lerna.json",
        packagePaths: expandPackageGlobs(rootDir, lernaPatterns),
      });
    } catch {
      results.push({
        tool: "lerna",
        configFile: "lerna.json",
        packagePaths: [],
      });
    }
  }

  const packageJsonPath = join(rootDir, "package.json");
  if (existsSync(packageJsonPath)) {
    const workspacePatterns = readPackageWorkspacePatterns(rootDir);
    if (workspacePatterns.length > 0) {
      results.push({
        tool: existsSync(join(rootDir, "yarn.lock")) ? "yarn-workspaces" : "npm-workspaces",
        configFile: "package.json",
        packagePaths: expandPackageGlobs(rootDir, workspacePatterns),
      });
    }
  }

  return results;
}

export function discoverPackages(rootDir: string, extraPatterns?: string[]): MonorepoPackages {
  const detected = detectMonorepoTools(rootDir);
  const extra = expandPackageGlobs(rootDir, extraPatterns ?? []);
  const detectedPaths = detected.flatMap((result) => result.packagePaths);

  return {
    detected,
    extra,
    all: [...new Set([...detectedPaths, ...extra])].sort((a, b) => a.localeCompare(b)),
  };
}

export function validateFocusPaths(
  rootDir: string,
  focusPaths: string[],
): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const rawPath of focusPaths) {
    const trimmedPath = rawPath.trim();
    if (!trimmedPath) {
      invalid.push(trimmedPath);
      continue;
    }

    const absolutePath = join(rootDir, trimmedPath);
    try {
      if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
        valid.push(trimmedPath);
      } else {
        invalid.push(trimmedPath);
      }
    } catch {
      invalid.push(trimmedPath);
    }
  }

  return { valid, invalid };
}
