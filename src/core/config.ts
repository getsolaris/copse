import { join, resolve } from "path";
import * as fs from "fs";

interface FsSyncCompat {
  readFileSync(path: string, encoding: "utf-8"): string;
  mkdirSync(path: string, options?: { recursive?: boolean; mode?: number }): void;
  renameSync(oldPath: string, newPath: string): void;
  unlinkSync(path: string): void;
}

const fsSync = fs as unknown as FsSyncCompat;

export interface RepoDefaults {
  worktreeDir?: string;
  copyFiles?: string[];
  linkFiles?: string[];
  postCreate?: string[];
  postRemove?: string[];
  autoUpstream?: boolean;
}

export interface MonorepoHookConfig {
  glob: string;
  copyFiles?: string[];
  linkFiles?: string[];
  postCreate?: string[];
  postRemove?: string[];
}

export interface MonorepoConfig {
  autoDetect?: boolean;
  extraPatterns?: string[];
  hooks?: MonorepoHookConfig[];
}

export interface RepoConfig extends RepoDefaults {
  path: string;
  monorepo?: MonorepoConfig;
}

export interface OmwConfig {
  version: 1;
  defaults?: RepoDefaults;
  repos?: RepoConfig[];
  theme?: string;
}

export interface ResolvedRepoConfig extends Required<RepoDefaults> {
  monorepo?: MonorepoConfig;
}

export interface ValidationError {
  field: string;
  message: string;
}

const DEFAULT_WORKTREE_DIR = "~/.omw/worktrees/{repo}-{branch}";

const DEFAULT_CONFIG: OmwConfig = {
  version: 1,
  defaults: {
    worktreeDir: DEFAULT_WORKTREE_DIR,
    copyFiles: [],
    linkFiles: [],
    postCreate: [],
    postRemove: [],
    autoUpstream: true,
  },
  repos: [],
};

const DEFAULT_RESOLVED: ResolvedRepoConfig = {
  worktreeDir: DEFAULT_WORKTREE_DIR,
  copyFiles: [],
  linkFiles: [],
  postCreate: [],
  postRemove: [],
  autoUpstream: true,
};

function validateStringArray(
  value: unknown,
  field: string,
  errors: ValidationError[],
): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push({ field, message: "Must be an array of strings" });
  }
}

