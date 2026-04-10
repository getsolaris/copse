# copse remove

Remove a worktree.

## Usage

```
copse remove <branch-or-path>
copse rm <branch-or-path>
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--force` | `-f` | Force removal even with uncommitted changes |
| `--yes` | `-y` | Skip confirmation prompt |

## Examples

### Remove a worktree by branch name

```bash
copse remove feature/login
```

### Use the short alias

```bash
copse rm feature/login
```

### Force remove a worktree with uncommitted changes

```bash
copse rm feature/experiment -f
```

### Skip the confirmation prompt

```bash
copse rm feature/old-branch -y
```

### Force remove without any prompts

```bash
copse rm feature/abandoned -f -y
```
