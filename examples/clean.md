# omw clean

Remove merged worktrees and prune stale entries.

## Usage

```
omw clean
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
omw clean --dry-run
```

### Clean merged worktrees

```bash
omw clean
```

### Clean without confirmation

```bash
omw clean -y
```

### Include stale worktrees in cleanup

```bash
omw clean --stale
```

### Preview stale worktrees without removing

```bash
omw clean --stale --dry-run
```
