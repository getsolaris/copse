import { createSignal, createMemo, createEffect, on, onCleanup, For, Show } from "solid-js";
import { useApp } from "../context/AppContext.tsx";
import {
  loadRawConfig,
  getConfigPath,
  initConfig,
  writeAtomically,
  setNestedValue,
  validateConfig,
  type OmlConfig,
  type MonorepoHookConfig,
} from "../../core/config.ts";
import { useKeyboard, useTerminalDimensions, usePaste } from "@opentui/solid";
import { decodePasteBytes } from "@opentui/core";
import { spawnSync } from "node:child_process";
import {
  theme,
  setCurrentThemeName,
  THEME_NAMES,
  THEME_LABELS,
  type ThemeName,
} from "../themes.ts";

type EditKind = "string" | "strArray" | "boolean" | "theme" | "enum" | null;

type RowKind = "section" | "field" | "spacer";

interface Row {
  key: string;
  kind: RowKind;
  label: string;
  value?: string;
  rawValue?: unknown;
  path?: (string | number)[];
  editKind?: EditKind;
  depth: number;
  suggestions?: string[];
}

const INDENT_SIZE = 2;
const LABEL_WIDTH = 30;

const WORKTREE_DIR_PRESETS = [
  "~/.copse/worktrees/{repo}-{branch}",
  "~/.copse/worktree/{repo}-{branch}",
  "../{repo}-{branch}",
  "~/code/worktrees/{repo}/{branch}",
];

const EMPTY_ARRAY_PRESET = "[]";

const COPY_FILES_PRESETS = [
  EMPTY_ARRAY_PRESET,
  '[".env"]',
  '[".env", ".env.local"]',
  '[".env", ".env.local", ".env.development"]',
];

const LINK_FILES_PRESETS = [
  EMPTY_ARRAY_PRESET,
  '["node_modules"]',
  '["node_modules", ".next"]',
  '["node_modules", ".cache"]',
];

const POST_CREATE_PRESETS = [
  EMPTY_ARRAY_PRESET,
  '["bun install"]',
  '["pnpm install"]',
  '["npm install"]',
  '["yarn"]',
  '["pnpm install", "pnpm build"]',
];

const POST_REMOVE_PRESETS = [EMPTY_ARRAY_PRESET, '["echo removed"]'];

const EXTRA_PATTERNS_PRESETS = [
  EMPTY_ARRAY_PRESET,
  '["apps/*"]',
  '["apps/*/*"]',
  '["packages/*"]',
  '["apps/*", "packages/*"]',
];

const HOOK_GLOB_PRESETS = ["apps/*", "apps/*/*", "packages/*", "apps/web", "apps/api"];

const HOOK_POST_CREATE_PRESETS = [
  EMPTY_ARRAY_PRESET,
  '["cd {packagePath} && pnpm install"]',
  '["cd {packagePath} && bun install"]',
  '["cd {packagePath} && npm install"]',
  '["cd {packagePath} && pnpm install && pnpm build"]',
];

const SESSIONS_PREFIX_PRESETS = ["copse", "wt"];

const SHARED_DEPS_STRATEGY_VALUES = ["hardlink", "symlink", "copy"];

const SHARED_DEPS_PATHS_PRESETS = [
  EMPTY_ARRAY_PRESET,
  '["node_modules"]',
  '["node_modules", ".next"]',
];

const SHARED_DEPS_INVALIDATE_PRESETS = [
  EMPTY_ARRAY_PRESET,
  '["package.json"]',
  '["package.json", "bun.lockb"]',
  '["package.json", "pnpm-lock.yaml"]',
];

function formatStrArray(arr: string[] | undefined | null): string {
  if (!arr) return "(inherits)";
  if (arr.length === 0) return "[]";
  return JSON.stringify(arr);
}

function isPlaceholderValue(value: string | undefined): boolean {
  if (!value) return false;
  return /^\(.+\)$/.test(value);
}

function inheritedOrArray(arr: string[] | undefined): string {
  if (arr === undefined) return "(inherits)";
  if (arr.length === 0) return "[]";
  return JSON.stringify(arr);
}

function inheritedOrBool(v: boolean | undefined): string {
  if (v === undefined) return "(inherits)";
  return v ? "true" : "false";
}

