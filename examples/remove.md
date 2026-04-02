# omw remove

Remove a worktree.

## Usage

```
omw remove <branch-or-path>
omw rm <branch-or-path>
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--force` | `-f` | Force removal even with uncommitted changes |
| `--yes` | `-y` | Skip confirmation prompt |

## Examples

### Remove a worktree by branch name

```bash
omw remove feature/login
```

### Use the short alias

```bash
omw rm feature/login
```

### Force remove a worktree with uncommitted changes

```bash
omw rm feature/experiment -f
```

### Skip the confirmation prompt

```bash
omw rm feature/old-branch -y
```

### Force remove without any prompts

```bash
omw rm feature/abandoned -f -y
```
