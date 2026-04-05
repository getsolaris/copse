import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type SkillPlatform = "claude-code" | "codex" | "opencode";

export const SUPPORTED_PLATFORMS: SkillPlatform[] = [
  "claude-code",
  "codex",
  "opencode",
];

export interface SkillWriteResult {
  filePath: string;
  referenceDir: string;
  referenceCount: number;
  platform: SkillPlatform;
  action: "created" | "updated";
}

export function getSkillDir(platform: SkillPlatform): string {
  const home = process.env.HOME || process.env.USERPROFILE || "~";
  switch (platform) {
    case "claude-code":
      return join(home, ".claude", "skills", "omw");
    case "codex":
      return join(home, ".agents", "skills", "omw");
    case "opencode":
      return join(home, ".config", "opencode", "skill", "omw");
  }
}

export function getSkillFilePath(platform: SkillPlatform): string {
  return join(getSkillDir(platform), "SKILL.md");
}

const SKILL_DESCRIPTION =
  "Git worktree manager. Use when working with git worktrees — creating, switching, removing, listing, or managing worktrees across repositories. Also use for monorepo focus, tmux sessions, and worktree health checks.";

interface CommandOverview {
  command: string;
  aliases: string;
  description: string;
}

interface OptionSpec {
  flag: string;
  type: string;
  alias: string;
  description: string;
}

interface ReferenceSpec {
  command: string;
  summary: string;
  synopsis: string;
  options: OptionSpec[];
  examples: [string, string][];
  notes: string[];
  configKeys: string[];
}

const commandOverview: CommandOverview[] = [
  { command: "add", aliases: "-", description: "Create a new worktree from a branch, template, or PR." },
  { command: "remove", aliases: "rm", description: "Remove a worktree by branch or path." },
  { command: "list", aliases: "ls", description: "List worktrees with branch, path, status, and focus." },
  { command: "switch", aliases: "sw", description: "Print shell cd command for a target worktree." },
  { command: "status", aliases: "st", description: "Show status summary for worktrees." },
  { command: "clean", aliases: "-", description: "Clean merged worktrees and optionally report stale ones." },
  { command: "doctor", aliases: "-", description: "Run worktree health checks and optional auto-fixes." },
  { command: "exec", aliases: "-", description: "Run commands across non-main worktrees." },
  { command: "diff", aliases: "-", description: "Compare two refs or worktree branches." },
  { command: "pin", aliases: "unpin", description: "Pin or unpin worktrees and inspect pin metadata." },
  { command: "log", aliases: "logs", description: "Read or clear the activity log." },
  { command: "archive", aliases: "-", description: "Archive worktree changes as patch files." },
  { command: "rename", aliases: "-", description: "Rename a worktree branch and optionally move its path." },
  { command: "clone", aliases: "-", description: "Clone a repository and initialize omw setup." },
  { command: "import", aliases: "-", description: "Import an existing worktree into omw metadata." },
  { command: "session", aliases: "ss", description: "Manage tmux sessions for worktrees." },
  { command: "config", aliases: "-", description: "Initialize, inspect, validate, and manage config profiles." },
  { command: "open", aliases: "-", description: "Open a worktree path in your preferred editor." },
  { command: "shell-init", aliases: "-", description: "Generate shell integration and completions." },
  { command: "init", aliases: "-", description: "Initialize config or install/update omw AI agent skill files." },
];

