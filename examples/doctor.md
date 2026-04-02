# omw doctor

Check worktree health and diagnose issues.

Runs checks for git version, config validity, stale worktrees, orphaned directories, lock status, and dirty worktrees.

## Usage

```
omw doctor
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--json` | `-j` | Output as JSON |
| `--fix` | | Auto-fix detected issues (prune stale, remove orphans, unlock stale locks) |

## Examples

### Run all health checks

```bash
omw doctor
```

### Auto-fix detected issues

```bash
omw doctor --fix
```

### Output results as JSON

```bash
omw doctor --json
```
