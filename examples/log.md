# omw log

Show the worktree activity log. Tracks events like create, delete, switch, rename, archive, and import.

## Usage

```
omw log
omw logs
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--limit` | | Number of entries to show (default: 20) |
| `--json` | `-j` | Output as JSON |
| `--clear` | | Clear the activity log |

## Examples

### Show recent activity

```bash
omw log
```

### Show the last 5 entries

```bash
omw log --limit 5
```

### Show the last 50 entries

```bash
omw log --limit 50
```

### Output as JSON

```bash
omw log --json
```

### Clear the activity log

```bash
omw log --clear
```

### Use the alias

```bash
omw logs
```
