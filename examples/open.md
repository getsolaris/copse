# copse open

Open a worktree in your editor or IDE. Auto-detects `$VISUAL` / `$EDITOR` and falls back to a known list of editors (`code`, `cursor`, `vim`, `nvim`, `emacs`, `nano`, `subl`, `zed`, `idea`, `webstorm`).

## Usage

```
copse open [branch-or-path]
```

If no argument is given, opens the current worktree.

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--editor` | `-e` | Editor command to use (overrides `$VISUAL`/`$EDITOR`) |
| `--focus` | `-f` | Open a specific focus path (must match a focus entry on the worktree) |
| `--root` | | Force the worktree root, ignoring any focus paths |
| `--list-editors` | | List detected editors on your system |

## Focus-aware behavior

`copse open` is aware of the focus paths set when a worktree is created with `--focus`:

- **0 focus paths set** → opens the worktree root (default behavior).
- **Exactly 1 focus path set** → opens `<worktree>/<focus>` automatically.
- **2+ focus paths set** → exits with an error and asks you to pick one with `--focus <path>` or fall back to `--root`. (The TUI shows an interactive picker on `o` instead.)

## Examples

### Open the current worktree in your default editor

```bash
copse open
```

### Open a specific worktree

```bash
copse open feature/login
```

### Open with a specific editor

```bash
copse open feature/login --editor code
```

### Open with a different IDE

```bash
copse open feature/login -e "webstorm"
```

### Open a worktree that has a single focus path

```bash
copse add feature/web --focus apps/web
copse open feature/web
# → opens <worktree>/apps/web automatically
```

### Open a specific focus path on a multi-focus worktree

```bash
copse add feature/full --focus apps/web,apps/api
copse open feature/full
# → Error: worktree has multiple focus paths set: apps/web, apps/api
#          Use --focus <path> to pick one, or --root to open the worktree root.

copse open feature/full --focus apps/api
# → opens <worktree>/apps/api

copse open feature/full -f apps/web
# → opens <worktree>/apps/web
```

### Force the worktree root, ignoring focus

```bash
copse open feature/full --root
# → opens <worktree> (the repo root inside the worktree)
```

### List available editors

```bash
copse open --list-editors
```