export function getConfigDir(): string {
  const xdgConfig = Bun.env.XDG_CONFIG_HOME;
  const base = xdgConfig ?? join(Bun.env.HOME ?? "~", ".config");
  return join(base, "oh-my-worktree");
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

export function validateConfig(data: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof data !== "object" || data === null) {
    errors.push({ field: "root", message: "Config must be a JSON object" });
    return errors;
  }

  const obj = data as Record<string, unknown>;

  if (!("version" in obj)) {
    errors.push({ field: "version", message: "Required field 'version' is missing" });
  } else if (obj.version !== 1) {
    errors.push({
      field: "version",
      message: `Expected version 1, got ${JSON.stringify(obj.version)}`,
    });
  }

  const validRootKeys = new Set(["version", "defaults", "repos", "$schema", "theme"]);
  for (const key of Object.keys(obj)) {
    if (!validRootKeys.has(key)) {
      errors.push({ field: key, message: `Unknown field '${key}'` });
    }
  }

  if ("defaults" in obj && obj.defaults !== undefined) {
    if (typeof obj.defaults !== "object" || obj.defaults === null) {
      errors.push({ field: "defaults", message: "Must be an object" });
    } else {
      const d = obj.defaults as Record<string, unknown>;
      const validDefaultKeys = new Set([
        "worktreeDir",
        "copyFiles",
        "linkFiles",
        "postCreate",
        "postRemove",
        "autoUpstream",
      ]);

      for (const key of Object.keys(d)) {
        if (!validDefaultKeys.has(key)) {
          errors.push({ field: `defaults.${key}`, message: `Unknown field '${key}'` });
        }
      }

      if ("worktreeDir" in d && typeof d.worktreeDir !== "string") {
        errors.push({ field: "defaults.worktreeDir", message: "Must be a string" });
      }

      if ("autoUpstream" in d && typeof d.autoUpstream !== "boolean") {
        errors.push({ field: "defaults.autoUpstream", message: "Must be a boolean" });
      }

      for (const arrayKey of [
        "copyFiles",
        "linkFiles",
        "postCreate",
        "postRemove",
      ] as const) {
        if (arrayKey in d) {
          validateStringArray(d[arrayKey], `defaults.${arrayKey}`, errors);
        }
      }
    }
  }

  if ("repos" in obj && obj.repos !== undefined) {
    if (!Array.isArray(obj.repos)) {
      errors.push({ field: "repos", message: "Must be an array" });
    } else {
      for (let i = 0; i < obj.repos.length; i++) {
        const repo = obj.repos[i];
        const fieldPrefix = `repos[${i}]`;

        if (typeof repo !== "object" || repo === null) {
          errors.push({ field: fieldPrefix, message: "Must be an object" });
          continue;
        }

        const r = repo as Record<string, unknown>;
        const validRepoKeys = new Set([
          "path",
          "worktreeDir",
          "copyFiles",
          "linkFiles",
          "postCreate",
          "postRemove",
          "autoUpstream",
          "monorepo",
        ]);

        for (const key of Object.keys(r)) {
          if (!validRepoKeys.has(key)) {
            errors.push({
              field: `${fieldPrefix}.${key}`,
              message: `Unknown field '${key}'`,
            });
          }
        }

        if (!("path" in r) || typeof r.path !== "string") {
          errors.push({
            field: `${fieldPrefix}.path`,
            message: "Required string field 'path' is missing",
          });
        }

        if ("worktreeDir" in r && typeof r.worktreeDir !== "string") {
          errors.push({ field: `${fieldPrefix}.worktreeDir`, message: "Must be a string" });
        }

        if ("autoUpstream" in r && typeof r.autoUpstream !== "boolean") {
          errors.push({ field: `${fieldPrefix}.autoUpstream`, message: "Must be a boolean" });
        }

        for (const arrayKey of [
          "copyFiles",
          "linkFiles",
          "postCreate",
          "postRemove",
        ] as const) {
          if (arrayKey in r) {
            validateStringArray(r[arrayKey], `${fieldPrefix}.${arrayKey}`, errors);
          }
        }

        if ("monorepo" in r && r.monorepo !== undefined) {
          if (typeof r.monorepo !== "object" || r.monorepo === null) {
            errors.push({ field: `${fieldPrefix}.monorepo`, message: "Must be an object" });
          } else {
            const mono = r.monorepo as Record<string, unknown>;
            const validMonorepoKeys = new Set(["autoDetect", "extraPatterns", "hooks"]);
            for (const key of Object.keys(mono)) {
              if (!validMonorepoKeys.has(key)) {
                errors.push({ field: `${fieldPrefix}.monorepo.${key}`, message: `Unknown field '${key}'` });
              }
            }
            if ("autoDetect" in mono && typeof mono.autoDetect !== "boolean") {
              errors.push({ field: `${fieldPrefix}.monorepo.autoDetect`, message: "Must be a boolean" });
            }
            if ("extraPatterns" in mono && mono.extraPatterns !== undefined) {
              validateStringArray(mono.extraPatterns, `${fieldPrefix}.monorepo.extraPatterns`, errors);
            }
            if ("hooks" in mono && mono.hooks !== undefined) {
              if (!Array.isArray(mono.hooks)) {
                errors.push({ field: `${fieldPrefix}.monorepo.hooks`, message: "Must be an array" });
              } else {
                for (let j = 0; j < mono.hooks.length; j++) {
                  const hook = mono.hooks[j] as Record<string, unknown>;
                  if (typeof hook !== "object" || hook === null) {
                    errors.push({ field: `${fieldPrefix}.monorepo.hooks[${j}]`, message: "Must be an object" });
                    continue;
                  }
                  if (!("glob" in hook) || typeof hook.glob !== "string") {
                    errors.push({ field: `${fieldPrefix}.monorepo.hooks[${j}].glob`, message: "Required string field" });
                  }
                  if ("copyFiles" in hook && hook.copyFiles !== undefined) {
                    validateStringArray(hook.copyFiles, `${fieldPrefix}.monorepo.hooks[${j}].copyFiles`, errors);
                  }
                  if ("linkFiles" in hook && hook.linkFiles !== undefined) {
                    validateStringArray(hook.linkFiles, `${fieldPrefix}.monorepo.hooks[${j}].linkFiles`, errors);
                  }
                  if ("postCreate" in hook && hook.postCreate !== undefined) {
                    validateStringArray(hook.postCreate, `${fieldPrefix}.monorepo.hooks[${j}].postCreate`, errors);
                  }
                  if ("postRemove" in hook && hook.postRemove !== undefined) {
                    validateStringArray(hook.postRemove, `${fieldPrefix}.monorepo.hooks[${j}].postRemove`, errors);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return errors;
}

export function loadConfig(overridePath?: string): OmwConfig {
  const configPath = overridePath ?? getConfigPath();

  if (!fs.existsSync(configPath)) {
    return structuredClone(DEFAULT_CONFIG);
  }

  let parsed: unknown;
  try {
    const raw = fsSync.readFileSync(configPath, "utf-8");
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("JSON")) {
      throw new Error(`Invalid JSON in config file: ${message}`);
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${message}`);
    }

    throw new Error(`Failed to read config file: ${message}`);
  }

  const errors = validateConfig(parsed);
  if (errors.length > 0) {
    const message = errors.map((e) => `${e.field}: ${e.message}`).join("; ");
    throw new Error(`Config validation failed: ${message}`);
  }

  return parsed as OmwConfig;
}

export function getRepoConfig(config: OmwConfig, repoPath: string): ResolvedRepoConfig {
  const normalizedPath = resolve(repoPath);
  const repoOverride = config.repos?.find((repo) => resolve(repo.path) === normalizedPath);

  return {
    worktreeDir:
      repoOverride?.worktreeDir ?? config.defaults?.worktreeDir ?? DEFAULT_RESOLVED.worktreeDir,
    copyFiles: repoOverride?.copyFiles ?? config.defaults?.copyFiles ?? DEFAULT_RESOLVED.copyFiles,
    linkFiles: repoOverride?.linkFiles ?? config.defaults?.linkFiles ?? DEFAULT_RESOLVED.linkFiles,
    postCreate: repoOverride?.postCreate ?? config.defaults?.postCreate ?? DEFAULT_RESOLVED.postCreate,
    postRemove: repoOverride?.postRemove ?? config.defaults?.postRemove ?? DEFAULT_RESOLVED.postRemove,
    autoUpstream:
      repoOverride?.autoUpstream ?? config.defaults?.autoUpstream ?? DEFAULT_RESOLVED.autoUpstream,
    monorepo: repoOverride?.monorepo,
  };
}

export function getConfiguredRepoPaths(config: OmwConfig): string[] {
  return (config.repos ?? []).map((repo) => resolve(repo.path));
}

export function expandTemplate(
  template: string,
  vars: { repo: string; branch: string },
): string {
  const home = Bun.env.HOME ?? "~";
  return template
    .replace(/^~(?=\/|$)/, home)
    .replace(/\{repo\}/g, vars.repo)
    .replace(/\{branch\}/g, vars.branch);
}

export function initConfig(overridePath?: string): string {
  const configPath = overridePath ?? getConfigPath();
  const configDir = overridePath ? resolve(configPath, "..") : getConfigDir();

  if (!fs.existsSync(configDir)) {
    fsSync.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  if (fs.existsSync(configPath)) {
    return configPath;
  }

  writeAtomically(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  return configPath;
}

export function writeAtomically(filePath: string, content: string): void {
  const tmpPath = `${filePath}.tmp.${Date.now()}`;

  try {
    fs.writeFileSync(tmpPath, content, { encoding: "utf-8", mode: 0o600 });

    const parsed = JSON.parse(content);
    const errors = validateConfig(parsed);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map((e) => e.message).join("; ")}`);
    }

    fsSync.renameSync(tmpPath, filePath);
  } catch (error) {
    if (fs.existsSync(tmpPath)) {
      fsSync.unlinkSync(tmpPath);
    }
    throw error;
  }
}
