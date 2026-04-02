# omw rename

Rename a worktree's branch.

## Usage

```
omw rename <old> <new>
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--move-path` | | Also rename the worktree directory path |

## Examples

### Rename a branch

```bash
omw rename feature/old-name feature/new-name
```

### Rename a branch and move the directory

```bash
omw rename feature/login feature/authentication --move-path
```