function buildRows(cfg: OmlConfig | null): Row[] {
  const rows: Row[] = [];
  if (!cfg) return rows;

  rows.push({
    key: "top.version",
    kind: "field",
    label: "version",
    value: String(cfg.version),
    rawValue: cfg.version,
    path: ["version"],
    editKind: null,
    depth: 0,
  });
  rows.push({
    key: "top.theme",
    kind: "field",
    label: "theme",
    value: cfg.theme ?? "(default: opencode)",
    rawValue: cfg.theme,
    path: ["theme"],
    editKind: "theme",
    depth: 0,
  });
  if (cfg.activeProfile !== undefined || (cfg.profiles && Object.keys(cfg.profiles).length > 0)) {
    rows.push({
      key: "top.activeProfile",
      kind: "field",
      label: "activeProfile",
      value: cfg.activeProfile ?? "(none)",
      rawValue: cfg.activeProfile,
      path: ["activeProfile"],
      editKind: null,
      depth: 0,
    });
  }

  rows.push({ key: "sp.top", kind: "spacer", label: "", depth: 0 });

  rows.push({ key: "sec.defaults", kind: "section", label: "Defaults", depth: 0 });
  const d = cfg.defaults ?? {};
  rows.push({
    key: "d.worktreeDir",
    kind: "field",
    label: "worktreeDir",
    value: d.worktreeDir ?? "(not set)",
    rawValue: d.worktreeDir,
    path: ["defaults", "worktreeDir"],
    editKind: "string",
    depth: 1,
    suggestions: WORKTREE_DIR_PRESETS,
  });
  rows.push({
    key: "d.copyFiles",
    kind: "field",
    label: "copyFiles",
    value: inheritedOrArray(d.copyFiles),
    rawValue: d.copyFiles,
    path: ["defaults", "copyFiles"],
    editKind: "strArray",
    depth: 1,
    suggestions: COPY_FILES_PRESETS,
  });
  rows.push({
    key: "d.linkFiles",
    kind: "field",
    label: "linkFiles",
    value: inheritedOrArray(d.linkFiles),
    rawValue: d.linkFiles,
    path: ["defaults", "linkFiles"],
    editKind: "strArray",
    depth: 1,
    suggestions: LINK_FILES_PRESETS,
  });
  rows.push({
    key: "d.postCreate",
    kind: "field",
    label: "postCreate",
    value: inheritedOrArray(d.postCreate),
    rawValue: d.postCreate,
    path: ["defaults", "postCreate"],
    editKind: "strArray",
    depth: 1,
    suggestions: POST_CREATE_PRESETS,
  });
  rows.push({
    key: "d.postRemove",
    kind: "field",
    label: "postRemove",
    value: inheritedOrArray(d.postRemove),
    rawValue: d.postRemove,
    path: ["defaults", "postRemove"],
    editKind: "strArray",
    depth: 1,
    suggestions: POST_REMOVE_PRESETS,
  });
  rows.push({
    key: "d.autoUpstream",
    kind: "field",
    label: "autoUpstream",
    value: inheritedOrBool(d.autoUpstream),
    rawValue: d.autoUpstream,
    path: ["defaults", "autoUpstream"],
    editKind: "boolean",
    depth: 1,
  });
  if (d.sharedDeps) {
    rows.push({ key: "d.sharedDeps.header", kind: "section", label: "sharedDeps", depth: 1 });
    rows.push({
      key: "d.sharedDeps.strategy",
      kind: "field",
      label: "strategy",
      value: d.sharedDeps.strategy ?? "(not set)",
      rawValue: d.sharedDeps.strategy,
      path: ["defaults", "sharedDeps", "strategy"],
      editKind: "enum",
      depth: 2,
      suggestions: SHARED_DEPS_STRATEGY_VALUES,
    });
    rows.push({
      key: "d.sharedDeps.paths",
      kind: "field",
      label: "paths",
      value: inheritedOrArray(d.sharedDeps.paths),
      rawValue: d.sharedDeps.paths,
      path: ["defaults", "sharedDeps", "paths"],
      editKind: "strArray",
      depth: 2,
      suggestions: SHARED_DEPS_PATHS_PRESETS,
    });
    rows.push({
      key: "d.sharedDeps.invalidateOn",
      kind: "field",
      label: "invalidateOn",
      value: inheritedOrArray(d.sharedDeps.invalidateOn),
      rawValue: d.sharedDeps.invalidateOn,
      path: ["defaults", "sharedDeps", "invalidateOn"],
      editKind: "strArray",
      depth: 2,
      suggestions: SHARED_DEPS_INVALIDATE_PRESETS,
    });
  }

  const workspaces = cfg.workspaces ?? [];
  if (workspaces.length > 0) {
    rows.push({ key: "sp.workspaces", kind: "spacer", label: "", depth: 0 });
    rows.push({
      key: "sec.workspaces",
      kind: "section",
      label: `Workspaces (${workspaces.length})`,
      depth: 0,
    });

    workspaces.forEach((ws, wi) => {
      const wsName = ws.path.split("/").pop() || ws.path;
      rows.push({ key: `w${wi}.header`, kind: "section", label: wsName, depth: 1 });
      rows.push({
        key: `w${wi}.path`,
        kind: "field",
        label: "path",
        value: ws.path,
        rawValue: ws.path,
        path: ["workspaces", wi, "path"],
        editKind: null,
        depth: 2,
      });
      rows.push({
        key: `w${wi}.depth`,
        kind: "field",
        label: "depth",
        value: ws.depth === undefined ? "(default: 1)" : String(ws.depth),
        rawValue: ws.depth,
        path: ["workspaces", wi, "depth"],
        editKind: null,
        depth: 2,
      });
      rows.push({
        key: `w${wi}.exclude`,
        kind: "field",
        label: "exclude",
        value: inheritedOrArray(ws.exclude),
        rawValue: ws.exclude,
        path: ["workspaces", wi, "exclude"],
        editKind: "strArray",
        depth: 2,
        suggestions: [
          EMPTY_ARRAY_PRESET,
          '["node_modules"]',
          '["node_modules", ".cache"]',
          '["node_modules", ".cache", "archived"]',
        ],
      });

      const wsDefaults = ws.defaults;
      if (wsDefaults) {
        rows.push({
          key: `w${wi}.defaults.header`,
          kind: "section",
          label: "defaults",
          depth: 2,
        });
        rows.push({
          key: `w${wi}.defaults.worktreeDir`,
          kind: "field",
          label: "worktreeDir",
          value: wsDefaults.worktreeDir ?? "(inherits)",
          rawValue: wsDefaults.worktreeDir,
          path: ["workspaces", wi, "defaults", "worktreeDir"],
          editKind: "string",
          depth: 3,
          suggestions: WORKTREE_DIR_PRESETS,
        });
        rows.push({
          key: `w${wi}.defaults.copyFiles`,
          kind: "field",
          label: "copyFiles",
          value: inheritedOrArray(wsDefaults.copyFiles),
          rawValue: wsDefaults.copyFiles,
          path: ["workspaces", wi, "defaults", "copyFiles"],
          editKind: "strArray",
          depth: 3,
          suggestions: COPY_FILES_PRESETS,
        });
        rows.push({
          key: `w${wi}.defaults.linkFiles`,
          kind: "field",
          label: "linkFiles",
          value: inheritedOrArray(wsDefaults.linkFiles),
          rawValue: wsDefaults.linkFiles,
          path: ["workspaces", wi, "defaults", "linkFiles"],
          editKind: "strArray",
          depth: 3,
          suggestions: LINK_FILES_PRESETS,
        });
        rows.push({
          key: `w${wi}.defaults.postCreate`,
          kind: "field",
          label: "postCreate",
          value: inheritedOrArray(wsDefaults.postCreate),
          rawValue: wsDefaults.postCreate,
          path: ["workspaces", wi, "defaults", "postCreate"],
          editKind: "strArray",
          depth: 3,
          suggestions: POST_CREATE_PRESETS,
        });
        rows.push({
          key: `w${wi}.defaults.postRemove`,
          kind: "field",
          label: "postRemove",
          value: inheritedOrArray(wsDefaults.postRemove),
          rawValue: wsDefaults.postRemove,
          path: ["workspaces", wi, "defaults", "postRemove"],
          editKind: "strArray",
          depth: 3,
          suggestions: POST_REMOVE_PRESETS,
        });
        rows.push({
          key: `w${wi}.defaults.autoUpstream`,
          kind: "field",
          label: "autoUpstream",
          value: inheritedOrBool(wsDefaults.autoUpstream),
          rawValue: wsDefaults.autoUpstream,
          path: ["workspaces", wi, "defaults", "autoUpstream"],
          editKind: "boolean",
          depth: 3,
        });
      }

      if (wi < workspaces.length - 1) {
        rows.push({ key: `sp.w${wi}`, kind: "spacer", label: "", depth: 0 });
      }
    });
  }

  const repos = cfg.repos ?? [];
  rows.push({ key: "sp.repos", kind: "spacer", label: "", depth: 0 });
  rows.push({ key: "sec.repos", kind: "section", label: `Repos (${repos.length})`, depth: 0 });

  if (repos.length === 0) {
    rows.push({
      key: "repos.empty",
      kind: "field",
      label: "(none)",
      value: "add repos via 'e' to edit config file",
      rawValue: null,
      editKind: null,
      depth: 1,
    });
  }

  repos.forEach((repo, idx) => {
    const name = repo.path.split("/").pop() ?? repo.path;
    rows.push({ key: `r${idx}.header`, kind: "section", label: name, depth: 1 });
    rows.push({
      key: `r${idx}.path`,
      kind: "field",
      label: "path",
      value: repo.path,
      rawValue: repo.path,
      path: ["repos", idx, "path"],
      editKind: null,
      depth: 2,
    });
    rows.push({
      key: `r${idx}.worktreeDir`,
      kind: "field",
      label: "worktreeDir",
      value: repo.worktreeDir ?? "(inherits)",
      rawValue: repo.worktreeDir,
      path: ["repos", idx, "worktreeDir"],
      editKind: "string",
      depth: 2,
      suggestions: WORKTREE_DIR_PRESETS,
    });
    rows.push({
      key: `r${idx}.copyFiles`,
      kind: "field",
      label: "copyFiles",
      value: inheritedOrArray(repo.copyFiles),
      rawValue: repo.copyFiles,
      path: ["repos", idx, "copyFiles"],
      editKind: "strArray",
      depth: 2,
      suggestions: COPY_FILES_PRESETS,
    });
    rows.push({
      key: `r${idx}.linkFiles`,
      kind: "field",
      label: "linkFiles",
      value: inheritedOrArray(repo.linkFiles),
      rawValue: repo.linkFiles,
      path: ["repos", idx, "linkFiles"],
      editKind: "strArray",
      depth: 2,
      suggestions: LINK_FILES_PRESETS,
    });
    rows.push({
      key: `r${idx}.postCreate`,
      kind: "field",
      label: "postCreate",
      value: inheritedOrArray(repo.postCreate),
      rawValue: repo.postCreate,
      path: ["repos", idx, "postCreate"],
      editKind: "strArray",
      depth: 2,
      suggestions: POST_CREATE_PRESETS,
    });
    rows.push({
      key: `r${idx}.postRemove`,
      kind: "field",
      label: "postRemove",
      value: inheritedOrArray(repo.postRemove),
      rawValue: repo.postRemove,
      path: ["repos", idx, "postRemove"],
      editKind: "strArray",
      depth: 2,
      suggestions: POST_REMOVE_PRESETS,
    });
    rows.push({
      key: `r${idx}.autoUpstream`,
      kind: "field",
      label: "autoUpstream",
      value: inheritedOrBool(repo.autoUpstream),
      rawValue: repo.autoUpstream,
      path: ["repos", idx, "autoUpstream"],
      editKind: "boolean",
      depth: 2,
    });

    if (repo.monorepo) {
      rows.push({ key: `r${idx}.mr.header`, kind: "section", label: "monorepo", depth: 2 });
      rows.push({
        key: `r${idx}.mr.autoDetect`,
        kind: "field",
        label: "autoDetect",
        value: repo.monorepo.autoDetect === undefined ? "(not set)" : String(repo.monorepo.autoDetect),
        rawValue: repo.monorepo.autoDetect,
        path: ["repos", idx, "monorepo", "autoDetect"],
        editKind: "boolean",
        depth: 3,
      });
      rows.push({
        key: `r${idx}.mr.extraPatterns`,
        kind: "field",
        label: "extraPatterns",
        value: formatStrArray(repo.monorepo.extraPatterns),
        rawValue: repo.monorepo.extraPatterns,
        path: ["repos", idx, "monorepo", "extraPatterns"],
        editKind: "strArray",
        depth: 3,
        suggestions: EXTRA_PATTERNS_PRESETS,
      });

      const hooks: MonorepoHookConfig[] = repo.monorepo.hooks ?? [];
      rows.push({
        key: `r${idx}.mr.hooks.header`,
        kind: "section",
        label: `hooks (${hooks.length})`,
        depth: 3,
      });
      hooks.forEach((hook, hi) => {
        rows.push({
          key: `r${idx}.h${hi}.header`,
          kind: "section",
          label: `[${hi}] ${hook.glob}`,
          depth: 4,
        });
        rows.push({
          key: `r${idx}.h${hi}.glob`,
          kind: "field",
          label: "glob",
          value: hook.glob,
          rawValue: hook.glob,
          path: ["repos", idx, "monorepo", "hooks", hi, "glob"],
          editKind: "string",
          depth: 5,
          suggestions: HOOK_GLOB_PRESETS,
        });
        rows.push({
          key: `r${idx}.h${hi}.copyFiles`,
          kind: "field",
          label: "copyFiles",
          value: formatStrArray(hook.copyFiles),
          rawValue: hook.copyFiles,
          path: ["repos", idx, "monorepo", "hooks", hi, "copyFiles"],
          editKind: "strArray",
          depth: 5,
          suggestions: COPY_FILES_PRESETS,
        });
        rows.push({
          key: `r${idx}.h${hi}.linkFiles`,
          kind: "field",
          label: "linkFiles",
          value: formatStrArray(hook.linkFiles),
          rawValue: hook.linkFiles,
          path: ["repos", idx, "monorepo", "hooks", hi, "linkFiles"],
          editKind: "strArray",
          depth: 5,
          suggestions: LINK_FILES_PRESETS,
        });
        rows.push({
          key: `r${idx}.h${hi}.postCreate`,
          kind: "field",
          label: "postCreate",
          value: formatStrArray(hook.postCreate),
          rawValue: hook.postCreate,
          path: ["repos", idx, "monorepo", "hooks", hi, "postCreate"],
          editKind: "strArray",
          depth: 5,
          suggestions: HOOK_POST_CREATE_PRESETS,
        });
        rows.push({
          key: `r${idx}.h${hi}.postRemove`,
          kind: "field",
          label: "postRemove",
          value: formatStrArray(hook.postRemove),
          rawValue: hook.postRemove,
          path: ["repos", idx, "monorepo", "hooks", hi, "postRemove"],
          editKind: "strArray",
          depth: 5,
          suggestions: POST_REMOVE_PRESETS,
        });
      });
    }

    if (idx < repos.length - 1) {
      rows.push({ key: `sp.r${idx}`, kind: "spacer", label: "", depth: 0 });
    }
  });

  if (cfg.templates && Object.keys(cfg.templates).length > 0) {
    rows.push({ key: "sp.templates", kind: "spacer", label: "", depth: 0 });
    rows.push({
      key: "sec.templates",
      kind: "section",
      label: `Templates (${Object.keys(cfg.templates).length})`,
      depth: 0,
    });
    for (const [tname, tmpl] of Object.entries(cfg.templates)) {
      rows.push({ key: `t.${tname}.header`, kind: "section", label: tname, depth: 1 });
      if (tmpl.base !== undefined) {
        rows.push({
          key: `t.${tname}.base`,
          kind: "field",
          label: "base",
          value: tmpl.base,
          rawValue: tmpl.base,
          path: ["templates", tname, "base"],
          editKind: "string",
          depth: 2,
        });
      }
      if (tmpl.worktreeDir !== undefined) {
        rows.push({
          key: `t.${tname}.worktreeDir`,
          kind: "field",
          label: "worktreeDir",
          value: tmpl.worktreeDir,
          rawValue: tmpl.worktreeDir,
          path: ["templates", tname, "worktreeDir"],
          editKind: "string",
          depth: 2,
        });
      }
      if (tmpl.copyFiles !== undefined) {
        rows.push({
          key: `t.${tname}.copyFiles`,
          kind: "field",
          label: "copyFiles",
          value: formatStrArray(tmpl.copyFiles),
          rawValue: tmpl.copyFiles,
          path: ["templates", tname, "copyFiles"],
          editKind: "strArray",
          depth: 2,
        });
      }
      if (tmpl.linkFiles !== undefined) {
        rows.push({
          key: `t.${tname}.linkFiles`,
          kind: "field",
          label: "linkFiles",
          value: formatStrArray(tmpl.linkFiles),
          rawValue: tmpl.linkFiles,
          path: ["templates", tname, "linkFiles"],
          editKind: "strArray",
          depth: 2,
        });
      }
      if (tmpl.postCreate !== undefined) {
        rows.push({
          key: `t.${tname}.postCreate`,
          kind: "field",
          label: "postCreate",
          value: formatStrArray(tmpl.postCreate),
          rawValue: tmpl.postCreate,
          path: ["templates", tname, "postCreate"],
          editKind: "strArray",
          depth: 2,
        });
      }
      if (tmpl.postRemove !== undefined) {
        rows.push({
          key: `t.${tname}.postRemove`,
          kind: "field",
          label: "postRemove",
          value: formatStrArray(tmpl.postRemove),
          rawValue: tmpl.postRemove,
          path: ["templates", tname, "postRemove"],
          editKind: "strArray",
          depth: 2,
        });
      }
      if (tmpl.autoUpstream !== undefined) {
        rows.push({
          key: `t.${tname}.autoUpstream`,
          kind: "field",
          label: "autoUpstream",
          value: String(tmpl.autoUpstream),
          rawValue: tmpl.autoUpstream,
          path: ["templates", tname, "autoUpstream"],
          editKind: "boolean",
          depth: 2,
        });
      }
    }
  }

  if (cfg.lifecycle) {
    rows.push({ key: "sp.lifecycle", kind: "spacer", label: "", depth: 0 });
    rows.push({ key: "sec.lifecycle", kind: "section", label: "Lifecycle", depth: 0 });
    if (cfg.lifecycle.autoCleanMerged !== undefined) {
      rows.push({
        key: "lc.autoCleanMerged",
        kind: "field",
        label: "autoCleanMerged",
        value: String(cfg.lifecycle.autoCleanMerged),
        rawValue: cfg.lifecycle.autoCleanMerged,
        path: ["lifecycle", "autoCleanMerged"],
        editKind: "boolean",
        depth: 1,
      });
    }
    if (cfg.lifecycle.staleAfterDays !== undefined) {
      rows.push({
        key: "lc.staleAfterDays",
        kind: "field",
        label: "staleAfterDays",
        value: String(cfg.lifecycle.staleAfterDays),
        rawValue: cfg.lifecycle.staleAfterDays,
        path: ["lifecycle", "staleAfterDays"],
        editKind: null,
        depth: 1,
      });
    }
    if (cfg.lifecycle.maxWorktrees !== undefined) {
      rows.push({
        key: "lc.maxWorktrees",
        kind: "field",
        label: "maxWorktrees",
        value: String(cfg.lifecycle.maxWorktrees),
        rawValue: cfg.lifecycle.maxWorktrees,
        path: ["lifecycle", "maxWorktrees"],
        editKind: null,
        depth: 1,
      });
    }
  }

  if (cfg.sessions) {
    rows.push({ key: "sp.sessions", kind: "spacer", label: "", depth: 0 });
    rows.push({ key: "sec.sessions", kind: "section", label: "Sessions", depth: 0 });
    const s = cfg.sessions;
    if (s.enabled !== undefined) {
      rows.push({
        key: "s.enabled",
        kind: "field",
        label: "enabled",
        value: String(s.enabled),
        rawValue: s.enabled,
        path: ["sessions", "enabled"],
        editKind: "boolean",
        depth: 1,
      });
    }
    if (s.autoCreate !== undefined) {
      rows.push({
        key: "s.autoCreate",
        kind: "field",
        label: "autoCreate",
        value: String(s.autoCreate),
        rawValue: s.autoCreate,
        path: ["sessions", "autoCreate"],
        editKind: "boolean",
        depth: 1,
      });
    }
    if (s.autoKill !== undefined) {
      rows.push({
        key: "s.autoKill",
        kind: "field",
        label: "autoKill",
        value: String(s.autoKill),
        rawValue: s.autoKill,
        path: ["sessions", "autoKill"],
        editKind: "boolean",
        depth: 1,
      });
    }
    if (s.prefix !== undefined) {
      rows.push({
        key: "s.prefix",
        kind: "field",
        label: "prefix",
        value: s.prefix,
        rawValue: s.prefix,
        path: ["sessions", "prefix"],
        editKind: "string",
        depth: 1,
        suggestions: SESSIONS_PREFIX_PRESETS,
      });
    }
    if (s.defaultLayout !== undefined) {
      rows.push({
        key: "s.defaultLayout",
        kind: "field",
        label: "defaultLayout",
        value: s.defaultLayout,
        rawValue: s.defaultLayout,
        path: ["sessions", "defaultLayout"],
        editKind: "string",
        depth: 1,
      });
    }
    if (s.layouts && Object.keys(s.layouts).length > 0) {
      rows.push({
        key: "s.layouts.header",
        kind: "section",
        label: `layouts (${Object.keys(s.layouts).length})`,
        depth: 1,
      });
      for (const [lname, layout] of Object.entries(s.layouts)) {
        rows.push({
          key: `s.layouts.${lname}`,
          kind: "field",
          label: lname,
          value: `${layout.windows?.length ?? 0} window(s)`,
          rawValue: layout,
          path: ["sessions", "layouts", lname],
          editKind: null,
          depth: 2,
        });
      }
    }
  }

  if (cfg.profiles && Object.keys(cfg.profiles).length > 0) {
    rows.push({ key: "sp.profiles", kind: "spacer", label: "", depth: 0 });
    rows.push({
      key: "sec.profiles",
      kind: "section",
      label: `Profiles (${Object.keys(cfg.profiles).length})`,
      depth: 0,
    });
    for (const pname of Object.keys(cfg.profiles)) {
      const isActive = cfg.activeProfile === pname;
      rows.push({
        key: `p.${pname}`,
        kind: "field",
        label: pname,
        value: isActive ? "active" : "",
        rawValue: pname,
        path: ["profiles", pname],
        editKind: null,
        depth: 1,
      });
    }
  }

  return rows;
}