const referenceSpecs: ReferenceSpec[] = [
  {
    command: "add",
    summary: "Create a new worktree from a branch, template, or GitHub PR.",
    synopsis: "omw add [branch] [path]",
    options: [
      { flag: "--create", type: "boolean", alias: "-c", description: "Optional compatibility flag; missing branches are created automatically" },
      { flag: "--base", type: "string", alias: "-b", description: "Base branch/commit for new branch" },
      { flag: "--focus", type: "array", alias: "-f", description: "Focus packages for monorepo" },
      { flag: "--template", type: "string", alias: "-t", description: "Use a named template from config" },
      { flag: "--pr", type: "number", alias: "-", description: "Create worktree from a GitHub PR number" },
      { flag: "--session", type: "boolean", alias: "-s", description: "Create a tmux session for this worktree" },
      { flag: "--layout", type: "string", alias: "-", description: "Session layout name from config" },
    ],
    examples: [
      ["Create a feature branch worktree", "omw add feature/auth --base main"],
      ["Create from PR with session layout", "omw add feature/review --pr 123 --session --layout dev"],
    ],
    notes: [
      "Creates the branch automatically when it does not already exist.",
      "Existing branches are reused as-is; --base only applies when a new branch is created.",
      "Runs copyFiles, linkFiles, sharedDeps, postCreate hooks, monorepo hooks after creation.",
      "Rolls back on hook failure.",
      "Requires gh CLI for --pr.",
      "Supports comma/space separated focus paths.",
    ],
    configKeys: [
      "`defaults.worktreeDir` — Directory pattern for new worktrees",
      "`defaults.copyFiles` — Files to copy from main worktree",
      "`defaults.linkFiles` — Files to symlink from main worktree",
      "`defaults.sharedDeps` — Shared dependency strategy and paths",
      "`defaults.postCreate` — Hooks to run after worktree creation",
      "`defaults.autoUpstream` — Auto-set upstream tracking branch",
      "`templates.*` — Named template overrides",
      "`sessions.autoCreate` — Auto-create tmux session on add",
      "`sessions.layouts` — Tmux session layout definitions",
    ],
  },
  {
    command: "remove",
    summary: "Remove a worktree by branch name or path.",
    synopsis: "omw remove <branch-or-path>",
    options: [
      { flag: "--force", type: "boolean", alias: "-f", description: "Force removal even with uncommitted changes" },
      { flag: "--yes", type: "boolean", alias: "-y", description: "Skip confirmation prompt" },
    ],
    examples: [
      ["Remove a branch worktree", "omw remove feature/auth"],
      ["Force remove without prompt", "omw remove feature/auth --force --yes"],
    ],
    notes: [
      "Runs postRemove hooks and monorepo postRemove hooks before removal.",
      "Cannot remove main worktree.",
      "Cannot remove locked worktrees.",
      "Auto-kills tmux session if sessions.autoKill is enabled.",
    ],
    configKeys: [
      "`defaults.postRemove` — Hooks to run before worktree removal",
      "`sessions.autoKill` — Auto-kill tmux session on remove",
    ],
  },
  {
    command: "list",
    summary: "List worktrees with branch, path, status, and focus details.",
    synopsis: "omw list",
    options: [
      { flag: "--json", type: "boolean", alias: "-j", description: "Output as JSON" },
      { flag: "--porcelain", type: "boolean", alias: "-p", description: "Machine-readable output" },
      { flag: "--all", type: "boolean", alias: "-a", description: "List worktrees from all configured repos" },
    ],
    examples: [
      ["Show all worktrees", "omw list"],
      ["Get machine-readable output", "omw list --porcelain"],
    ],
    notes: [
      "Shows branch, path, status (clean/dirty/locked), focus paths.",
      "Focus column truncated to 40 chars.",
    ],
    configKeys: ["`repos[].path` — Repository paths for --all flag"],
  },
  {
    command: "switch",
    summary: "Switch shell context to a worktree by branch or path.",
    synopsis: "omw switch <branch-or-path>",
    options: [],
    examples: [
      ["Switch using branch name", "omw switch feature/auth"],
      ["Switch using path", "omw switch ~/.omw/worktrees/repo-feature-auth"],
    ],
    notes: [
      "Outputs cd command for shell eval.",
      "Requires shell integration (omw shell-init).",
      "Auto-switches tmux session if sessions.enabled and inside tmux.",
      "Logs switch activity.",
    ],
    configKeys: [
      "`sessions.enabled` — Enable tmux session switching",
      "`sessions.prefix` — Tmux session name prefix",
    ],
  },
  {
    command: "status",
    summary: "Show branch health, sync state, commit info, and focus.",
    synopsis: "omw status",
    options: [
      { flag: "--json", type: "boolean", alias: "-j", description: "Output as JSON" },
      { flag: "--all", type: "boolean", alias: "-a", description: "Show worktrees from all configured repos" },
    ],
    examples: [
      ["Print status table", "omw status"],
      ["Parse status in scripts", "omw status --json"],
    ],
    notes: [
      "Shows branch, dirty count, sync status (ahead/behind), last commit info, focus paths.",
      "Marks current worktree with *.",
    ],
    configKeys: ["`repos[].path` — Repository paths for --all flag"],
  },
  {
    command: "clean",
    summary: "Remove merged worktrees and optionally inspect stale candidates.",
    synopsis: "omw clean",
    options: [
      { flag: "--dry-run", type: "boolean", alias: "-n", description: "Show what would be removed" },
      { flag: "--yes", type: "boolean", alias: "-y", description: "Skip confirmation" },
      { flag: "--stale", type: "boolean", alias: "-", description: "Also show stale worktrees based on lifecycle config" },
    ],
    examples: [
      ["Preview merged cleanup", "omw clean --dry-run"],
      ["Run cleanup without prompts", "omw clean --yes"],
    ],
    notes: [
      "Only removes merged worktrees.",
      "Skips pinned and dirty worktrees.",
      "Runs git worktree prune after cleanup.",
      "--stale uses lifecycle config (staleAfterDays, maxWorktrees).",
    ],
    configKeys: [
      "`lifecycle.staleAfterDays` — Days until a worktree is considered stale",
      "`lifecycle.maxWorktrees` — Maximum allowed worktrees",
      "`lifecycle.autoCleanMerged` — Auto-clean merged worktrees",
    ],
  },
  {
    command: "doctor",
    summary: "Run health checks for worktree state and configuration.",
    synopsis: "omw doctor",
    options: [
      { flag: "--json", type: "boolean", alias: "-j", description: "Output as JSON" },
      { flag: "--fix", type: "boolean", alias: "-", description: "Auto-fix issues" },
    ],
    examples: [
      ["Run health checks", "omw doctor"],
      ["Auto-fix detectable issues", "omw doctor --fix"],
    ],
    notes: [
      "Checks: git version (>=2.17), config validity, stale worktrees, orphaned directories, lock status, dirty worktrees.",
      "Auto-fix: prune stale, remove orphans, unlock stale locks.",
      "Exit code 0 if healthy, 1 if warnings/errors.",
    ],
    configKeys: [],
  },
  {
    command: "exec",
    summary: "Run a shell command across filtered non-main worktrees.",
    synopsis: "omw exec <command>",
    options: [
      { flag: "--all", type: "boolean", alias: "-a", description: "Run across all configured repos" },
      { flag: "--dirty", type: "boolean", alias: "-", description: "Only run in dirty worktrees" },
      { flag: "--clean", type: "boolean", alias: "-", description: "Only run in clean worktrees" },
      { flag: "--behind", type: "boolean", alias: "-", description: "Only run in worktrees behind upstream" },
      { flag: "--parallel", type: "boolean", alias: "-p", description: "Run commands in parallel" },
      { flag: "--json", type: "boolean", alias: "-j", description: "Output results as JSON" },
    ],
    examples: [
      ["Run tests in parallel", 'omw exec "bun test" --parallel'],
      ["Pull only behind worktrees", 'omw exec "git pull" --behind'],
    ],
    notes: [
      "Runs in non-main worktrees only.",
      "Sets env vars: OMW_BRANCH, OMW_WORKTREE_PATH, OMW_REPO_PATH.",
      "Exit code 1 if any command fails.",
    ],
    configKeys: ["`repos[].path` — Repository paths for --all flag"],
  },
  {
    command: "diff",
    summary: "Diff two refs or worktree branches.",
    synopsis: "omw diff <ref1> [ref2]",
    options: [
      { flag: "--stat", type: "boolean", alias: "-s", description: "Show diffstat summary only" },
      { flag: "--name-only", type: "boolean", alias: "-n", description: "Show only names of changed files" },
    ],
    examples: [
      ["Show diffstat only", "omw diff feature/a feature/b --stat"],
      ["List changed file names", "omw diff feature/a --name-only"],
    ],
    notes: [
      "ref2 defaults to HEAD.",
      "Resolves worktree branch names to refs automatically.",
    ],
    configKeys: [],
  },
  {
    command: "pin",
    summary: "Pin or unpin worktrees and inspect pin metadata.",
    synopsis: "omw pin [branch]",
    options: [
      { flag: "--reason", type: "string", alias: "-", description: "Reason for pinning" },
      { flag: "--list", type: "boolean", alias: "-", description: "List pinned worktrees" },
      { flag: "--json", type: "boolean", alias: "-j", description: "Output as JSON" },
      { flag: "--unpin", type: "boolean", alias: "-", description: "Unpin instead of pinning" },
    ],
    examples: [
      ["Pin with a reason", 'omw pin feature/auth --reason "active sprint"'],
      ["Unpin a branch", "omw pin feature/auth --unpin"],
    ],
    notes: [
      "Pinned worktrees are excluded from omw clean.",
      "Also invokable as omw unpin <branch>.",
      "Pin metadata stored in git internals.",
    ],
    configKeys: [],
  },
  {
    command: "log",
    summary: "View or clear activity log events.",
    synopsis: "omw log",
    options: [
      { flag: "--limit", type: "number", alias: "-", description: "default 20, Show the last N entries" },
      { flag: "--json", type: "boolean", alias: "-j", description: "Output as JSON" },
      { flag: "--clear", type: "boolean", alias: "-", description: "Clear the activity log" },
    ],
    examples: [
      ["Show recent entries", "omw log --limit 50"],
      ["Clear the log", "omw log --clear"],
    ],
    notes: [
      "Events: create (green), delete (red), switch (blue), rename (yellow), archive (magenta), import (cyan).",
      "Color-coded in terminal.",
    ],
    configKeys: [],
  },
  {
    command: "archive",
    summary: "Archive worktree changes as patch files before optional removal.",
    synopsis: "omw archive [branch]",
    options: [
      { flag: "--yes", type: "boolean", alias: "-y", description: "Skip confirmation prompt" },
      { flag: "--keep", type: "boolean", alias: "-", description: "Archive without removing the worktree" },
      { flag: "--list", type: "boolean", alias: "-", description: "List all archives" },
      { flag: "--json", type: "boolean", alias: "-j", description: "Output as JSON with --list" },
    ],
    examples: [
      ["Archive and remove", "omw archive feature/done --yes"],
      ["List archive records", "omw archive --list --json"],
    ],
    notes: [
      "Archives stored as patch files in ~/.omw/archives/.",
      "Cannot archive main worktree.",
      "Runs postRemove hooks before removal unless --keep.",
    ],
    configKeys: ["`defaults.postRemove` — Hooks to run before worktree removal"],
  },
  {
    command: "rename",
    summary: "Rename a worktree branch and optionally move its directory path.",
    synopsis: "omw rename <old> <new>",
    options: [
      { flag: "--move-path", type: "boolean", alias: "-", description: "Also rename the worktree directory path" },
    ],
    examples: [
      ["Rename a worktree branch", "omw rename feature/old feature/new"],
      ["Rename branch and directory", "omw rename feature/old feature/new --move-path"],
    ],
    notes: [
      "Cannot rename main worktree.",
      "Checks for branch name conflicts.",
      "Logs rename activity.",
      "--move-path replaces old branch slug with new one in directory name.",
    ],
    configKeys: [],
  },
  {
    command: "clone",
    summary: "Clone a repository and optionally apply omw template setup.",
    synopsis: "omw clone <url> [path]",
    options: [
      { flag: "--template", type: "string", alias: "-t", description: "Apply a named template after cloning" },
      { flag: "--init-config", type: "boolean", alias: "-", description: "default true, Initialize omw config after cloning" },
    ],
    examples: [
      ["Clone and initialize", "omw clone https://github.com/user/repo.git"],
      ["Clone with template and no config init", "omw clone https://github.com/user/repo.git --template review --no-init-config"],
    ],
    notes: [
      "Auto-detects target path from URL.",
      "Runs template postCreate hooks if template specified.",
      "Use --no-init-config to skip config initialization.",
    ],
    configKeys: ["`templates.*` — Named template overrides"],
  },
  {
    command: "import",
    summary: "Import an existing git worktree into omw metadata.",
    synopsis: "omw import <path>",
    options: [
      { flag: "--focus", type: "array", alias: "-f", description: "Focus packages for monorepo" },
      { flag: "--pin", type: "boolean", alias: "-", description: "Pin the worktree" },
    ],
    examples: [
      ["Import a worktree path", "omw import /path/to/worktree"],
      ["Import with focus and pin", "omw import /path/to/worktree --focus apps/web,apps/api --pin"],
    ],
    notes: [
      "Validates that path is a valid git worktree.",
      "Logs import activity.",
      "Supports comma/space separated focus paths.",
    ],
    configKeys: [],
  },
  {
    command: "session",
    summary: "Manage tmux sessions for worktrees.",
    synopsis: "omw session [branch-or-path]",
    options: [
      { flag: "--list", type: "boolean", alias: "-l", description: "List active omw tmux sessions" },
      { flag: "--kill", type: "boolean", alias: "-k", description: "Kill the session for the specified worktree" },
      { flag: "--kill-all", type: "boolean", alias: "-", description: "Kill all omw tmux sessions" },
      { flag: "--layout", type: "string", alias: "-", description: "Use a named layout from config" },
      { flag: "--json", type: "boolean", alias: "-j", description: "Output in JSON format" },
    ],
    examples: [
      ["Attach or create a session", "omw session feature/auth"],
      ["List sessions as JSON", "omw session --list --json"],
    ],
    notes: [
      "Requires tmux.",
      "Session naming: branch feat/auth-token → tmux session omw_feat-auth-token.",
      "Supports layout templates with multiple windows.",
    ],
    configKeys: [
      "`sessions.enabled` — Enable tmux session integration",
      "`sessions.autoCreate` — Auto-create session on worktree add",
      "`sessions.autoKill` — Auto-kill session on worktree remove",
      "`sessions.prefix` — Tmux session name prefix",
      "`sessions.defaultLayout` — Default layout name",
      "`sessions.layouts` — Layout definitions with windows",
    ],
  },
  {
    command: "config",
    summary: "Initialize, inspect, edit, validate, and manage profiles.",
    synopsis: "omw config",
    options: [
      { flag: "--init", type: "boolean", alias: "-", description: "Create default config file" },
      { flag: "--show", type: "boolean", alias: "-s", description: "Print current config as JSON" },
      { flag: "--edit", type: "boolean", alias: "-e", description: "Open config in $EDITOR" },
      { flag: "--path", type: "boolean", alias: "-", description: "Print config file path" },
      { flag: "--validate", type: "boolean", alias: "-", description: "Validate config against schema" },
      { flag: "--profiles", type: "boolean", alias: "-", description: "List config profiles" },
      { flag: "--profile", type: "string", alias: "-", description: "Profile name for activation/deletion" },
      { flag: "--activate", type: "boolean", alias: "-", description: "Activate the specified profile" },
      { flag: "--delete", type: "boolean", alias: "-", description: "Delete the specified profile" },
    ],
    examples: [
      ["Initialize config", "omw config --init"],
      ["Activate a profile", "omw config --profile work --activate"],
    ],
    notes: ["Config path: ~/.config/oh-my-worktree/config.json.", "XDG-compliant."],
    configKeys: [],
  },
  {
    command: "open",
    summary: "Open the target or current worktree in an editor.",
    synopsis: "omw open [branch-or-path]",
    options: [
      { flag: "--editor", type: "string", alias: "-e", description: "Editor command to use" },
      { flag: "--list-editors", type: "boolean", alias: "-", description: "List detected editors" },
    ],
    examples: [
      ["Open current worktree", "omw open"],
      ["Open with specific editor", "omw open feature/auth --editor nvim"],
    ],
    notes: [
      "Auto-detects editors: code, cursor, vim, nvim, emacs, nano, subl, zed, idea, webstorm.",
      "Uses $VISUAL or $EDITOR env vars.",
      "Defaults to current worktree if no branch specified.",
    ],
    configKeys: [],
  },
  {
    command: "shell-init",
    summary: "Generate shell integration wrappers and completions.",
    synopsis: "omw shell-init [shell]",
    options: [
      { flag: "--completions", type: "string", alias: "-", description: "Generate shell completions: bash, zsh, fish" },
    ],
    examples: [
      ["Generate shell wrapper", "omw shell-init zsh"],
      ["Generate completion script", "omw shell-init --completions fish"],
    ],
    notes: [
      "Shell arg is auto-detected if omitted.",
      "Generates wrapper function for omw switch to work with shell cd.",
      "Supports bash, zsh, fish.",
    ],
    configKeys: [],
  },
  {
    command: "init",
    summary: "Initialize omw config or install AI agent skill files.",
    synopsis: "omw init",
    options: [
      { flag: "--skill", type: "string", alias: "-s", description: "Install AI agent skill: claude-code, codex, opencode" },
    ],
    examples: [
      ["Initialize config", "omw init"],
      ["Install Claude Code skill", "omw init --skill claude-code"],
      ["Install Codex skill", "omw init --skill codex"],
    ],
    notes: ["Without --skill, reuses config initialization and creates only config.json.", "With --skill, installs or updates SKILL.md + references/ directory.", "Idempotent — running again updates existing files without breaking existing setup."],
    configKeys: [],
  },
];

