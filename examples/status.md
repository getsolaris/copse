# omw status

Show a status overview of all worktrees.

## Usage

```
omw status
omw st
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--json` | `-j` | Output as JSON |
| `--all` | `-a` | Show worktrees from all configured repos |

## Examples

### Show status of all worktrees

```bash
omw status
```

### Use the short alias

```bash
omw st
```

### Output as JSON

```bash
omw status --json
```

### Show status across all configured repos

```bash
omw status --all
```

### Combine flags

```bash
omw st -a -j
```
