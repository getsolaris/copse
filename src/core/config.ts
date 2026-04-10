import { join, resolve } from "path";
import * as fs from "fs";
import { expandWorkspaces } from "./workspace.ts";

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
  sharedDeps?: SharedDepsConfig;
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

export interface TemplateConfig {
  worktreeDir?: string;
  copyFiles?: string[];
  linkFiles?: string[];
  postCreate?: string[];
  postRemove?: string[];
  autoUpstream?: boolean;
  base?: string;
}

export interface LifecycleConfig {
  autoCleanMerged?: boolean;
  staleAfterDays?: number;
  maxWorktrees?: number;
}

export interface SessionWindowConfig {
  name: string;
  command?: string;
}

export interface SessionLayoutConfig {
  windows: SessionWindowConfig[];
}

export interface SessionConfig {
  enabled?: boolean;
  autoCreate?: boolean;
  autoKill?: boolean;
  prefix?: string;
  defaultLayout?: string;
  layouts?: Record<string, SessionLayoutConfig>;
}

export interface SharedDepsConfig {
  strategy?: "hardlink" | "symlink" | "copy";
  paths?: string[];
  invalidateOn?: string[];
}

export interface RepoConfig extends RepoDefaults {
  path: string;
  monorepo?: MonorepoConfig;
}

export interface WorkspaceConfig {
  path: string;
  depth?: number;
  exclude?: string[];
  defaults?: RepoDefaults;
}

export interface OmlConfig {
  version: 1;
  defaults?: RepoDefaults;
  repos?: RepoConfig[];
  workspaces?: WorkspaceConfig[];
  theme?: string;
  templates?: Record<string, TemplateConfig>;
  lifecycle?: LifecycleConfig;
  sessions?: SessionConfig;
  profiles?: Record<string, object>;
  activeProfile?: string;
}

export interface ResolvedRepoConfig extends Omit<Required<RepoDefaults>, "sharedDeps"> {
  monorepo?: MonorepoConfig;
  sharedDeps?: SharedDepsConfig;
}

export interface ValidationError {
  field: string;
  message: string;
}

const DEFAULT_WORKTREE_DIR = "~/.copse/worktrees/{repo}-{branch}";

