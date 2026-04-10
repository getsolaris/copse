# copse clean

Remove merged worktrees and prune stale entries.

## Usage

```
copse clean
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--dry-run` | `-n` | Show what would be removed without removing |
| `--yes` | `-y` | Skip confirmation prompt |
| `--stale` | | Also show stale worktrees (based on lifecycle config) |

## Examples

### Preview what would be cleaned

```bash
copse clean --dry-run
```

### Clean merged worktrees

```bash
copse clean
```

### Clean without confirmation

```bash
copse clean -y
```

### Include stale worktrees in cleanup

```bash
copse clean --stale
```

### Preview stale worktrees without removing

```bash
copse clean --stale --dry-run
```