function generateOptionsTable(options: OptionSpec[]): string {
  const rows = options.length > 0
    ? options.map((option) => `| ${option.flag} | ${option.type} | ${option.alias} | ${option.description} |`)
    : ["| - | - | - | No options |"];
  return [
    "| Flag | Type | Alias | Description |",
    "|------|------|-------|-------------|",
    ...rows,
  ].join("\n");
}

export function generateSkillContent(): string {
  const commandRows = commandOverview.map((entry) => `| \`${entry.command}\` | ${entry.aliases} | ${entry.description} |`);
  const references = referenceSpecs.map((spec) => `- [\`omw ${spec.command}\`](references/${spec.command}.md)`);

  return [
    "---",
    "name: omw",
    `description: ${SKILL_DESCRIPTION}`,
    "metadata:",
    "  author: getsolaris",
    '  version: "1.0.0"',
    "---",
    "",
    "# oh-my-worktree (omw)",
    "",
    "## Quick Start",
    "",
    "### Create a feature worktree",
    "",
    "```bash",
    "omw add feature/my-feature --base main",
    "```",
    "",
    "### List and check status",
    "",
    "```bash",
    "omw list",
    "omw status",
    "```",
    "",
    "### Clean up merged worktrees",
    "",
    "```bash",
    "omw clean --dry-run",
    "omw clean --yes",
    "```",
    "",
    "### Run commands across worktrees",
    "",
    "```bash",
    'omw exec "bun test" --parallel',
    "```",
    "",
    "### Review a GitHub PR",
    "",
    "```bash",
    "omw add pr-review --pr 42",
    "omw open pr-review",
    "```",
    "",
    "### Use templates",
    "",
    "```bash",
    "# Create worktree with predefined template (hooks, base branch, settings)",
    "omw add feature/new --template frontend",
    "```",
    "",
    "### Tmux session management",
    "",
    "```bash",
    "# Create worktree with tmux session",
    "omw add feature/api --session --layout dev",
    "",
    "# List active sessions",
    "omw session --list",
    "",
    "# Attach to existing session",
    "omw session feature/api",
    "```",
    "",
    "### Shell integration setup",
    "",
    "```bash",
    "# Add to ~/.zshrc or ~/.bashrc",
    "eval \"$(omw shell-init)\"",
    "",
    "# Then switch worktrees with cd",
    "omw switch feature/auth",
    "```",
    "",
    "## Command Overview",
    "",
    "| Command | Aliases | Description |",
    "|---------|---------|-------------|",
    ...commandRows,
    "",
    "## Monorepo Workflows",
    "",
    "Use focus paths to target packages and trigger matching monorepo hooks.",
    "",
    "```bash",
    "omw add feature/web-auth --focus apps/web,apps/api",
    "omw import /path/to/worktree --focus packages/core --pin",
    "omw list --json",
    "```",
    "",
    "Focus accepts comma-separated values, space-separated values, or repeated --focus flags.",
    "",
    "## Configuration",
    "",
    "- Config path: `~/.config/oh-my-worktree/config.json`",
    "- Use `--json` output flags for scripting and automation",
    "- Environment variables in `omw exec`: `OMW_BRANCH`, `OMW_WORKTREE_PATH`, `OMW_REPO_PATH`",
    "",
    "## Command Reference",
    "",
    "For detailed options and examples for each command:",
    "",
    ...references,
    "- [`Configuration Schema`](references/config-schema.md)",
    "",
  ].join("\n");
}

