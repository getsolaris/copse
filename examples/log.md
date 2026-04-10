# copse log

Show the worktree activity log. Tracks events like create, delete, switch, rename, archive, and import.

## Usage

```
copse log
copse logs
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
copse log
```

### Show the last 5 entries

```bash
copse log --limit 5
```

### Show the last 50 entries

```bash
copse log --limit 50
```

### Output as JSON

```bash
copse log --json
```

### Clear the activity log

```bash
copse log --clear
```

### Use the alias

```bash
copse logs
```
