<p align="center">
  <img src="./banner.png" alt="copse" />
</p>

# 🌲 copse

**English** | [Korean](./README.ko.md)

> Git worktree manager with a beautiful TUI

Manage git worktrees with ease. Create, switch, and clean up worktrees with config-driven automation, monorepo support, and built-in health checks.

## Features

- **TUI mode** — interactive terminal UI (`copse`)
- **CLI mode** — scriptable commands (`copse add`, `copse list`, etc.)
- **Config-driven** — per-repo hooks, file copying, symlinks
- **Monorepo support** — auto-detect packages, per-package hooks, focus tracking
- **Health checks** — `copse doctor` diagnoses worktree issues
- **Centralized worktrees** — all worktrees under `~/.copse/worktrees/` by default
- **Smart cleanup** — auto-detect and remove merged worktrees
- **Themes** — 9 built-in color themes (OpenCode, Tokyo Night, Dracula, Nord, Catppuccin, GitHub Dark, One Dark, Monokai, GitHub Light)
- **Templates** — reusable worktree presets (`copse add --template review`)
- **Cross-worktree exec** — run commands across all worktrees (`copse exec "bun test"`)
- **GitHub PR integration** — create worktrees from PRs (`copse add --pr 123`)
- **Fuzzy branch picker** — interactive branch selection in TUI with type-ahead filtering
- **Lifecycle management** — auto-detect stale/merged worktrees, configurable limits
- **Shared dependencies** — save disk with hardlink/symlink strategies for `node_modules`
- **Worktree diff** — compare changes between worktrees (`copse diff feature/a feature/b`)
- **Pin protection** — protect worktrees from auto-cleanup (`copse pin`)
- **Activity log** — track create/delete/switch/rename/archive/import events (`copse log`)
- **Archive** — preserve worktree changes as patches before removal (`copse archive`)
- **Branch rename** — rename worktree branches with metadata migration (`copse rename`)
- **Clone & init** — clone repos with copse config initialization (`copse clone`)
- **Import worktrees** — adopt manually-created worktrees (`copse import`)
- **Detail view** — expanded worktree info with commits, diff stats, upstream status (TUI)
- **Bulk actions** — multi-select and batch operations on worktrees (TUI)
- **Toast notifications** — non-blocking operation feedback (TUI)
- **Shell completions** — tab completion for bash/zsh/fish (`copse shell-init --completions`)
- **Config profiles** — switch between configuration sets (`copse config --profiles`)
- **Tmux sessions** — auto-create/kill tmux sessions per worktree with layout templates (`copse session`)
- **Workspaces** — auto-discover git repos under parent directories with per-workspace defaults (`workspaces` config)
- **AI agent init** — create config by default or install copse skill for Claude Code, Codex, OpenCode (`copse init`, `copse init --skill`)

## Requirements

