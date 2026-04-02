# omw list

List all worktrees with their status.

## Usage

```
omw list
omw ls
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
omw list
```

### Use the short alias

```bash
omw ls
```

### Output as JSON (useful for scripting)

```bash
omw list --json
```

### Machine-readable output

```bash
omw list --porcelain
```

### List worktrees across all configured repos

```bash
omw list --all
```

### Pipe JSON output to jq for filtering

```bash
omw list --json | jq '.[] | select(.dirty == true)'
```
