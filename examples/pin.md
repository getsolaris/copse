# omw pin

Pin or unpin a worktree. Pinned worktrees are excluded from auto-cleanup operations.

## Usage

```
omw pin [branch]
omw unpin [branch]
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
omw pin
```

### Pin a specific worktree

```bash
omw pin feature/login
```

### Pin with a reason

```bash
omw pin feature/login --reason "long-running feature, do not clean"
```

### List all pinned worktrees

```bash
omw pin --list
```

### List pinned worktrees as JSON

```bash
omw pin --list --json
```

### Unpin a worktree

```bash
omw unpin feature/login
```

### Unpin using the flag

```bash
omw pin feature/login --unpin
```