const DEFAULT_CONFIG: OmlConfig = {
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
  sharedDeps: undefined,
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
  return join(base, "copse");
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

const VALID_ROOT_KEYS = new Set(["version", "defaults", "repos", "workspaces", "$schema", "theme", "templates", "lifecycle", "sessions", "profiles", "activeProfile"]);
const VALID_DEFAULT_KEYS = new Set(["worktreeDir", "copyFiles", "linkFiles", "postCreate", "postRemove", "autoUpstream", "sharedDeps"]);
const VALID_REPO_KEYS = new Set(["path", "worktreeDir", "copyFiles", "linkFiles", "postCreate", "postRemove", "autoUpstream", "monorepo", "sharedDeps"]);
const VALID_WORKSPACE_KEYS = new Set(["path", "depth", "exclude", "defaults"]);
const VALID_MONOREPO_KEYS = new Set(["autoDetect", "extraPatterns", "hooks"]);
const VALID_TEMPLATE_KEYS = new Set(["worktreeDir", "copyFiles", "linkFiles", "postCreate", "postRemove", "autoUpstream", "base"]);
const VALID_LIFECYCLE_KEYS = new Set(["autoCleanMerged", "staleAfterDays", "maxWorktrees"]);
const VALID_SESSION_KEYS = new Set(["enabled", "autoCreate", "autoKill", "prefix", "defaultLayout", "layouts"]);
const VALID_PROFILE_KEYS = new Set(["defaults", "repos", "workspaces", "theme", "templates", "lifecycle", "sessions"]);

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
  for (const key of Object.keys(obj)) {
    if (!VALID_ROOT_KEYS.has(key)) {
      errors.push({ field: key, message: `Unknown field '${key}'` });
    }
  }

  if ("defaults" in obj && obj.defaults !== undefined) {
    if (typeof obj.defaults !== "object" || obj.defaults === null) {
      errors.push({ field: "defaults", message: "Must be an object" });
    } else {
      const d = obj.defaults as Record<string, unknown>;

      for (const key of Object.keys(d)) {
        if (!VALID_DEFAULT_KEYS.has(key)) {
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

      if ("sharedDeps" in d && d.sharedDeps !== undefined) {
        if (typeof d.sharedDeps !== "object" || d.sharedDeps === null) {
          errors.push({ field: "defaults.sharedDeps", message: "Must be an object" });
        } else {
          validateSharedDeps(d.sharedDeps as Record<string, unknown>, "defaults.sharedDeps", errors);
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

        for (const key of Object.keys(r)) {
          if (!VALID_REPO_KEYS.has(key)) {
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

        if ("sharedDeps" in r && r.sharedDeps !== undefined) {
          if (typeof r.sharedDeps !== "object" || r.sharedDeps === null) {
            errors.push({ field: `${fieldPrefix}.sharedDeps`, message: "Must be an object" });
          } else {
            validateSharedDeps(r.sharedDeps as Record<string, unknown>, `${fieldPrefix}.sharedDeps`, errors);
          }
        }

        if ("monorepo" in r && r.monorepo !== undefined) {
          if (typeof r.monorepo !== "object" || r.monorepo === null) {
            errors.push({ field: `${fieldPrefix}.monorepo`, message: "Must be an object" });
          } else {
            const mono = r.monorepo as Record<string, unknown>;
            for (const key of Object.keys(mono)) {
              if (!VALID_MONOREPO_KEYS.has(key)) {
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

  if ("workspaces" in obj && obj.workspaces !== undefined) {
    if (!Array.isArray(obj.workspaces)) {
      errors.push({ field: "workspaces", message: "Must be an array" });
    } else {
      for (let i = 0; i < obj.workspaces.length; i++) {
        const workspace = obj.workspaces[i];
        const fieldPrefix = `workspaces[${i}]`;

        if (typeof workspace !== "object" || workspace === null) {
          errors.push({ field: fieldPrefix, message: "Must be an object" });
          continue;
        }

        const w = workspace as Record<string, unknown>;

        for (const key of Object.keys(w)) {
          if (!VALID_WORKSPACE_KEYS.has(key)) {
            errors.push({
              field: `${fieldPrefix}.${key}`,
              message: `Unknown field '${key}'`,
            });
          }
        }

        if (!("path" in w) || typeof w.path !== "string") {
          errors.push({
            field: `${fieldPrefix}.path`,
            message: "Required string field 'path' is missing",
          });
        }

        if ("depth" in w && w.depth !== undefined) {
          if (typeof w.depth !== "number" || !Number.isInteger(w.depth) || w.depth < 1 || w.depth > 3) {
            errors.push({
              field: `${fieldPrefix}.depth`,
              message: "Must be an integer between 1 and 3",
            });
          }
        }

        if ("exclude" in w && w.exclude !== undefined) {
          validateStringArray(w.exclude, `${fieldPrefix}.exclude`, errors);
        }

        if ("defaults" in w && w.defaults !== undefined) {
          if (typeof w.defaults !== "object" || w.defaults === null || Array.isArray(w.defaults)) {
            errors.push({ field: `${fieldPrefix}.defaults`, message: "Must be an object" });
          } else {
            const d = w.defaults as Record<string, unknown>;

            for (const key of Object.keys(d)) {
              if (!VALID_DEFAULT_KEYS.has(key)) {
                errors.push({ field: `${fieldPrefix}.defaults.${key}`, message: `Unknown field '${key}'` });
              }
            }

            if ("worktreeDir" in d && typeof d.worktreeDir !== "string") {
              errors.push({ field: `${fieldPrefix}.defaults.worktreeDir`, message: "Must be a string" });
            }

            if ("autoUpstream" in d && typeof d.autoUpstream !== "boolean") {
              errors.push({ field: `${fieldPrefix}.defaults.autoUpstream`, message: "Must be a boolean" });
            }

            for (const arrayKey of [
              "copyFiles",
              "linkFiles",
              "postCreate",
              "postRemove",
            ] as const) {
              if (arrayKey in d) {
                validateStringArray(d[arrayKey], `${fieldPrefix}.defaults.${arrayKey}`, errors);
              }
            }

            if ("sharedDeps" in d && d.sharedDeps !== undefined) {
              if (typeof d.sharedDeps !== "object" || d.sharedDeps === null) {
                errors.push({ field: `${fieldPrefix}.defaults.sharedDeps`, message: "Must be an object" });
              } else {
                validateSharedDeps(d.sharedDeps as Record<string, unknown>, `${fieldPrefix}.defaults.sharedDeps`, errors);
              }
            }
          }
        }
      }
    }
  }

  if ("templates" in obj && obj.templates !== undefined) {
    if (typeof obj.templates !== "object" || obj.templates === null || Array.isArray(obj.templates)) {
      errors.push({ field: "templates", message: "Must be an object (key-value map)" });
    } else {
      const templates = obj.templates as Record<string, unknown>;

      for (const [name, tmpl] of Object.entries(templates)) {
        const prefix = `templates.${name}`;
        if (typeof tmpl !== "object" || tmpl === null) {
          errors.push({ field: prefix, message: "Must be an object" });
          continue;
        }
        const t = tmpl as Record<string, unknown>;
        for (const key of Object.keys(t)) {
          if (!VALID_TEMPLATE_KEYS.has(key)) {
            errors.push({ field: `${prefix}.${key}`, message: `Unknown field '${key}'` });
          }
        }
        if ("worktreeDir" in t && typeof t.worktreeDir !== "string") {
          errors.push({ field: `${prefix}.worktreeDir`, message: "Must be a string" });
        }
        if ("base" in t && typeof t.base !== "string") {
          errors.push({ field: `${prefix}.base`, message: "Must be a string" });
        }
        if ("autoUpstream" in t && typeof t.autoUpstream !== "boolean") {
          errors.push({ field: `${prefix}.autoUpstream`, message: "Must be a boolean" });
        }
        for (const arrayKey of ["copyFiles", "linkFiles", "postCreate", "postRemove"] as const) {
          if (arrayKey in t) {
            validateStringArray(t[arrayKey], `${prefix}.${arrayKey}`, errors);
          }
        }
      }
    }
  }

  if ("lifecycle" in obj && obj.lifecycle !== undefined) {
    if (typeof obj.lifecycle !== "object" || obj.lifecycle === null) {
      errors.push({ field: "lifecycle", message: "Must be an object" });
    } else {
      const lc = obj.lifecycle as Record<string, unknown>;
      for (const key of Object.keys(lc)) {
        if (!VALID_LIFECYCLE_KEYS.has(key)) {
          errors.push({ field: `lifecycle.${key}`, message: `Unknown field '${key}'` });
        }
      }
      if ("autoCleanMerged" in lc && typeof lc.autoCleanMerged !== "boolean") {
        errors.push({ field: "lifecycle.autoCleanMerged", message: "Must be a boolean" });
      }
      if ("staleAfterDays" in lc && (typeof lc.staleAfterDays !== "number" || lc.staleAfterDays < 1)) {
        errors.push({ field: "lifecycle.staleAfterDays", message: "Must be a positive number" });
      }
      if ("maxWorktrees" in lc && (typeof lc.maxWorktrees !== "number" || lc.maxWorktrees < 1)) {
        errors.push({ field: "lifecycle.maxWorktrees", message: "Must be a positive number" });
      }
    }
  }

  if ("sessions" in obj && obj.sessions !== undefined) {
    if (typeof obj.sessions !== "object" || obj.sessions === null) {
      errors.push({ field: "sessions", message: "Must be an object" });
    } else {
      const sess = obj.sessions as Record<string, unknown>;
      for (const key of Object.keys(sess)) {
        if (!VALID_SESSION_KEYS.has(key)) {
          errors.push({ field: `sessions.${key}`, message: `Unknown field '${key}'` });
        }
      }
      for (const boolKey of ["enabled", "autoCreate", "autoKill"] as const) {
        if (boolKey in sess && typeof sess[boolKey] !== "boolean") {
          errors.push({ field: `sessions.${boolKey}`, message: "Must be a boolean" });
        }
      }
      if ("prefix" in sess && typeof sess.prefix !== "string") {
        errors.push({ field: "sessions.prefix", message: "Must be a string" });
      }
      if ("defaultLayout" in sess && typeof sess.defaultLayout !== "string") {
        errors.push({ field: "sessions.defaultLayout", message: "Must be a string" });
      }
      if ("layouts" in sess && sess.layouts !== undefined) {
        if (typeof sess.layouts !== "object" || sess.layouts === null || Array.isArray(sess.layouts)) {
          errors.push({ field: "sessions.layouts", message: "Must be an object (key-value map)" });
        } else {
          const layouts = sess.layouts as Record<string, unknown>;
          for (const [name, layout] of Object.entries(layouts)) {
            const prefix = `sessions.layouts.${name}`;
            if (typeof layout !== "object" || layout === null) {
              errors.push({ field: prefix, message: "Must be an object" });
              continue;
            }
            const l = layout as Record<string, unknown>;
            if (!("windows" in l) || !Array.isArray(l.windows)) {
              errors.push({ field: `${prefix}.windows`, message: "Required array field" });
            } else {
              for (let j = 0; j < l.windows.length; j++) {
                const win = l.windows[j] as Record<string, unknown>;
                if (typeof win !== "object" || win === null) {
                  errors.push({ field: `${prefix}.windows[${j}]`, message: "Must be an object" });
                  continue;
                }
                if (!("name" in win) || typeof win.name !== "string") {
                  errors.push({ field: `${prefix}.windows[${j}].name`, message: "Required string field" });
                }
                if ("command" in win && typeof win.command !== "string") {
                  errors.push({ field: `${prefix}.windows[${j}].command`, message: "Must be a string" });
                }
              }
            }
          }
        }
      }
      if ("defaultLayout" in sess && typeof sess.defaultLayout === "string" && "layouts" in sess && typeof sess.layouts === "object" && sess.layouts !== null) {
        const layouts = sess.layouts as Record<string, unknown>;
        if (!(sess.defaultLayout as string in layouts)) {
          errors.push({ field: "sessions.defaultLayout", message: `Layout '${sess.defaultLayout}' does not exist in sessions.layouts` });
        }
      }
    }
  }

  if ("profiles" in obj && obj.profiles !== undefined) {
    if (typeof obj.profiles !== "object" || obj.profiles === null || Array.isArray(obj.profiles)) {
      errors.push({ field: "profiles", message: "Must be an object (key-value map)" });
    } else {
      const profiles = obj.profiles as Record<string, unknown>;

      for (const [name, profile] of Object.entries(profiles)) {
        const prefix = `profiles.${name}`;
        if (typeof profile !== "object" || profile === null) {
          errors.push({ field: prefix, message: "Must be an object" });
          continue;
        }
        const p = profile as Record<string, unknown>;
        for (const key of Object.keys(p)) {
          if (!VALID_PROFILE_KEYS.has(key)) {
            errors.push({ field: `${prefix}.${key}`, message: `Unknown field '${key}'` });
          }
        }
      }
    }
  }

  if ("activeProfile" in obj && obj.activeProfile !== undefined) {
    if (typeof obj.activeProfile !== "string") {
      errors.push({ field: "activeProfile", message: "Must be a string" });
    } else if ("profiles" in obj && obj.profiles !== undefined && typeof obj.profiles === "object" && obj.profiles !== null && !Array.isArray(obj.profiles)) {
      const profiles = obj.profiles as Record<string, unknown>;
      if (!(obj.activeProfile as string in profiles)) {
        errors.push({ field: "activeProfile", message: `Profile '${obj.activeProfile}' does not exist in profiles` });
      }
    } else if (!("profiles" in obj) || obj.profiles === undefined) {
      errors.push({ field: "activeProfile", message: "Cannot set activeProfile without profiles" });
    }
  }

  return errors;
}

function validateSharedDeps(obj: Record<string, unknown>, prefix: string, errors: ValidationError[]): void {
  const validKeys = new Set(["strategy", "paths", "invalidateOn"]);
  for (const key of Object.keys(obj)) {
    if (!validKeys.has(key)) {
      errors.push({ field: `${prefix}.${key}`, message: `Unknown field '${key}'` });
    }
  }
  if ("strategy" in obj && !["hardlink", "symlink", "copy"].includes(obj.strategy as string)) {
    errors.push({ field: `${prefix}.strategy`, message: 'Must be "hardlink", "symlink", or "copy"' });
  }
  if ("paths" in obj) {
    validateStringArray(obj.paths, `${prefix}.paths`, errors);
  }
  if ("invalidateOn" in obj) {
    validateStringArray(obj.invalidateOn, `${prefix}.invalidateOn`, errors);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }

  if (isRecord(value)) {
    const cloned: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      cloned[key] = cloneValue(nested);
    }
    return cloned as T;
  }

  return value;
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) {
    return cloneValue(base);
  }

  if (Array.isArray(override)) {
    return override.map((item) => cloneValue(item));
  }

  if (!isRecord(override)) {
    return cloneValue(override);
  }

  const baseRecord = isRecord(base) ? base : {};
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(baseRecord)) {
    result[key] = cloneValue(value);
  }

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue;
    }

    const baseValue = baseRecord[key];
    if (isRecord(baseValue) && isRecord(value)) {
      result[key] = deepMerge(baseValue, value);
      continue;
    }

    result[key] = cloneValue(value);
  }

  return result;
}

function applyActiveProfile(config: OmlConfig): OmlConfig {
  if (!config.activeProfile) {
    return structuredClone(config);
  }

  const profile = config.profiles?.[config.activeProfile];
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    throw new Error(`Active profile '${config.activeProfile}' does not exist`);
  }

  return deepMerge(config, profile) as OmlConfig;
}

function loadConfigCore(overridePath?: string): OmlConfig {
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

  const resolved = applyActiveProfile(parsed as OmlConfig);
  const resolvedErrors = validateConfig(resolved);
  if (resolvedErrors.length > 0) {
    const message = resolvedErrors.map((e) => `${e.field}: ${e.message}`).join("; ");
    throw new Error(`Config validation failed after applying activeProfile: ${message}`);
  }

  return resolved;
}

export function loadConfig(overridePath?: string): OmlConfig {
  return expandWorkspaces(loadConfigCore(overridePath));
}

export function loadRawConfig(overridePath?: string): OmlConfig {
  return loadConfigCore(overridePath);
}

export function getRepoConfig(config: OmlConfig, repoPath: string): ResolvedRepoConfig {
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
    sharedDeps: repoOverride?.sharedDeps ?? config.defaults?.sharedDeps,
  };
}

export function getConfiguredRepoPaths(config: OmlConfig): string[] {
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

export interface EnsureConfigResult {
  path: string;
  created: boolean;
}

export function ensureConfigInitialized(overridePath?: string): EnsureConfigResult {
  const path = overridePath ?? getConfigPath();
  const existed = fs.existsSync(path);
  const finalPath = initConfig(overridePath);
  return { path: finalPath, created: !existed };
}

export function resolveTemplate(
  config: OmlConfig,
  templateName: string,
): TemplateConfig | undefined {
  return config.templates?.[templateName];
}

export function mergeTemplateWithRepo(
  repoConfig: ResolvedRepoConfig,
  template: TemplateConfig,
): ResolvedRepoConfig {
  return {
    worktreeDir: template.worktreeDir ?? repoConfig.worktreeDir,
    copyFiles: template.copyFiles ?? repoConfig.copyFiles,
    linkFiles: template.linkFiles ?? repoConfig.linkFiles,
    postCreate: template.postCreate ?? repoConfig.postCreate,
    postRemove: template.postRemove ?? repoConfig.postRemove,
    autoUpstream: template.autoUpstream ?? repoConfig.autoUpstream,
    monorepo: repoConfig.monorepo,
    sharedDeps: repoConfig.sharedDeps,
  };
}

export function getTemplateNames(config: OmlConfig): string[] {
  return Object.keys(config.templates ?? {});
}

export function getSessionConfig(config: OmlConfig): SessionConfig {
  return config.sessions ?? {};
}

export function resolveSessionLayout(config: OmlConfig, layoutName?: string): SessionLayoutConfig | undefined {
  const sessions = config.sessions;
  if (!sessions?.layouts) return undefined;
  const name = layoutName ?? sessions.defaultLayout;
  if (!name) return undefined;
  return sessions.layouts[name];
}

export function setNestedValue(
  obj: Record<string, unknown>,
  path: ReadonlyArray<string | number>,
  value: unknown,
): void {
  if (path.length === 0) return;

  let curr: Record<string | number, unknown> = obj as Record<string | number, unknown>;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    const nextKey = path[i + 1]!;
    const existing = curr[key];
    if (existing === undefined || existing === null) {
      curr[key] = typeof nextKey === "number" ? [] : {};
    }
    curr = curr[key] as Record<string | number, unknown>;
  }

  const lastKey = path[path.length - 1]!;
  if (value === undefined) {
    if (Array.isArray(curr) && typeof lastKey === "number") {
      (curr as unknown as unknown[]).splice(lastKey, 1);
    } else {
      delete curr[lastKey];
    }
    return;
  }
  curr[lastKey] = value;
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
