# omw exec

Run a command in each worktree.

## Usage

```
omw exec <command>
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--all` | `-a` | Run across all configured repos |
| `--dirty` | | Only run in dirty worktrees |
| `--clean` | | Only run in clean worktrees |
| `--behind` | | Only run in worktrees behind upstream |
| `--parallel` | `-p` | Run commands in parallel (default: sequential) |
| `--json` | `-j` | Output results as JSON |

## Examples

### Run a command in every worktree

```bash
omw exec "git status"
```

### Run only in dirty worktrees

```bash
omw exec "git stash" --dirty
```

### Run only in clean worktrees

```bash
omw exec "git pull" --clean
```

### Run only in worktrees behind upstream

```bash
omw exec "git pull --rebase" --behind
```

### Run in parallel for faster execution

```bash
omw exec "npm install" --parallel
```

### Run across all configured repos

```bash
omw exec "git fetch" --all
```

### Output results as JSON

```bash
omw exec "git log -1 --oneline" --json
```

### Combine filters with parallel execution

```bash
omw exec "npm test" --dirty --parallel
```
