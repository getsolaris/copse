# copse pin

Pin or unpin a worktree. Pinned worktrees are excluded from auto-cleanup operations.

## Usage

```
copse pin [branch]
copse unpin [branch]
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--reason` | | Reason for pinning |
| `--list` | | List all pinned worktrees |
| `--json` | `-j` | Output as JSON |
| `--unpin` | | Unpin instead of pinning |

## Examples

### Pin the current worktree

```bash
copse pin
```

### Pin a specific worktree

```bash
copse pin feature/login
```

### Pin with a reason

```bash
copse pin feature/login --reason "long-running feature, do not clean"
```

### List all pinned worktrees

```bash
copse pin --list
```

### List pinned worktrees as JSON

```bash
copse pin --list --json
```

### Unpin a worktree

```bash
copse unpin feature/login
```

### Unpin using the flag

```bash
copse pin feature/login --unpin
```
