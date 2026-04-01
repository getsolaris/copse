# 🌳 oh-my-worktree

> Git worktree manager with a beautiful TUI — inspired by the oh-my-\* family

Manage git worktrees with ease. Create, switch, and clean up worktrees with config-driven automation, monorepo support, and built-in health checks.

## Features

- **TUI mode** — interactive terminal UI (`omw`)
- **CLI mode** — scriptable commands (`omw add`, `omw list`, etc.)
- **Config-driven** — per-repo hooks, file copying, symlinks
- **Monorepo support** — auto-detect packages, per-package hooks, focus tracking
- **Health checks** — `omw doctor` diagnoses worktree issues
- **Centralized worktrees** — all worktrees under `~/.omw/worktrees/` by default
- **Smart cleanup** — auto-detect and remove merged worktrees
- **Themes** — 6 built-in color themes (OpenCode, Tokyo Night, Dracula, Nord, Catppuccin, GitHub Dark)

## Requirements

- [Bun](https://bun.sh) runtime
- git 2.17+
- macOS or Linux

## Installation

### Homebrew (macOS/Linux)

```bash
brew tap getsolaris/tap
brew install oh-my-worktree
```

### curl (one-liner)

```bash
curl -fsSL https://raw.githubusercontent.com/getsolaris/oh-my-worktree/main/install.sh | bash
```

### npm / bun

```bash
bun install -g oh-my-worktree
# or
npm install -g oh-my-worktree
```

## Quick Start

```bash
# Launch TUI
omw

# List worktrees
omw list

# Create a new worktree
omw add feature/my-feature --create

# Create with monorepo focus
omw add feature/my-feature --create --focus apps/web,apps/api

# Check worktree health
omw doctor

# Switch to a worktree (requires shell integration)
omw switch feature/my-feature

# Remove a worktree
omw remove feature/my-feature --yes

# Clean up merged worktrees
omw clean --dry-run
```

## TUI Usage

Launch with `omw` (no arguments).

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate worktree list |
| `a` | Add worktree |
| `d` | Delete worktree |
| `h` | Doctor (health check) |
| `r` | Refresh list |
| `Ctrl+P` | Command palette |
| `?` | Help |
| `q` | Quit |

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
2. Type a branch name (e.g. `feature/my-feature`)
3. Press `Tab` to switch to the Focus field (optional)
4. Type focus paths (e.g. `apps/web,apps/api`)
5. Press `Enter` to preview
6. Press `Enter` to confirm

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

## CLI Commands

| Command | Description |
|---------|-------------|
| `omw` | Launch TUI |
| `omw list` | List all worktrees (with focus info) |
| `omw add <branch>` | Create worktree |
| `omw remove <branch>` | Remove worktree |
| `omw switch <branch>` | Switch to worktree |
| `omw clean` | Remove merged worktrees |
| `omw doctor` | Check worktree health |
| `omw config` | Manage configuration |

### `omw add`

```bash
omw add feature/auth --create               # Create new branch + worktree
omw add feature/auth --create --base main    # Branch from main
omw add existing-branch                      # Worktree for existing branch

# Monorepo: create with focus packages
omw add feature/auth --create --focus apps/web,apps/api
omw add feature/auth --create --focus apps/web --focus apps/api
```

### `omw doctor`

```bash
omw doctor              # Human-readable output
omw doctor --json       # JSON output for scripting
```

Exit code: `0` if healthy, `1` if any warnings or errors.

```
oh-my-worktree doctor

✓ Git version: 2.39.0 (>= 2.17 required)
✓ Configuration: valid
✓ Stale worktrees: none
✓ Orphaned directories: none
✓ Worktree locks: all clear
✓ Dirty worktrees: none

All checks passed.
```

### `omw list`

```bash
omw list                # Table with Focus column
omw list --json         # JSON with focus array
omw list --porcelain    # Machine-readable
```

Output includes a `Focus` column showing monorepo focus paths per worktree.

### `omw remove`

```bash
omw remove feature/auth               # Remove by branch name
omw remove feature/auth --force        # Force remove (dirty worktree)
omw remove feature/auth --yes          # Skip confirmation
```

### `omw clean`

```bash
omw clean --dry-run    # Preview what would be removed
omw clean              # Remove all merged worktrees
```

## Configuration

Config file: `~/.config/oh-my-worktree/config.json`

Initialize with: `omw config --init`

### Full Example

```json
{
  "$schema": "https://raw.githubusercontent.com/getsolaris/oh-my-worktree/main/schema.json",
  "version": 1,
  "theme": "dracula",
  "defaults": {
    "worktreeDir": "~/.omw/worktrees/{repo}-{branch}",
    "copyFiles": [".env"],
    "linkFiles": ["node_modules"],
    "postCreate": ["bun install"],
    "postRemove": []
  },
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

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `worktreeDir` | `string` | `~/.omw/worktrees/{repo}-{branch}` | Worktree directory pattern |
| `copyFiles` | `string[]` | `[]` | Files to copy from main repo |
| `linkFiles` | `string[]` | `[]` | Files/dirs to symlink (saves disk) |
| `postCreate` | `string[]` | `[]` | Commands to run after worktree creation |
| `postRemove` | `string[]` | `[]` | Commands to run before worktree removal |

#### `repos[]`

Per-repo overrides. Each entry requires `path`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | `string` | Yes | Absolute path to the repository |
| `worktreeDir` | `string` | No | Override default worktree directory |
| `copyFiles` | `string[]` | No | Override default copy files |
| `linkFiles` | `string[]` | No | Override default link files |
| `postCreate` | `string[]` | No | Override default post-create hooks |
| `postRemove` | `string[]` | No | Override default post-remove hooks |
| `monorepo` | `object` | No | Monorepo support config |

#### `monorepo`

Universal monorepo support. Auto-detects packages from workspace config files and supports per-package hooks.

```json
{
  "monorepo": {
    "autoDetect": true,
    "extraPatterns": ["apps/*/*"],
    "hooks": [
      {
        "glob": "apps/brand/*",
        "copyFiles": [".env"],
        "linkFiles": ["node_modules"],
        "postCreate": ["cd {packagePath} && pnpm install"]
      }
    ]
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `autoDetect` | `boolean` | `true` | Auto-detect monorepo tools |
| `extraPatterns` | `string[]` | `[]` | Extra glob patterns for package discovery |
| `hooks` | `array` | `[]` | Per-package hook definitions |

**Auto-detection** supports: pnpm workspaces, Turborepo, Nx, Lerna, npm/yarn workspaces.

**`extraPatterns`** catches packages not covered by auto-detection. For example, if your `pnpm-workspace.yaml` only covers `packages/*` but you also have apps at `apps/core/auth`, use `extraPatterns: ["apps/*/*"]`.

#### `monorepo.hooks[]`

Per-package hooks matched by glob pattern against focus paths.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `glob` | `string` | Yes | Glob to match focus paths (e.g. `apps/*`, `apps/brand/*`) |
| `copyFiles` | `string[]` | No | Files to copy within the matched package directory |
| `linkFiles` | `string[]` | No | Files/dirs to symlink within the matched package directory |
| `postCreate` | `string[]` | No | Commands to run after creation. Supports `{packagePath}`, `{repo}`, `{branch}` |
| `postRemove` | `string[]` | No | Commands to run before removal |

Hooks execute in declaration order, after the repo-level `postCreate`/`postRemove`.

**`copyFiles`/`linkFiles` in hooks** operate on the **package subdirectory**, not the repo root. For example, with `glob: "apps/brand/*"` and `copyFiles: [".env"]`, the `.env` file is copied from `<main-repo>/apps/brand/site/.env` to `<worktree>/apps/brand/site/.env`.

### `--focus` Flag

Track which monorepo packages a worktree is working on.

```bash
omw add feature/auth --create --focus apps/web,apps/api
```

- Supports comma-separated, space-separated, or multiple `--focus` flags
- Focus metadata is stored in git internals (not in the worktree root)
- `omw list` shows focus paths per worktree
- Monorepo hooks only fire for matching focus paths
- Focus is optional — omitting it creates a normal worktree

### Template Variables

Available in `worktreeDir` and monorepo hook commands:

| Variable | Description | Example |
|----------|-------------|---------|
| `{repo}` | Repository directory name | `my-app` |
| `{branch}` | Branch name (`/` replaced with `-`) | `feature-auth` |
| `{packagePath}` | Matched package path (monorepo hooks only) | `apps/web` |
| `~` | Home directory (only at path start) | `/Users/me` |

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

Available: `opencode`, `tokyo-night`, `dracula`, `nord`, `catppuccin`, `github-dark`

## Shell Integration

For `omw switch` to change your current directory, add this to `~/.zshrc` or `~/.bashrc`:

```bash
omw() {
  if [ "$1" = "switch" ] || [ "$1" = "sw" ]; then
    local output
    output=$(command omw "$@" 2>/dev/null)
    if [[ "$output" == cd\ * ]]; then
      eval "$output"
    else
      command omw "$@"
    fi
  else
    command omw "$@"
  fi
}
```

## License

MIT © getsolaris