- [Bun](https://bun.sh) runtime
- git 2.17+
- macOS or Linux
- [gh CLI](https://cli.github.com) (optional, for `--pr` flag)
- [tmux](https://github.com/tmux/tmux) (optional, for `copse session`)

## Installation

### Homebrew (macOS/Linux)

```bash
brew install getsolaris/tap/copse
```

### curl (one-liner)

```bash
curl -fsSL https://raw.githubusercontent.com/getsolaris/copse/main/install.sh | bash
```

### npm / bun

```bash
bun install -g @getsolaris/copse
# or
npm install -g @getsolaris/copse
```

## Local Development

For local contributor testing, run the repo directly with Bun:

```bash
bun install
bun run src/index.ts
bun run src/index.ts <cmd>
bun run typecheck
bun test
bun run build
```

Prefer targeted tests first when you change covered code, then run the full checks before opening a PR. If you change CLI or TUI behavior, manually run the affected flows locally as well.

## Quick Start

```bash
# Launch TUI
copse

# List worktrees
copse list

# Create a new worktree
copse add feature/my-feature

# Create with monorepo focus
copse add feature/my-feature --focus apps/web,apps/api

# Create from a GitHub PR
copse add --pr 123

# Use a template
copse add feature/login --template review

# Pin a worktree to protect from cleanup
copse pin feature/important --reason "active sprint"

# View activity log
copse log

# Archive worktree changes before removing
copse archive feature/done --yes

# Rename a worktree branch
copse rename old-name new-name

# Clone and initialize copse
copse clone https://github.com/user/repo.git

# Import an existing worktree
copse import /path/to/worktree

# Open/attach tmux session for a worktree
copse session feature/my-feature

# Create worktree with tmux session
copse add feature/new --session

# Run command across all worktrees
copse exec "bun test"

# Compare two worktrees
copse diff feature/a feature/b --stat

# Check worktree health
copse doctor

# Switch to a worktree (requires shell integration)
copse switch feature/my-feature

# Remove a worktree
copse remove feature/my-feature --yes

# Clean up merged worktrees
copse clean --dry-run

# Initialize config file
copse init

# Generate AI agent skill file
copse init --skill claude-code
```

## TUI Usage

Launch with `copse` (no arguments).

### Keyboard Shortcuts

| Key       | Action                 |
| --------- | ---------------------- |
| `j` / `k` | Navigate worktree list |
| `a`       | Add worktree           |
| `d`       | Delete worktree        |
| `o`       | Open in editor (focus-aware) |
| `h`       | Doctor (health check)  |
| `Enter`   | Open detail view       |
| `Escape`  | Close detail view / picker |
| `Space`   | Toggle worktree selection |
| `Ctrl+A`  | Select all worktrees   |
| `x`       | Bulk actions menu      |
| `r`       | Refresh list           |
| `Ctrl+P`  | Command palette        |
| `?`       | Help                   |
| `q`       | Quit                   |

#### `o` — Focus-aware editor open

Pressing `o` opens the selected worktree in `$VISUAL` / `$EDITOR`:

- **No focus paths set** → opens the worktree root.
- **Exactly 1 focus path** → opens `<worktree>/<focus>` directly.
- **2+ focus paths** → shows a picker so you can choose which focus path (or the worktree root) to open.

The picker supports `j`/`k` or `↑`/`↓` to navigate, `Enter` to open, and `Esc` to cancel.

### Command Palette (`Ctrl+P`)

Searchable command menu with:

- Add / Delete / Refresh worktrees
- Run Doctor
- Open Config
- Switch theme
- Quit

Type to filter, `↑↓` to navigate, `Enter` to execute, `Esc` to close.

### Worktree Creation Flow

1. Press `a` to open the Create view
2. Start typing a branch name — matching branches appear as you type
3. Use `↑↓` to select from suggestions, or keep typing for a new branch
4. Press `Tab` to switch to the Focus field (optional)
5. Type focus paths (e.g. `apps/web,apps/api`)
6. Press `Enter` to preview
7. Press `Enter` to confirm

The fuzzy branch picker shows local and remote branches sorted by last commit date, filtered in real-time as you type.

After creation, the configured `copyFiles`, `linkFiles`, `postCreate` hooks, and monorepo hooks run automatically.

### Doctor View

Press `h` to open the Doctor tab. Shows health check results:

- ✓ Git version check
- ✓ Config validation
- ✓ Stale worktree detection
- ✓ Orphaned directory detection
- ✓ Lock status check
- ✓ Dirty worktree detection

Press `r` to recheck, `Esc` to go back.

### Config View

Open with `Ctrl+P` → `Open Config`. The Config tab renders the full contents of `~/.config/copse/config.json`, including:

- Top-level: `version`, `theme`, `activeProfile`
- `defaults` (including `postRemove`, `autoUpstream`, `sharedDeps`)
- All per-repo overrides
- The full `monorepo` tree — `autoDetect`, `extraPatterns`, and every `hooks[]` entry with its `glob` / `copyFiles` / `linkFiles` / `postCreate` / `postRemove`
- `templates`, `lifecycle`, `sessions`, `profiles`

Most scalar and string-array fields are editable inline. The counter in the header shows the current position (`1/20`).

| Key | Action |
| --- | --- |
| `j` / `k` | Navigate editable fields |
| `g` / `G` | Jump to first / last field |
| `Enter` | Edit the selected field |
| `Tab` | Cycle through preset values (in edit mode) |
| `Space` / `←→` | Toggle a boolean / cycle a theme (in edit mode) |
| `Enter` | Commit the edit (saves to disk + reloads) |
| `Esc` | Cancel the edit |
| `e` | Open the config file in `$EDITOR` |
| `r` | Reload the file from disk |
| `i` | Initialize the config file if missing |

Inline editing supports five kinds of fields:

- **Strings** — plain text input (e.g. `worktreeDir`, hook `glob`, `sessions.prefix`). Press `Tab` to cycle through common presets.
- **String arrays** — JSON input like `[".env", ".env.local"]`. Empty input is treated as `[]`. Press `Tab` to cycle through presets including `[]` as the first option.
- **Booleans** — toggle with `Space`, `Tab`, or `←→`, commit with `Enter`.
- **Themes** — cycle with `Tab` or `←→`, commit with `Enter`. The new theme is applied live.
- **Enums** — fields with a fixed set of valid values (e.g. `sharedDeps.strategy` = `hardlink` / `symlink` / `copy`). Cycle with `Tab` or `←→`, commit with `Enter`.

The footer shows the current preset position when applicable, e.g. `Tab:preset (2/4)`. The cycle starts at the position matching the current value, so the first `Tab` always advances to a new value.

Every commit runs `validateConfig` before writing. Invalid input surfaces as an inline error and the edit stays open so you can fix it. For more complex fields (`sessions.layouts`, `templates`, `profiles`), press `e` to open `$EDITOR`.

## CLI Commands

| Command                  | Description                          |
| ------------------------ | ------------------------------------ |
| `copse`                    | Launch TUI                           |
| `copse list`               | List all worktrees (with focus info) |
| `copse add <branch>`       | Create worktree                      |
| `copse remove <branch>`    | Remove worktree                      |
| `copse switch <branch>`    | Switch to worktree                   |
| `copse clean`              | Remove merged worktrees              |
| `copse doctor`             | Check worktree health                |
| `copse config`             | Manage configuration                 |
| `copse exec <command>`     | Run command in each worktree         |
| `copse diff <ref1> [ref2]` | Diff between worktrees/branches      |
| `copse pin <branch>`       | Pin/unpin worktree (protect from cleanup) |
| `copse log`                | Show worktree activity log           |
| `copse archive <branch>`   | Archive changes and optionally remove |
| `copse rename <old> <new>` | Rename worktree branch               |
| `copse clone <url>`        | Clone repo and initialize copse        |
| `copse import <path>`      | Adopt worktree with copse metadata     |
| `copse session [branch]`   | Manage tmux sessions for worktrees   |
| `copse open [branch]`      | Open a worktree in your editor (focus-aware) |
| `copse init`               | Initialize config or install AI agent skills |

### `copse add`

```bash
copse add feature/login                        # Create branch if needed + worktree
copse add feature/login --base main            # New branches start from main
copse add existing-branch                      # Worktree for existing branch

# Monorepo: create with focus packages
copse add feature/login --focus apps/web,apps/api
copse add feature/login --focus apps/web --focus apps/api

# Use a template
copse add feature/login --template review

# Create from a GitHub PR (requires gh CLI)
copse add --pr 123
copse add --pr 456 --template review
```

### `copse doctor`

```bash
copse doctor              # Human-readable output
copse doctor --json       # JSON output for scripting
```

Exit code: `0` if healthy, `1` if any warnings or errors.

```
copse doctor

✓ Git version: 2.39.0 (>= 2.17 required)
✓ Configuration: valid
✓ Stale worktrees: none
✓ Orphaned directories: none
✓ Worktree locks: all clear
✓ Dirty worktrees: none

All checks passed.
```

### `copse list`

```bash
copse list                # Table with Focus column
copse list --json         # JSON with focus array
copse list --porcelain    # Machine-readable
```

Output includes a `Focus` column showing monorepo focus paths per worktree.

### `copse remove`

```bash
copse remove feature/login               # Remove by branch name
copse remove feature/login --force        # Force remove (dirty worktree)
copse remove feature/login --yes          # Skip confirmation
```

### `copse clean`

```bash
copse clean --dry-run    # Preview what would be removed
copse clean              # Remove all merged worktrees
copse clean --stale      # Also show stale worktrees (uses lifecycle config)
```

### `copse exec`

Run a shell command in every non-main worktree.

```bash
copse exec "bun test"                   # Run in all worktrees (sequential)
copse exec "bun test" --parallel        # Run in parallel
copse exec "git pull" --all             # Across all configured repos
copse exec "bun install" --dirty        # Only dirty worktrees
copse exec "git rebase main" --behind   # Only worktrees behind upstream
copse exec "bun test" --json            # JSON output
```

| Flag                | Description                           |
| ------------------- | ------------------------------------- |
| `--parallel` / `-p` | Run commands in parallel              |
| `--all` / `-a`      | Include all configured repos          |
| `--dirty`           | Only run in dirty worktrees           |
| `--clean`           | Only run in clean worktrees           |
| `--behind`          | Only run in worktrees behind upstream |
| `--json` / `-j`     | Output results as JSON                |

Environment variables available in commands: `COPSE_BRANCH`, `COPSE_WORKTREE_PATH`, `COPSE_REPO_PATH`.

### `copse diff`

Show diff between two worktree branches.

```bash
copse diff feature/a feature/b         # Full diff
copse diff feature/a feature/b --stat  # Diffstat summary
copse diff feature/a --name-only       # Changed file names only
copse diff feature/a                   # Compare against current HEAD
```

### `copse pin`

```bash
copse pin feature/auth --reason "active sprint"  # Pin with reason
copse pin --list                                  # List pinned worktrees
copse pin --list --json                           # JSON output
copse unpin feature/auth                          # Unpin
```

Pinned worktrees are excluded from `copse clean` and lifecycle auto-cleanup.

### `copse log`

```bash
copse log                # Show last 20 events
copse log --limit 50     # Show last 50 events
copse log --json         # JSON output
copse log --clear        # Clear activity log
```

Events are color-coded: create (green), delete (red), switch (blue), rename (yellow), archive (magenta), import (cyan).

### `copse archive`

```bash
copse archive feature/done --yes       # Archive and remove
copse archive feature/wip --keep       # Archive without removing
copse archive --list                   # List all archives
copse archive --list --json            # JSON output
```

Archives are stored as patch files in `~/.copse/archives/`.

### `copse rename`

```bash
copse rename old-branch new-branch             # Rename branch
copse rename old-branch new-branch --move-path # Also move worktree directory
```

### `copse clone`

```bash
copse clone https://github.com/user/repo.git              # Clone and init
copse clone https://github.com/user/repo.git ./my-dir     # Custom target path
copse clone https://github.com/user/repo.git --template review # Apply template
copse clone https://github.com/user/repo.git --no-init-config  # Skip config init
```

### `copse import`

```bash
copse import /path/to/worktree                           # Adopt worktree
copse import /path/to/worktree --focus apps/web,apps/api # With focus
copse import /path/to/worktree --pin                     # Pin immediately
```

### `copse session`

Manage tmux sessions for worktrees. Requires tmux.

```bash
copse session feature/auth              # Open/attach session (create if needed)
copse session feature/auth --layout api # Use named layout from config
copse session --list                    # List active copse sessions
copse session --list --json             # JSON output
copse session feature/auth --kill       # Kill session for worktree
copse session --kill-all                # Kill all copse sessions
```

Sessions are auto-created/killed when `sessions.autoCreate` / `sessions.autoKill` are enabled in config.

```bash
# Create worktree with tmux session
copse add feature/login --session
copse add feature/login --session --layout api
```

When `sessions.enabled` is `true` and you're inside tmux, `copse switch` automatically switches to the target worktree's tmux session.

### `copse open`

Open a worktree in your editor or IDE. Auto-detects `$VISUAL` / `$EDITOR` and falls back to a known list (`code`, `cursor`, `vim`, `nvim`, `emacs`, `nano`, `subl`, `zed`, `idea`, `webstorm`).

```bash
copse open                              # Open the current worktree
copse open feature/auth                 # Open a specific worktree
copse open feature/auth -e nvim         # Override editor

# Focus-aware behavior (when the worktree was created with --focus)
copse open feature/auth                 # 1 focus path → opens that focus
                                      # 2+ focus paths → errors with hint
copse open feature/auth --focus apps/web   # Pick a specific focus path
copse open feature/auth -f apps/api        # Same with the short alias
copse open feature/auth --root             # Force the worktree root, ignore focus

copse open --list-editors               # List detected editors
```

| Flag | Alias | Description |
| ---- | ----- | ----------- |
| `--editor` | `-e` | Editor command to use (overrides `$VISUAL`/`$EDITOR`) |
| `--focus` | `-f` | Open a specific focus path (must match a focus entry on the worktree) |
| `--root` | | Force the worktree root, ignoring any focus paths |
| `--list-editors` | | List detected editors |

**Focus resolution rules:**

- 0 focus paths set → opens the worktree root.
- 1 focus path set → opens `<worktree>/<focus>` automatically.
- 2+ focus paths set → errors out and asks for `--focus <path>` or `--root` (the TUI shows an interactive picker instead).

### `copse init`

Initialize copse config by default, or install copse skill for AI coding agents so they can use copse commands.

```bash
copse init                         # → ~/.config/copse/config.json
copse init --skill claude-code   # → ~/.claude/skills/copse/
copse init --skill codex          # → ~/.agents/skills/copse/
copse init --skill opencode       # → ~/.config/opencode/skill/copse/
```

| Platform | Skill Path |
|----------|-----------|
| `claude-code` | `~/.claude/skills/copse/` |
| `codex` | `~/.agents/skills/copse/` |
| `opencode` | `~/.config/opencode/skill/copse/` |

Each skill directory contains:
- `SKILL.md` — overview and common workflows
- `references/` — detailed per-command documentation (21 files)

Without `--skill`, the command reuses the normal config initializer and creates only `config.json`.
The command is idempotent — running it again updates the skill directory.

#### Auto-init on first run

You don't have to run `copse init` manually. The first time you run any `copse` command (including launching the TUI), if `~/.config/copse/config.json` does not exist, copse creates it with the default template and prints a one-line notice to stderr:

```
copse: created default config at /Users/you/.config/copse/config.json
```

The notice is suppressed when stdout is not a TTY (so pipes, scripts, and CI stay quiet) and when you run `copse init` explicitly (to avoid duplicate messages with init's own success line). Auto-init is fully idempotent — subsequent runs do nothing.

## Configuration

Config file: `~/.config/copse/config.json`

Initialize with: `copse config --init` (or just run any `copse` command — see [Auto-init on first run](#auto-init-on-first-run))

### Full Example

```json
{
  "$schema": "https://raw.githubusercontent.com/getsolaris/copse/main/schema.json",
  "version": 1,
  "theme": "dracula",
  "defaults": {
    "worktreeDir": "~/.copse/worktrees/{repo}-{branch}",
    "copyFiles": [".env"],
    "linkFiles": ["node_modules"],
    "postCreate": ["bun install"],
    "postRemove": [],
    "sharedDeps": {
      "strategy": "hardlink",
      "paths": ["node_modules"],
      "invalidateOn": ["package.json", "bun.lockb"]
    }
  },
  "templates": {
    "review": {
      "copyFiles": [".env.local"],
      "postCreate": ["bun install", "bun run build"],
      "autoUpstream": true
    },
    "hotfix": {
      "base": "main",
      "copyFiles": [".env.production"],
      "postCreate": ["bun install"]
    },
    "experiment": {
      "worktreeDir": "~/tmp/experiments/{branch}",
      "postRemove": []
    }
  },
  "lifecycle": {
    "autoCleanMerged": true,
    "staleAfterDays": 14,
    "maxWorktrees": 10
  },
  "sessions": {
    "enabled": true,
    "autoCreate": false,
    "autoKill": true,
    "prefix": "copse",
    "defaultLayout": "dev",
    "layouts": {
      "dev": {
        "windows": [
          { "name": "editor", "command": "$EDITOR ." },
          { "name": "dev", "command": "bun dev" },
          { "name": "test", "command": "bun test --watch" }
        ]
      },
      "minimal": {
        "windows": [
          { "name": "shell" }
        ]
      }
    }
  },
  "workspaces": [
    {
      "path": "~/Desktop/work",
      "depth": 1,
      "exclude": ["node_modules", ".cache", "archived"],
      "defaults": {
        "copyFiles": [".env", ".env.local"],
        "linkFiles": ["node_modules"],
        "postCreate": ["bun install"],
        "autoUpstream": true
      }
    }
  ],
  "repos": [
    {
      "path": "/Users/me/dev/frontend",
      "copyFiles": [".env", ".env.local"],
      "linkFiles": ["node_modules", ".next"],
      "postCreate": ["bun install", "bun run build"]
    },
    {
      "path": "/Users/me/dev/backend",
      "copyFiles": [".env"],
      "postCreate": ["pip install -r requirements.txt"]
    },
    {
      "path": "/Users/me/dev/monorepo",
      "copyFiles": [".env"],
      "postCreate": ["pnpm install"],
      "monorepo": {
        "autoDetect": true,
        "extraPatterns": ["apps/*/*"],
        "hooks": [
          {
            "glob": "apps/web",
            "copyFiles": [".env"],
            "postCreate": ["cd {packagePath} && pnpm install"]
          },
          {
            "glob": "apps/api",
            "copyFiles": [".env"],
            "linkFiles": ["node_modules"],
            "postCreate": ["cd {packagePath} && pnpm install && pnpm build"]
          }
        ]
      }
    }
  ]
}
```

### Config Fields

#### `defaults`

All repos inherit these unless overridden.

| Field         | Type       | Default                            | Description                             |
| ------------- | ---------- | ---------------------------------- | --------------------------------------- |
| `worktreeDir` | `string`   | `~/.copse/worktrees/{repo}-{branch}` | Worktree directory pattern              |
| `copyFiles`   | `string[]` | `[]`                               | Files to copy from main repo            |
| `linkFiles`   | `string[]` | `[]`                               | Files/dirs to symlink (saves disk)      |
| `postCreate`  | `string[]` | `[]`                               | Commands to run after worktree creation |
| `postRemove`  | `string[]` | `[]`                               | Commands to run before worktree removal |

#### `repos[]`

Per-repo overrides. Each entry requires `path`.

| Field         | Type       | Required | Description                         |
| ------------- | ---------- | -------- | ----------------------------------- |
| `path`        | `string`   | Yes      | Absolute path to the repository     |
| `worktreeDir` | `string`   | No       | Override default worktree directory |
| `copyFiles`   | `string[]` | No       | Override default copy files         |
| `linkFiles`   | `string[]` | No       | Override default link files         |
| `postCreate`  | `string[]` | No       | Override default post-create hooks  |
| `postRemove`  | `string[]` | No       | Override default post-remove hooks  |
| `monorepo`    | `object`   | No       | Monorepo support config             |

#### `workspaces[]`

Auto-discover git repositories under parent directories. Each discovered repo is merged into `repos[]` at load time with the workspace's `defaults` as its override layer.

```json
{
  "workspaces": [
    {
      "path": "~/Desktop/work",
      "depth": 1,
      "exclude": ["node_modules", ".cache", "archived"],
      "defaults": {
        "copyFiles": [".env", ".env.local"],
        "linkFiles": ["node_modules"],
        "postCreate": ["bun install"],
        "autoUpstream": true
      }
    }
  ]
}
```

| Field      | Type       | Required | Default | Description                                                                    |
| ---------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------ |
| `path`     | `string`   | Yes      | —       | Parent directory to scan. Supports `~` expansion.                              |
| `depth`    | `integer`  | No       | `1`     | Scan depth (1–3). `1` means immediate children only.                           |
| `exclude`  | `string[]` | No       | `[]`    | Glob patterns matched against directory names to skip (e.g. `node_modules`).   |
| `defaults` | `object`   | No       | —       | Per-repo defaults applied to every discovered repo. Same fields as `defaults`. |

**Discovery rules:**

- A directory is a repo only if it contains a `.git` **directory** (not a file). Linked worktrees (`.git` as file) and submodules are skipped.
- Discovered repos do NOT have their children scanned (no recursion into repos).
- Symbolic links are not followed.
- Discovery runs on every `loadConfig()` call. There is no caching.

**Precedence (highest → lowest):**

1. Explicit `repos[]` entry with the same resolved path — wins entirely.
2. `workspaces[].defaults` — repo-level override layer.
3. Top-level `defaults`.
4. Built-in defaults.

**`workspaces[].defaults` does NOT support `monorepo`.** If you need monorepo hooks for a discovered repo, add an explicit `repos[]` entry for it.

**TUI display:** The Config view (Ctrl+P → Open Config) shows the file *as authored*. Workspace-discovered repos appear under their own `Workspaces (N)` section, not under `Repos (N)`. The `Repos` count therefore reflects only your explicit `repos[]` entries, even when workspace discovery is adding more repos at runtime. Editing any field via the Config view writes back the raw, user-authored shape — auto-discovered repos are never serialized into `repos[]` on disk.

#### `monorepo`

Universal monorepo support. Auto-detects packages from workspace config files and supports per-package hooks.

```json
{
  "monorepo": {
    "autoDetect": true,
    "extraPatterns": ["apps/*/*"],
    "hooks": [
      {
        "glob": "apps/mobile/*",
        "copyFiles": [".env"],
        "linkFiles": ["node_modules"],
        "postCreate": ["cd {packagePath} && pnpm install"]
      }
    ]
  }
}
```

| Field           | Type       | Default | Description                               |
| --------------- | ---------- | ------- | ----------------------------------------- |
| `autoDetect`    | `boolean`  | `true`  | Auto-detect monorepo tools                |
| `extraPatterns` | `string[]` | `[]`    | Extra glob patterns for package discovery |
| `hooks`         | `array`    | `[]`    | Per-package hook definitions              |

**Auto-detection** supports: pnpm workspaces, Turborepo, Nx, Lerna, npm/yarn workspaces.

**`extraPatterns`** catches packages not covered by auto-detection. For example, if your `pnpm-workspace.yaml` only covers `packages/*` but you also have apps at `apps/frontend/dashboard`, use `extraPatterns: ["apps/*/*"]`.

#### `monorepo.hooks[]`

Per-package hooks matched by glob pattern against focus paths.

| Field        | Type       | Required | Description                                                                    |
| ------------ | ---------- | -------- | ------------------------------------------------------------------------------ |
| `glob`       | `string`   | Yes      | Glob to match focus paths (e.g. `apps/*`, `apps/mobile/*`)                      |
| `copyFiles`  | `string[]` | No       | Files to copy within the matched package directory                             |
| `linkFiles`  | `string[]` | No       | Files/dirs to symlink within the matched package directory                     |
| `postCreate` | `string[]` | No       | Commands to run after creation. Supports `{packagePath}`, `{repo}`, `{branch}` |
| `postRemove` | `string[]` | No       | Commands to run before removal                                                 |

Hooks execute in declaration order, after the repo-level `postCreate`/`postRemove`.

**`copyFiles`/`linkFiles` in hooks** operate on the **package subdirectory**, not the repo root. For example, with `glob: "apps/mobile/*"` and `copyFiles: [".env"]`, the `.env` file is copied from `<main-repo>/apps/mobile/ios/.env` to `<worktree>/apps/mobile/ios/.env`.

#### `templates`

Named presets for worktree creation. Each template can override any default field.

```json
{
  "templates": {
    "review": {
      "copyFiles": [".env.local"],
      "postCreate": ["bun install", "bun run build"],
      "autoUpstream": true
    },
    "hotfix": {
      "base": "main",
      "copyFiles": [".env.production"],
      "postCreate": ["bun install"]
    }
  }
}
```

| Field          | Type       | Description                        |
| -------------- | ---------- | ---------------------------------- |
| `worktreeDir`  | `string`   | Override worktree directory        |
| `copyFiles`    | `string[]` | Override files to copy             |
| `linkFiles`    | `string[]` | Override files to symlink          |
| `postCreate`   | `string[]` | Override post-create hooks         |
| `postRemove`   | `string[]` | Override post-remove hooks         |
| `autoUpstream` | `boolean`  | Override upstream tracking         |
| `base`         | `string`   | Default base branch for newly created branches |

Usage: `copse add feature/login --template review`

Template values override the resolved repo config. The `base` field sets a default for `--base` if not explicitly provided.

#### `lifecycle`

Automatic worktree lifecycle management. Used by `copse clean --stale`.

```json
{
  "lifecycle": {
    "autoCleanMerged": true,
    "staleAfterDays": 14,
    "maxWorktrees": 10
  }
}
```

| Field             | Type      | Default | Description                                 |
| ----------------- | --------- | ------- | ------------------------------------------- |
| `autoCleanMerged` | `boolean` | `false` | Flag merged worktrees for cleanup           |
| `staleAfterDays`  | `number`  | —       | Days of inactivity before flagging as stale |
| `maxWorktrees`    | `number`  | —       | Warn when exceeding this count              |

#### Config Profiles

Switch between different configuration sets.

```bash
copse config --profiles                    # List profiles
copse config --profile work --activate     # Activate profile
copse config --profile personal --delete   # Delete profile
```

#### `sessions`

Tmux session management for worktrees.

```json
{
  "sessions": {
    "enabled": true,
    "autoCreate": true,
    "autoKill": true,
    "prefix": "copse",
    "defaultLayout": "dev",
    "layouts": {
      "dev": {
        "windows": [
          { "name": "editor", "command": "$EDITOR ." },
          { "name": "dev", "command": "bun dev" },
          { "name": "test", "command": "bun test --watch" }
        ]
      }
    }
  }
}
```

| Field           | Type      | Default | Description                                        |
| --------------- | --------- | ------- | -------------------------------------------------- |
| `enabled`       | `boolean` | `false` | Enable session integration (auto-switch in tmux)   |
| `autoCreate`    | `boolean` | `false` | Auto-create tmux session on `copse add`              |
| `autoKill`      | `boolean` | `false` | Auto-kill tmux session on `copse remove`             |
| `prefix`        | `string`  | `"copse"` | Prefix for tmux session names                      |
| `defaultLayout` | `string`  | —       | Default layout name for new sessions               |
| `layouts`       | `object`  | `{}`    | Named layouts with window definitions              |

**Layout windows:**

| Field     | Type     | Required | Description                    |
| --------- | -------- | -------- | ------------------------------ |
| `name`    | `string` | Yes      | Window name                    |
| `command` | `string` | No       | Command to run in the window   |

Session naming: branch `feat/auth-token` → tmux session `copse_feat-auth-token`.

#### `sharedDeps`

Share dependencies between main repo and worktrees to save disk space. Can be set in `defaults` or per-repo.

```json
{
  "defaults": {
    "sharedDeps": {
      "strategy": "hardlink",
      "paths": ["node_modules"],
      "invalidateOn": ["package.json", "bun.lockb"]
    }
  }
}
```

| Field          | Type       | Default     | Description                                |
| -------------- | ---------- | ----------- | ------------------------------------------ |
| `strategy`     | `string`   | `"symlink"` | `"hardlink"`, `"symlink"`, or `"copy"`     |
| `paths`        | `string[]` | `[]`        | Directories/files to share                 |
| `invalidateOn` | `string[]` | `[]`        | Files that trigger re-sharing when changed |

**Strategies:**

- `hardlink` — Create hard links for each file (saves disk, each worktree can modify independently for files that get rewritten)
- `symlink` — Create a symlink to the source directory (most disk savings, shared state)
- `copy` — Fall back to regular copy

### `--focus` Flag

Track which monorepo packages a worktree is working on.

```bash
copse add feature/login --focus apps/web,apps/api
```

- Supports comma-separated, space-separated, or multiple `--focus` flags
- Focus metadata is stored in git internals (not in the worktree root)
- `copse list` shows focus paths per worktree
- Monorepo hooks only fire for matching focus paths
- Focus is optional — omitting it creates a normal worktree

### Template Variables

Available in `worktreeDir` and monorepo hook commands:

| Variable        | Description                                | Example        |
| --------------- | ------------------------------------------ | -------------- |
| `{repo}`        | Repository directory name                  | `my-app`       |
| `{branch}`      | Branch name (`/` replaced with `-`)        | `feature-auth` |
| `{packagePath}` | Matched package path (monorepo hooks only) | `apps/web`     |
| `~`             | Home directory (only at path start)        | `/Users/me`    |

### Priority

Per-repo settings completely replace defaults (no merging):

```
repos[].copyFiles exists?  →  use repos[].copyFiles
repos[].copyFiles missing? →  use defaults.copyFiles
defaults.copyFiles missing? → use [] (empty)
```

### Themes

Set via config or command palette (`Ctrl+P`):

```json
{ "theme": "tokyo-night" }
```

Available: `opencode`, `tokyo-night`, `dracula`, `nord`, `catppuccin`, `github-dark`, `one-dark`, `monokai`, `github-light`

## Shell Integration

Use `copse shell-init` to install shell integration for `copse switch`.

### Completions

```bash
# Add completions (bash)
eval "$(copse shell-init --completions bash)"

# Add completions (zsh)
eval "$(copse shell-init --completions zsh)"

# Add completions (fish)
copse shell-init --completions fish | source
```

### Examples

```bash
# zsh
echo 'eval "$(copse shell-init zsh)"' >> ~/.zshrc
source ~/.zshrc

# bash
echo 'eval "$(copse shell-init bash)"' >> ~/.bashrc
source ~/.bashrc

# fish
copse shell-init fish >> ~/.config/fish/config.fish
source ~/.config/fish/config.fish
```

You can also preview the generated wrapper before saving it:

```bash
copse shell-init zsh
```

## License

MIT © getsolaris
