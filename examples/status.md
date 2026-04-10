# copse status

Show a status overview of all worktrees.

## Usage

```
copse status
copse st
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--json` | `-j` | Output as JSON |
| `--all` | `-a` | Show worktrees from all configured repos |

## Examples

### Show status of all worktrees

```bash
copse status
```

### Use the short alias

```bash
copse st
```

### Output as JSON

```bash
copse status --json
```

### Show status across all configured repos

```bash
copse status --all
```

### Combine flags

```bash
copse st -a -j
```