export function generateReferenceFiles(): Map<string, string> {
  const files = new Map<string, string>();
  for (const spec of referenceSpecs) {
    const lines = [
      `# omw ${spec.command}`,
      "",
      spec.summary,
      "",
      "## Synopsis",
      "",
      "```",
      spec.synopsis,
      "```",
      "",
      "## Options",
      "",
      generateOptionsTable(spec.options),
      "",
      "## Examples",
      "",
      "```bash",
      `# ${spec.examples[0][0]}`,
      spec.examples[0][1],
      "",
      `# ${spec.examples[1][0]}`,
      spec.examples[1][1],
      "```",
      "",
      "## Notes",
      "",
      ...spec.notes.map((note) => `- ${note}`),
      "",
      ...(spec.configKeys.length > 0
        ? [
            "## Configuration",
            "",
            "Related config keys in `~/.config/oh-my-worktree/config.json`:",
            "",
            ...spec.configKeys.map((key) => `- ${key}`),
            "",
          ]
        : []),
    ];
    files.set(`${spec.command}.md`, lines.join("\n"));
  }

  const configSchemaContent = generateConfigSchemaContent();
  files.set("config-schema.md", configSchemaContent);

  return files;
}

function generateConfigSchemaContent(): string {
  return [
    "# Configuration Schema",
    "",
    "Config file path: `~/.config/oh-my-worktree/config.json`",
    "",
    "## Minimal Example",
    "",
    "```json",
    "{",
    '  "version": 1,',
    '  "defaults": {',
    '    "worktreeDir": "~/.omw/worktrees/{repo}-{branch}",',
    '    "copyFiles": [".env", ".env.local"],',
    '    "linkFiles": ["node_modules"],',
    '    "postCreate": ["bun install"],',
    '    "postRemove": [],',
    '    "autoUpstream": true',
    "  }",
    "}",
    "```",
    "",
    "## Full Example",
    "",
    "```json",
    "{",
    '  "version": 1,',
    '  "defaults": {',
    '    "worktreeDir": "~/.omw/worktrees/{repo}-{branch}",',
    '    "copyFiles": [".env"],',
    '    "linkFiles": [],',
    '    "postCreate": ["bun install"],',
    '    "postRemove": [],',
    '    "autoUpstream": true,',
    '    "sharedDeps": {',
    '      "strategy": "symlink",',
    '      "paths": ["node_modules"]',
    "    }",
    "  },",
    '  "repos": [',
    "    {",
    '      "path": "/path/to/repo",',
    '      "copyFiles": [".env", ".env.local"],',
    '      "monorepo": {',
    '        "autoDetect": true,',
    '        "hooks": [',
    "          {",
    '            "glob": "apps/*",',
    '            "postCreate": ["bun install"]',
    "          }",
    "        ]",
    "      }",
    "    }",
    "  ],",
    '  "templates": {',
    '    "frontend": {',
    '      "base": "main",',
    '      "copyFiles": [".env"],',
    '      "postCreate": ["bun install", "bun run build"]',
    "    },",
    '    "review": {',
    '      "base": "main",',
    '      "postCreate": ["bun install"]',
    "    }",
    "  },",
    '  "sessions": {',
    '    "enabled": true,',
    '    "autoCreate": false,',
    '    "autoKill": true,',
    '    "prefix": "omw",',
    '    "defaultLayout": "dev",',
    '    "layouts": {',
    '      "dev": {',
    '        "windows": [',
    '          { "name": "editor", "command": "nvim ." },',
    '          { "name": "server", "command": "bun run dev" },',
    '          { "name": "shell" }',
    "        ]",
    "      }",
    "    }",
    "  },",
    '  "lifecycle": {',
    '    "autoCleanMerged": false,',
    '    "staleAfterDays": 30,',
    '    "maxWorktrees": 10',
    "  },",
    '  "theme": "default"',
    "}",
    "```",
    "",
    "## Key Reference",
    "",
    "### defaults",
    "",
    "| Key | Type | Default | Description |",
    "|-----|------|---------|-------------|",
    "| `worktreeDir` | string | `~/.omw/worktrees/{repo}-{branch}` | Directory pattern. Supports `{repo}` and `{branch}` variables |",
    "| `copyFiles` | string[] | `[]` | Files to copy from main worktree on creation |",
    "| `linkFiles` | string[] | `[]` | Files to symlink from main worktree on creation |",
    "| `postCreate` | string[] | `[]` | Shell commands to run after worktree creation |",
    "| `postRemove` | string[] | `[]` | Shell commands to run before worktree removal |",
    "| `autoUpstream` | boolean | `false` | Automatically set upstream tracking branch |",
    "| `sharedDeps.strategy` | string | `symlink` | Strategy for sharing deps: `symlink`, `hardlink`, or `copy` |",
    "| `sharedDeps.paths` | string[] | `[]` | Paths to share between worktrees |",
    "",
    "### repos[]",
    "",
    "Per-repository overrides. Same keys as `defaults` plus:",
    "",
    "| Key | Type | Description |",
    "|-----|------|-------------|",
    "| `path` | string | **Required.** Absolute path to the repository |",
    "| `monorepo.autoDetect` | boolean | Auto-detect monorepo tools (pnpm, turbo, nx, lerna) |",
    "| `monorepo.extraPatterns` | string[] | Additional glob patterns for package discovery |",
    "| `monorepo.hooks[]` | object[] | Per-package hooks matched by glob pattern |",
    "| `monorepo.hooks[].glob` | string | Glob to match against focus paths |",
    "| `monorepo.hooks[].copyFiles` | string[] | Package-level files to copy |",
    "| `monorepo.hooks[].linkFiles` | string[] | Package-level files to symlink |",
    "| `monorepo.hooks[].postCreate` | string[] | Package-level post-create hooks |",
    "| `monorepo.hooks[].postRemove` | string[] | Package-level post-remove hooks |",
    "",
    "### templates",
    "",
    "Named presets applied via `omw add --template <name>` or `omw clone --template <name>`.",
    "",
    "| Key | Type | Description |",
    "|-----|------|-------------|",
    "| `base` | string | Default base branch for new worktrees |",
    "| `worktreeDir` | string | Override directory pattern |",
    "| `copyFiles` | string[] | Override files to copy |",
    "| `linkFiles` | string[] | Override files to symlink |",
    "| `postCreate` | string[] | Override post-create hooks |",
    "| `postRemove` | string[] | Override post-remove hooks |",
    "| `autoUpstream` | boolean | Override upstream tracking |",
    "",
    "### sessions",
    "",
    "| Key | Type | Default | Description |",
    "|-----|------|---------|-------------|",
    "| `enabled` | boolean | `false` | Enable tmux session integration |",
    "| `autoCreate` | boolean | `false` | Auto-create session on `omw add` |",
    "| `autoKill` | boolean | `false` | Auto-kill session on `omw remove` |",
    "| `prefix` | string | `omw` | Prefix for tmux session names |",
    "| `defaultLayout` | string | - | Default layout name |",
    "| `layouts.<name>.windows[]` | object[] | - | Window definitions |",
    "| `layouts.<name>.windows[].name` | string | **Required.** | Window name |",
    "| `layouts.<name>.windows[].command` | string | - | Command to run in window |",
    "",
    "### lifecycle",
    "",
    "| Key | Type | Default | Description |",
    "|-----|------|---------|-------------|",
    "| `autoCleanMerged` | boolean | `false` | Auto-clean merged worktrees |",
    "| `staleAfterDays` | number | `30` | Days until a worktree is considered stale |",
    "| `maxWorktrees` | number | `10` | Maximum number of worktrees |",
    "",
  ].join("\n");
}

export function writeSkillFile(platform: SkillPlatform): SkillWriteResult {
  const filePath = getSkillFilePath(platform);
  const referenceDir = join(dirname(filePath), "references");
  const content = generateSkillContent();
  const references = generateReferenceFiles();
  const dir = dirname(filePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(referenceDir)) {
    mkdirSync(referenceDir, { recursive: true });
  }

  const existed = existsSync(filePath);
  writeFileSync(filePath, content, "utf-8");
  for (const [filename, fileContent] of references.entries()) {
    writeFileSync(join(referenceDir, filename), fileContent, "utf-8");
  }

  return {
    filePath,
    referenceDir,
    referenceCount: references.size,
    platform,
    action: existed ? "updated" : "created",
  };
}
