# copse archive

Archive worktree changes as a patch file and optionally remove the worktree.

## Usage

```
copse archive [branch]
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--yes` | `-y` | Skip confirmation prompt |
| `--keep` | | Archive without removing the worktree |
| `--list` | | List all archives |
| `--json` | `-j` | Output as JSON (with `--list`) |

## Examples

### Archive and remove the current worktree

```bash
copse archive
```

### Archive a specific worktree

```bash
copse archive feature/experiment
```

### Archive without removing

```bash
copse archive feature/wip --keep
```

### Archive without confirmation

```bash
copse archive feature/old -y
```

### List all archives

```bash
copse archive --list
```

### List archives as JSON

```bash
copse archive --list --json
```
