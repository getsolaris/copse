# omw open

Open a worktree in your editor or IDE.

## Usage

```
omw open [branch-or-path]
```

If no argument is given, opens the current worktree.

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--editor` | `-e` | Editor command to use (overrides `$VISUAL`/`$EDITOR`) |
| `--list-editors` | | List detected editors on your system |

## Examples

### Open the current worktree in your default editor

```bash
omw open
```

### Open a specific worktree

```bash
omw open feature/login
```

### Open with a specific editor

```bash
omw open feature/login --editor code
```

### Open with a different IDE

```bash
omw open feature/login -e "webstorm"
```

### List available editors

```bash
omw open --list-editors
```