export function ConfigView() {
  const app = useApp();
  const dims = useTerminalDimensions();
  const configPath = getConfigPath();

  const loadSafe = (): { cfg: OmlConfig | null; error: string } => {
    try {
      return { cfg: loadRawConfig(), error: "" };
    } catch (err) {
      return { cfg: null, error: (err as Error).message };
    }
  };

  const initial = loadSafe();
  const [cfg, setCfg] = createSignal<OmlConfig | null>(initial.cfg);
  const [loadError, setLoadError] = createSignal(initial.error);
  const [message, setMessage] = createSignal("");
  const [messageType, setMessageType] = createSignal<"info" | "success" | "error">("info");
  const [selectedFieldIdx, setSelectedFieldIdx] = createSignal(0);
  const [scrollOffset, setScrollOffset] = createSignal(0);

  const [editing, setEditing] = createSignal(false);
  const [editKind, setEditKind] = createSignal<EditKind>(null);
  const [editPath, setEditPath] = createSignal<(string | number)[] | null>(null);
  const [editText, setEditText] = createSignal("");
  const [editBool, setEditBool] = createSignal(false);
  const [editThemeIdx, setEditThemeIdx] = createSignal(0);
  const [editSuggestions, setEditSuggestions] = createSignal<string[]>([]);
  const [editSuggestionIdx, setEditSuggestionIdx] = createSignal(-1);
  const [editEnumIdx, setEditEnumIdx] = createSignal(0);

  const rows = createMemo(() => buildRows(cfg()));

  const editableRowIndices = createMemo(() => {
    const result: number[] = [];
    const all = rows();
    for (let i = 0; i < all.length; i++) {
      const row = all[i]!;
      if (row.kind === "field" && row.editKind !== null) {
        result.push(i);
      }
    }
    return result;
  });

  const selectedRowIdx = () => {
    const idxs = editableRowIndices();
    if (idxs.length === 0) return -1;
    const clamped = Math.max(0, Math.min(selectedFieldIdx(), idxs.length - 1));
    return idxs[clamped] ?? -1;
  };

  const selectedRow = () => {
    const idx = selectedRowIdx();
    if (idx < 0) return null;
    return rows()[idx] ?? null;
  };

  const flash = (msg: string, type: "info" | "success" | "error" = "info") => {
    setMessage(msg);
    setMessageType(type);
  };

  const reload = () => {
    const result = loadSafe();
    setCfg(result.cfg);
    setLoadError(result.error);
  };

  const startEdit = () => {
    const row = selectedRow();
    if (!row || !row.editKind || !row.path) {
      flash("Field is read-only (press 'e' to edit the file directly)", "info");
      return;
    }

    const presets = row.suggestions ?? [];
    setEditKind(row.editKind);
    setEditPath(row.path);
    setEditSuggestions(presets);
    app.setInputFocused(true);

    if (row.editKind === "string") {
      const current = typeof row.rawValue === "string" ? row.rawValue : "";
      setEditText(current);
      setEditSuggestionIdx(presets.indexOf(current));
    } else if (row.editKind === "strArray") {
      const arr = Array.isArray(row.rawValue) ? row.rawValue : [];
      const text = JSON.stringify(arr);
      setEditText(text);
      setEditSuggestionIdx(presets.indexOf(text));
    } else if (row.editKind === "boolean") {
      setEditBool(row.rawValue === true);
      setEditSuggestionIdx(-1);
    } else if (row.editKind === "theme") {
      const current = typeof row.rawValue === "string" ? row.rawValue : "opencode";
      const idx = THEME_NAMES.indexOf(current as ThemeName);
      setEditThemeIdx(idx >= 0 ? idx : 0);
      setEditSuggestionIdx(-1);
    } else if (row.editKind === "enum") {
      const values = row.suggestions ?? [];
      const current = typeof row.rawValue === "string" ? row.rawValue : "";
      const idx = values.indexOf(current);
      setEditEnumIdx(idx >= 0 ? idx : 0);
      setEditSuggestionIdx(-1);
    }

    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditPath(null);
    setEditKind(null);
    setEditText("");
    setEditSuggestions([]);
    setEditSuggestionIdx(-1);
    app.setInputFocused(false);
  };

  const cycleSuggestion = (direction: 1 | -1) => {
    const list = editSuggestions();
    if (list.length === 0) return;
    const next = (editSuggestionIdx() + direction + list.length) % list.length;
    setEditSuggestionIdx(next);
    const value = list[next] ?? "";
    const kind = editKind();
    if (kind === "string" || kind === "strArray") {
      setEditText(value);
    }
  };

  const commitEdit = () => {
    const path = editPath();
    const kind = editKind();
    if (!path || !kind) {
      cancelEdit();
      return;
    }

    let value: unknown;
    if (kind === "string") {
      const text = editText();
      value = text.length === 0 ? undefined : text;
    } else if (kind === "strArray") {
      const text = editText().trim();
      if (text.length === 0) {
        value = [];
      } else {
        try {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== "string")) {
            throw new Error("expected a JSON array of strings");
          }
          value = parsed;
        } catch (err) {
          flash(`Invalid JSON: ${(err as Error).message}`, "error");
          return;
        }
      }
    } else if (kind === "boolean") {
      value = editBool();
    } else if (kind === "theme") {
      value = THEME_NAMES[editThemeIdx()];
    } else if (kind === "enum") {
      value = editSuggestions()[editEnumIdx()];
    }

    try {
      initConfig();
      const current = loadRawConfig();
      setNestedValue(current as unknown as Record<string, unknown>, path, value);

      const errors = validateConfig(current);
      if (errors.length > 0) {
        const first = errors[0]!;
        flash(`Validation: ${first.field}: ${first.message}`, "error");
        return;
      }

      writeAtomically(configPath, `${JSON.stringify(current, null, 2)}\n`);

      if (kind === "theme" && typeof value === "string" && THEME_NAMES.includes(value as ThemeName)) {
        setCurrentThemeName(value as ThemeName);
      }

      reload();
      flash("Saved", "success");
      setEditing(false);
      setEditPath(null);
      setEditKind(null);
      setEditText("");
      setEditSuggestions([]);
      setEditSuggestionIdx(-1);
      app.setInputFocused(false);
    } catch (err) {
      flash(`Save failed: ${(err as Error).message}`, "error");
    }
  };

  useKeyboard((event: any) => {
    if (app.activeTab() !== "config") return;
    if (app.showCommandPalette()) return;
    const key = event.name;

    if (editing()) {
      if (key === "escape") {
        cancelEdit();
        return;
      }
      const kind = editKind();
      if (kind === "string" || kind === "strArray") {
        if (key === "tab") {
          cycleSuggestion(event.shift ? -1 : 1);
          return;
        }
        if (key === "return" || key === "enter") {
          commitEdit();
        }
        return;
      }
      if (kind === "boolean") {
        if (
          key === "space" ||
          key === "tab" ||
          key === "left" ||
          key === "right" ||
          key === "h" ||
          key === "l"
        ) {
          setEditBool((v) => !v);
          return;
        }
        if (key === "return" || key === "enter") {
          commitEdit();
        }
        return;
      }
      if (kind === "theme") {
        if (key === "left" || key === "up" || key === "h" || key === "k" || (key === "tab" && event.shift)) {
          setEditThemeIdx((i) => (i - 1 + THEME_NAMES.length) % THEME_NAMES.length);
          return;
        }
        if (key === "right" || key === "down" || key === "l" || key === "j" || key === "tab") {
          setEditThemeIdx((i) => (i + 1) % THEME_NAMES.length);
          return;
        }
        if (key === "return" || key === "enter") {
          commitEdit();
        }
        return;
      }
      if (kind === "enum") {
        const list = editSuggestions();
        if (list.length === 0) return;
        if (key === "left" || key === "up" || key === "h" || key === "k" || (key === "tab" && event.shift)) {
          setEditEnumIdx((i) => (i - 1 + list.length) % list.length);
          return;
        }
        if (key === "right" || key === "down" || key === "l" || key === "j" || key === "tab") {
          setEditEnumIdx((i) => (i + 1) % list.length);
          return;
        }
        if (key === "return" || key === "enter") {
          commitEdit();
        }
        return;
      }
      return;
    }

    if (app.inputFocused()) return;

    if (key === "j" || key === "down") {
      setSelectedFieldIdx((i) => Math.min(i + 1, editableRowIndices().length - 1));
      return;
    }
    if (key === "k" || key === "up") {
      setSelectedFieldIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (key === "g") {
      setSelectedFieldIdx(0);
      return;
    }
    if (key === "G") {
      setSelectedFieldIdx(Math.max(editableRowIndices().length - 1, 0));
      return;
    }
    if (key === "return" || key === "enter") {
      startEdit();
      return;
    }
    if (key === "e") {
      const editorBin = process.env.EDITOR ?? process.env.VISUAL ?? "vi";
      initConfig();
      spawnSync(editorBin, [configPath], { stdio: "inherit" });
      reload();
      flash("Config reloaded", "info");
      return;
    }
    if (key === "r") {
      reload();
      flash("Reloaded", "info");
      return;
    }
    if (key === "i") {
      initConfig();
      reload();
      flash("Initialized", "info");
      return;
    }
  });

  usePaste((event) => {
    if (!editing()) return;
    const kind = editKind();
    if (kind !== "string" && kind !== "strArray") return;
    const text = decodePasteBytes(event.bytes).replace(/\r?\n/g, "");
    if (!text) return;
    setEditText((v) => v + text);
  });

  const contentH = () => Math.max(dims().height - 10, 5);

  createEffect(
    on([selectedFieldIdx, rows], () => {
      const currentRowIdx = selectedRowIdx();
      if (currentRowIdx < 0) return;
      const visible = contentH();
      if (currentRowIdx < scrollOffset()) {
        setScrollOffset(currentRowIdx);
      } else if (currentRowIdx >= scrollOffset() + visible) {
        setScrollOffset(currentRowIdx - visible + 1);
      }
    }),
  );

  onCleanup(() => {
    app.setInputFocused(false);
  });

  const visibleRows = createMemo(() => {
    const start = scrollOffset();
    return rows()
      .slice(start, start + contentH())
      .map((row, localIdx) => ({ row, globalIdx: start + localIdx }));
  });

  const totalEditable = () => editableRowIndices().length;
  const scrollIndicator = () => {
    const total = rows().length;
    if (total <= contentH()) return "";
    const end = Math.min(scrollOffset() + contentH(), total);
    return `${scrollOffset() + 1}-${end}/${total}`;
  };

  const w = () => dims().width;
  const inputFieldW = () => Math.max(w() - 4 - LABEL_WIDTH - 4, 20);

  return (
    <box x={0} y={0} width="100%" height="100%" backgroundColor={theme.bg.base} flexDirection="column">
      <box
        width="100%"
        height="100%"
        backgroundColor={theme.bg.surface}
        flexDirection="column"
        paddingX={2}
        paddingY={1}
      >
        <box height={1} flexDirection="row">
          <text fg={theme.text.accent}><b>Configuration</b></text>
          <Show when={!!scrollIndicator()}>
            <text fg={theme.text.secondary}> {` · ${scrollIndicator()}`}</text>
          </Show>
          <Show when={totalEditable() > 0}>
            <text fg={theme.text.secondary}> {` · ${selectedFieldIdx() + 1}/${totalEditable()}`}</text>
          </Show>
        </box>
        <box height={1} flexDirection="row" gap={1}>
          <text fg={theme.text.secondary}>Path:</text>
          <text fg={theme.text.primary}>{configPath}</text>
        </box>

        <Show when={!!loadError()}>
          <box height={1} flexDirection="row" gap={1}>
            <text fg={theme.text.error}>Load error:</text>
            <text fg={theme.text.primary}>{loadError()}</text>
          </box>
        </Show>

        <Show when={!cfg() && !loadError()}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.text.warning}>No config file found.</text>
            <box flexDirection="row" gap={1}>
              <text fg={theme.text.secondary}>Press</text>
              <text fg={theme.text.accent}>i</text>
              <text fg={theme.text.secondary}>to initialize with defaults.</text>
            </box>
          </box>
        </Show>

        <Show when={!!cfg()}>
          <box height={1}>
            <text fg={theme.border.subtle}>{"\u2500".repeat(Math.max(w() - 34, 10))}</text>
          </box>

          <box flexDirection="column" height={contentH()}>
            <For each={visibleRows()}>
              {(item) => {
                const row = item.row;
                const isSelected = () => item.globalIdx === selectedRowIdx();
                const isBeingEdited = () => editing() && isSelected();
                const indent = " ".repeat(row.depth * INDENT_SIZE);

                if (row.kind === "spacer") {
                  return <box height={1}><text fg={theme.text.secondary}> </text></box>;
                }

                if (row.kind === "section") {
                  return (
                    <box height={1} flexDirection="row">
                      <text fg={theme.text.accent}>
                        {indent}
                        {row.label}
                      </text>
                    </box>
                  );
                }

                const labelContent = () => {
                  const marker = isSelected() ? "\u25B8 " : "  ";
                  return `${indent}${marker}${row.label}`;
                };

                return (
                  <box
                    height={1}
                    flexDirection="row"
                    backgroundColor={isSelected() ? theme.select.focusedBg : undefined}
                  >
                    <box width={LABEL_WIDTH} height={1}>
                      <text
                        fg={
                          isSelected()
                            ? theme.text.accent
                            : theme.text.secondary
                        }
                      >
                        {labelContent()}
                      </text>
                    </box>
                    <Show
                      when={isBeingEdited()}
                      fallback={
                        <text
                          fg={
                            isPlaceholderValue(row.value)
                              ? theme.text.secondary
                              : theme.text.primary
                          }
                        >
                          {row.value ?? ""}
                        </text>
                      }
                    >
                      <Show when={editKind() === "string" || editKind() === "strArray"}>
                        <input
                          value={editText()}
                          onInput={(v: string) => setEditText(v)}
                          focused={true}
                          width={inputFieldW()}
                          backgroundColor={theme.bg.elevated}
                          cursorColor={theme.text.accent}
                          placeholder={editKind() === "strArray" ? '["a", "b"]' : ""}
                        />
                      </Show>
                      <Show when={editKind() === "boolean"}>
                        <text fg={editBool() ? theme.text.success : theme.text.secondary}>
                          {editBool() ? "[x] true" : "[ ] false"}
                        </text>
                      </Show>
                      <Show when={editKind() === "theme"}>
                        <text fg={theme.text.accent}>
                          {`\u25C2 ${THEME_LABELS[THEME_NAMES[editThemeIdx()] ?? "opencode"]} (${THEME_NAMES[editThemeIdx()] ?? "opencode"}) \u25B8`}
                        </text>
                      </Show>
                      <Show when={editKind() === "enum"}>
                        <text fg={theme.text.accent}>
                          {`\u25C2 ${editSuggestions()[editEnumIdx()] ?? ""} \u25B8`}
                        </text>
                      </Show>
                    </Show>
                  </box>
                );
              }}
            </For>
          </box>
        </Show>

        <Show when={!!message()}>
          <box height={1}>
            <text
              fg={
                messageType() === "error"
                  ? theme.text.error
                  : messageType() === "success"
                    ? theme.text.success
                    : theme.text.accent
              }
            >
              {message()}
            </text>
          </box>
        </Show>
      </box>

      <box width="100%" height={1} backgroundColor={theme.bg.base} flexDirection="row" gap={2}>
        <Show when={!editing()}>
          <box flexDirection="row"><text fg={theme.text.secondary}>j/k</text><text fg={theme.text.primary}>:nav</text></box>
          <box flexDirection="row"><text fg={theme.text.secondary}>g/G</text><text fg={theme.text.primary}>:top/bot</text></box>
          <box flexDirection="row"><text fg={theme.text.secondary}>Enter</text><text fg={theme.text.primary}>:edit</text></box>
          <box flexDirection="row"><text fg={theme.text.secondary}>e</text><text fg={theme.text.primary}>:$EDITOR</text></box>
          <box flexDirection="row"><text fg={theme.text.secondary}>r</text><text fg={theme.text.primary}>:reload</text></box>
          <box flexDirection="row"><text fg={theme.text.secondary}>i</text><text fg={theme.text.primary}>:init</text></box>
        </Show>
        <Show when={editing()}>
          <box flexDirection="row"><text fg={theme.text.secondary}>Enter</text><text fg={theme.text.primary}>:save</text></box>
          <box flexDirection="row"><text fg={theme.text.secondary}>Esc</text><text fg={theme.text.primary}>:cancel</text></box>
          <Show when={editKind() === "boolean"}>
            <box flexDirection="row"><text fg={theme.text.secondary}>Space/Tab</text><text fg={theme.text.primary}>:toggle</text></box>
          </Show>
          <Show when={editKind() === "theme"}>
            <box flexDirection="row"><text fg={theme.text.secondary}>Tab/←→</text><text fg={theme.text.primary}>:cycle</text></box>
          </Show>
          <Show when={editKind() === "enum"}>
            <box flexDirection="row"><text fg={theme.text.secondary}>Tab/←→</text><text fg={theme.text.primary}>:cycle</text></box>
          </Show>
          <Show when={editKind() === "strArray"}>
            <box flexDirection="row"><text fg={theme.text.secondary}>JSON</text><text fg={theme.text.primary}>:array</text></box>
          </Show>
          <Show when={(editKind() === "string" || editKind() === "strArray") && editSuggestions().length > 0}>
            <box flexDirection="row">
              <text fg={theme.text.secondary}>Tab</text>
              <text fg={theme.text.primary}>{`:preset (${editSuggestionIdx() + 1}/${editSuggestions().length})`}</text>
            </box>
          </Show>
          <Show when={editKind() === "enum"}>
            <box flexDirection="row">
              <text fg={theme.text.secondary}> </text>
              <text fg={theme.text.primary}>{`(${editEnumIdx() + 1}/${editSuggestions().length})`}</text>
            </box>
          </Show>
        </Show>
      </box>
    </box>
  );
}
