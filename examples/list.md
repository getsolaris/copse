# copse list

List all worktrees with their status.

## Usage

```
copse list
copse ls
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--json` | `-j` | Output as JSON |
| `--porcelain` | `-p` | Machine-readable output |
| `--all` | `-a` | List worktrees from all configured repos |

## Examples

### List worktrees in the current repo

```bash
copse list
```

### Use the short alias

```bash
copse ls
```

### Output as JSON (useful for scripting)

```bash
copse list --json
```

### Machine-readable output

```bash
copse list --porcelain
```

### List worktrees across all configured repos

```bash
copse list --all
```

### Pipe JSON output to jq for filtering

```bash
copse list --json | jq '.[] | select(.dirty == true)'
```
