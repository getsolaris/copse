# omw archive

Archive worktree changes as a patch file and optionally remove the worktree.

## Usage

```
omw archive [branch]
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
omw archive
```

### Archive a specific worktree

```bash
omw archive feature/experiment
```

### Archive without removing

```bash
omw archive feature/wip --keep
```

### Archive without confirmation

```bash
omw archive feature/old -y
```

### List all archives

```bash
omw archive --list
```

### List archives as JSON

```bash
omw archive --list --json
```
