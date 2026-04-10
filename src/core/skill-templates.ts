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
      return join(home, ".claude", "skills", "copse");
    case "codex":
      return join(home, ".agents", "skills", "copse");
    case "opencode":
      return join(home, ".config", "opencode", "skill", "copse");
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
  { command: "clone", aliases: "-", description: "Clone a repository and initialize copse setup." },
  { command: "import", aliases: "-", description: "Import an existing worktree into copse metadata." },
  { command: "session", aliases: "ss", description: "Manage tmux sessions for worktrees." },
  { command: "config", aliases: "-", description: "Initialize, inspect, validate, and manage config profiles." },
  { command: "open", aliases: "-", description: "Open a worktree path in your preferred editor." },
  { command: "shell-init", aliases: "-", description: "Generate shell integration and completions." },
  { command: "init", aliases: "-", description: "Initialize config or install/update copse AI agent skill files." },
];

const referenceSpecs: ReferenceSpec[] = [
  {
    command: "add",
    summary: "Create a new worktree from a branch, template, or GitHub PR.",
    synopsis: "copse add [branch] [path]",
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
      ["Create a feature branch worktree", "copse add feature/auth --base main"],
      ["Create from PR with session layout", "copse add feature/review --pr 123 --session --layout dev"],
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
    synopsis: "copse remove <branch-or-path>",
    options: [
      { flag: "--force", type: "boolean", alias: "-f", description: "Force removal even with uncommitted changes" },
      { flag: "--yes", type: "boolean", alias: "-y", description: "Skip confirmation prompt" },
    ],
    examples: [
      ["Remove a branch worktree", "copse remove feature/auth"],
      ["Force remove without prompt", "copse remove feature/auth --force --yes"],
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
    synopsis: "copse list",
    options: [
      { flag: "--json", type: "boolean", alias: "-j", description: "Output as JSON" },
      { flag: "--porcelain", type: "boolean", alias: "-p", description: "Machine-readable output" },
      { flag: "--all", type: "boolean", alias: "-a", description: "List worktrees from all configured repos" },
    ],
    examples: [
      ["Show all worktrees", "copse list"],
      ["Get machine-readable output", "copse list --porcelain"],
    ],
    notes: [
      "Shows branch, path, status (clean/dirty/locked), focus paths.",
      "Focus column truncated to 40 chars.",
      "--all also includes repos auto-discovered via the `workspaces` config.",
    ],
    configKeys: [
      "`repos[].path` — Repository paths for --all flag",
      "`workspaces[].path` — Parent directories whose git repos are auto-discovered for --all",
    ],
  },
  {
    command: "switch",
    summary: "Switch shell context to a worktree by branch or path.",
    synopsis: "copse switch <branch-or-path>",
    options: [],
    examples: [
      ["Switch using branch name", "copse switch feature/auth"],
      ["Switch using path", "copse switch ~/.copse/worktrees/repo-feature-auth"],
    ],
    notes: [
      "Outputs cd command for shell eval.",
      "Requires shell integration (copse shell-init).",
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
    synopsis: "copse status",
    options: [
      { flag: "--json", type: "boolean", alias: "-j", description: "Output as JSON" },
      { flag: "--all", type: "boolean", alias: "-a", description: "Show worktrees from all configured repos" },
    ],
    examples: [
      ["Print status table", "copse status"],
      ["Parse status in scripts", "copse status --json"],
    ],
    notes: [
      "Shows branch, dirty count, sync status (ahead/behind), last commit info, focus paths.",
      "Marks current worktree with *.",
      "--all also includes repos auto-discovered via the `workspaces` config.",
    ],
    configKeys: [
      "`repos[].path` — Repository paths for --all flag",
      "`workspaces[].path` — Parent directories whose git repos are auto-discovered for --all",
    ],
  },
  {
    command: "clean",
    summary: "Remove merged worktrees and optionally inspect stale candidates.",
    synopsis: "copse clean",
    options: [
      { flag: "--dry-run", type: "boolean", alias: "-n", description: "Show what would be removed" },
      { flag: "--yes", type: "boolean", alias: "-y", description: "Skip confirmation" },
      { flag: "--stale", type: "boolean", alias: "-", description: "Also show stale worktrees based on lifecycle config" },
    ],
    examples: [
      ["Preview merged cleanup", "copse clean --dry-run"],
      ["Run cleanup without prompts", "copse clean --yes"],
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
    synopsis: "copse doctor",
    options: [
      { flag: "--json", type: "boolean", alias: "-j", description: "Output as JSON" },
      { flag: "--fix", type: "boolean", alias: "-", description: "Auto-fix issues" },
    ],
    examples: [
      ["Run health checks", "copse doctor"],
      ["Auto-fix detectable issues", "copse doctor --fix"],
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
    synopsis: "copse exec <command>",
    options: [
      { flag: "--all", type: "boolean", alias: "-a", description: "Run across all configured repos" },
      { flag: "--dirty", type: "boolean", alias: "-", description: "Only run in dirty worktrees" },
      { flag: "--clean", type: "boolean", alias: "-", description: "Only run in clean worktrees" },
      { flag: "--behind", type: "boolean", alias: "-", description: "Only run in worktrees behind upstream" },
      { flag: "--parallel", type: "boolean", alias: "-p", description: "Run commands in parallel" },
      { flag: "--json", type: "boolean", alias: "-j", description: "Output results as JSON" },
    ],
    examples: [
      ["Run tests in parallel", 'copse exec "bun test" --parallel'],
      ["Pull only behind worktrees", 'copse exec "git pull" --behind'],
    ],
    notes: [
      "Runs in non-main worktrees only.",
      "Sets env vars: COPSE_BRANCH, COPSE_WORKTREE_PATH, COPSE_REPO_PATH.",
      "Exit code 1 if any command fails.",
      "--all also includes repos auto-discovered via the `workspaces` config.",
    ],
    configKeys: [
      "`repos[].path` — Repository paths for --all flag",
      "`workspaces[].path` — Parent directories whose git repos are auto-discovered for --all",
    ],
  },
  {
    command: "diff",
    summary: "Diff two refs or worktree branches.",
    synopsis: "copse diff <ref1> [ref2]",
    options: [
      { flag: "--stat", type: "boolean", alias: "-s", description: "Show diffstat summary only" },
      { flag: "--name-only", type: "boolean", alias: "-n", description: "Show only names of changed files" },
    ],
    examples: [
      ["Show diffstat only", "copse diff feature/a feature/b --stat"],
      ["List changed file names", "copse diff feature/a --name-only"],
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
    synopsis: "copse pin [branch]",
    options: [
      { flag: "--reason", type: "string", alias: "-", description: "Reason for pinning" },
      { flag: "--list", type: "boolean", alias: "-", description: "List pinned worktrees" },
      { flag: "--json", type: "boolean", alias: "-j", description: "Output as JSON" },
      { flag: "--unpin", type: "boolean", alias: "-", description: "Unpin instead of pinning" },
    ],
    examples: [
      ["Pin with a reason", 'copse pin feature/auth --reason "active sprint"'],
      ["Unpin a branch", "copse pin feature/auth --unpin"],
    ],
    notes: [
      "Pinned worktrees are excluded from copse clean.",
      "Also invokable as copse unpin <branch>.",
      "Pin metadata stored in git internals.",
    ],
    configKeys: [],
  },
  {
    command: "log",
    summary: "View or clear activity log events.",
    synopsis: "copse log",
    options: [
      { flag: "--limit", type: "number", alias: "-", description: "default 20, Show the last N entries" },
      { flag: "--json", type: "boolean", alias: "-j", description: "Output as JSON" },
      { flag: "--clear", type: "boolean", alias: "-", description: "Clear the activity log" },
    ],
    examples: [
      ["Show recent entries", "copse log --limit 50"],
      ["Clear the log", "copse log --clear"],
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
    synopsis: "copse archive [branch]",
    options: [
      { flag: "--yes", type: "boolean", alias: "-y", description: "Skip confirmation prompt" },
      { flag: "--keep", type: "boolean", alias: "-", description: "Archive without removing the worktree" },
      { flag: "--list", type: "boolean", alias: "-", description: "List all archives" },
      { flag: "--json", type: "boolean", alias: "-j", description: "Output as JSON with --list" },
    ],
    examples: [
      ["Archive and remove", "copse archive feature/done --yes"],
      ["List archive records", "copse archive --list --json"],
    ],
    notes: [
      "Archives stored as patch files in ~/.copse/archives/.",
      "Cannot archive main worktree.",
      "Runs postRemove hooks before removal unless --keep.",
    ],
    configKeys: ["`defaults.postRemove` — Hooks to run before worktree removal"],
  },
  {
    command: "rename",
    summary: "Rename a worktree branch and optionally move its directory path.",
    synopsis: "copse rename <old> <new>",
    options: [
      { flag: "--move-path", type: "boolean", alias: "-", description: "Also rename the worktree directory path" },
    ],
    examples: [
      ["Rename a worktree branch", "copse rename feature/old feature/new"],
      ["Rename branch and directory", "copse rename feature/old feature/new --move-path"],
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
    summary: "Clone a repository and optionally apply copse template setup.",
    synopsis: "copse clone <url> [path]",
    options: [
      { flag: "--template", type: "string", alias: "-t", description: "Apply a named template after cloning" },
      { flag: "--init-config", type: "boolean", alias: "-", description: "default true, Initialize copse config after cloning" },
    ],
    examples: [
      ["Clone and initialize", "copse clone https://github.com/user/repo.git"],
      ["Clone with template and no config init", "copse clone https://github.com/user/repo.git --template review --no-init-config"],
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
    summary: "Import an existing git worktree into copse metadata.",
    synopsis: "copse import <path>",
    options: [
      { flag: "--focus", type: "array", alias: "-f", description: "Focus packages for monorepo" },
      { flag: "--pin", type: "boolean", alias: "-", description: "Pin the worktree" },
    ],
    examples: [
      ["Import a worktree path", "copse import /path/to/worktree"],
      ["Import with focus and pin", "copse import /path/to/worktree --focus apps/web,apps/api --pin"],
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
    synopsis: "copse session [branch-or-path]",
    options: [
      { flag: "--list", type: "boolean", alias: "-l", description: "List active copse tmux sessions" },
      { flag: "--kill", type: "boolean", alias: "-k", description: "Kill the session for the specified worktree" },
      { flag: "--kill-all", type: "boolean", alias: "-", description: "Kill all copse tmux sessions" },
      { flag: "--layout", type: "string", alias: "-", description: "Use a named layout from config" },
      { flag: "--json", type: "boolean", alias: "-j", description: "Output in JSON format" },
    ],
    examples: [
      ["Attach or create a session", "copse session feature/auth"],
      ["List sessions as JSON", "copse session --list --json"],
    ],
    notes: [
      "Requires tmux.",
      "Session naming: branch feat/auth-token → tmux session cop_feat-auth-token.",
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
    synopsis: "copse config",
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
      ["Initialize config", "copse config --init"],
      ["Activate a profile", "copse config --profile work --activate"],
    ],
    notes: ["Config path: ~/.config/copse/config.json.", "XDG-compliant."],
    configKeys: [],
  },
  {
    command: "open",
    summary: "Open the target or current worktree in an editor (focus-aware).",
    synopsis: "copse open [branch-or-path]",
    options: [
      { flag: "--editor", type: "string", alias: "-e", description: "Editor command to use" },
      { flag: "--focus", type: "string", alias: "-f", description: "Open a specific focus path (must match an existing focus entry)" },
      { flag: "--root", type: "boolean", alias: "-", description: "Force opening the worktree root, ignoring focus paths" },
      { flag: "--list-editors", type: "boolean", alias: "-", description: "List detected editors" },
    ],
    examples: [
      ["Open current worktree", "copse open"],
      ["Open with specific editor", "copse open feature/auth --editor nvim"],
      ["Open a specific focus path", "copse open feature/auth --focus apps/web"],
      ["Force open the worktree root", "copse open feature/auth --root"],
    ],
    notes: [
      "Auto-detects editors: code, cursor, vim, nvim, emacs, nano, subl, zed, idea, webstorm.",
      "Uses $VISUAL or $EDITOR env vars.",
      "Defaults to current worktree if no branch specified.",
      "Focus-aware: 0 focus paths → root, 1 focus path → that path, 2+ focus paths → errors and asks for --focus or --root (the TUI shows an interactive picker instead).",
    ],
    configKeys: [],
  },
  {
    command: "shell-init",
    summary: "Generate shell integration wrappers and completions.",
    synopsis: "copse shell-init [shell]",
    options: [
      { flag: "--completions", type: "string", alias: "-", description: "Generate shell completions: bash, zsh, fish" },
    ],
    examples: [
      ["Generate shell wrapper", "copse shell-init zsh"],
      ["Generate completion script", "copse shell-init --completions fish"],
    ],
    notes: [
      "Shell arg is auto-detected if omitted.",
      "Generates wrapper function for copse switch to work with shell cd.",
      "Supports bash, zsh, fish.",
    ],
    configKeys: [],
  },
  {
    command: "init",
    summary: "Initialize copse config or install AI agent skill files.",
    synopsis: "copse init",
    options: [
      { flag: "--skill", type: "string", alias: "-s", description: "Install AI agent skill: claude-code, codex, opencode" },
    ],
    examples: [
      ["Initialize config", "copse init"],
      ["Install Claude Code skill", "copse init --skill claude-code"],
      ["Install Codex skill", "copse init --skill codex"],
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
  const references = referenceSpecs.map((spec) => `- [\`copse ${spec.command}\`](references/${spec.command}.md)`);

  return [
    "---",
    "name: copse",
    `description: ${SKILL_DESCRIPTION}`,
    "metadata:",
    "  author: getsolaris",
    '  version: "1.0.0"',
    "---",
    "",
    "# copse (copse)",
    "",
    "## Quick Start",
    "",
    "### Create a feature worktree",
    "",
    "```bash",
    "copse add feature/my-feature --base main",
    "```",
    "",
    "### List and check status",
    "",
    "```bash",
    "copse list",
    "copse status",
    "```",
    "",
    "### Clean up merged worktrees",
    "",
    "```bash",
    "copse clean --dry-run",
    "copse clean --yes",
    "```",
    "",
    "### Run commands across worktrees",
    "",
    "```bash",
    'copse exec "bun test" --parallel',
    "```",
    "",
    "### Review a GitHub PR",
    "",
    "```bash",
    "copse add pr-review --pr 42",
    "copse open pr-review",
    "```",
    "",
    "### Use templates",
    "",
    "```bash",
    "# Create worktree with predefined template (hooks, base branch, settings)",
    "copse add feature/new --template frontend",
    "```",
    "",
    "### Tmux session management",
    "",
    "```bash",
    "# Create worktree with tmux session",
    "copse add feature/api --session --layout dev",
    "",
    "# List active sessions",
    "copse session --list",
    "",
    "# Attach to existing session",
    "copse session feature/api",
    "```",
    "",
    "### Shell integration setup",
    "",
    "```bash",
    "# Add to ~/.zshrc or ~/.bashrc",
    "eval \"$(copse shell-init)\"",
    "",
    "# Then switch worktrees with cd",
    "copse switch feature/auth",
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
    "copse add feature/web-auth --focus apps/web,apps/api",
    "copse import /path/to/worktree --focus packages/core --pin",
    "copse list --json",
    "```",
    "",
    "Focus accepts comma-separated values, space-separated values, or repeated --focus flags.",
    "",
    "## Configuration",
    "",
    "- Config path: `~/.config/copse/config.json`",
    "- Use `--json` output flags for scripting and automation",
    "- Environment variables in `copse exec`: `COPSE_BRANCH`, `COPSE_WORKTREE_PATH`, `COPSE_REPO_PATH`",
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
      `# copse ${spec.command}`,
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
            "Related config keys in `~/.config/copse/config.json`:",
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
    "Config file path: `~/.config/copse/config.json`",
    "",
    "## Minimal Example",
    "",
    "```json",
    "{",
    '  "version": 1,',
    '  "defaults": {',
    '    "worktreeDir": "~/.copse/worktrees/{repo}-{branch}",',
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
    '    "worktreeDir": "~/.copse/worktrees/{repo}-{branch}",',
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
    '    "prefix": "copse",',
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
    "| `worktreeDir` | string | `~/.copse/worktrees/{repo}-{branch}` | Directory pattern. Supports `{repo}` and `{branch}` variables |",
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
    "### workspaces[]",
    "",
    "Auto-discover git repositories under parent directories. Discovered repos are merged into `repos[]` at load time. Explicit `repos[]` entries with the same resolved path always take precedence.",
    "",
    "| Key | Type | Default | Description |",
    "|-----|------|---------|-------------|",
    "| `path` | string | — | **Required.** Parent directory to scan. Supports `~` expansion. |",
    "| `depth` | integer | `1` | Scan depth (1–3). `1` scans only immediate children. |",
    "| `exclude` | string[] | `[]` | Glob patterns matched against directory names to skip. |",
    "| `defaults` | object | — | Per-repo defaults applied to discovered repos. Same fields as `defaults`, but `monorepo` is not allowed. |",
    "",
    "Discovery rules: a directory is a repo only if it contains a `.git` **directory** (not a file). Linked worktrees and submodules are skipped. Discovered repos are not recursed into. Symbolic links are not followed.",
    "",
    "### templates",
    "",
    "Named presets applied via `copse add --template <name>` or `copse clone --template <name>`.",
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
    "| `autoCreate` | boolean | `false` | Auto-create session on `copse add` |",
    "| `autoKill` | boolean | `false` | Auto-kill session on `copse remove` |",
    "| `prefix` | string | `copse` | Prefix for tmux session names |",
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
