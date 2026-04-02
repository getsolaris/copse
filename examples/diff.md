# omw diff

Show diff between two worktrees or branches.

## Usage

```
omw diff <ref1> [ref2]
```

If `ref2` is omitted, it defaults to the current HEAD.

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--stat` | `-s` | Show diffstat summary only |
| `--name-only` | `-n` | Show only names of changed files |

## Examples

### Diff a branch against current HEAD

```bash
omw diff feature/login
```

### Diff between two branches

```bash
omw diff feature/login feature/auth
```

### Show only a summary of changes

```bash
omw diff feature/login --stat
```

### Show only changed file names

```bash
omw diff feature/login --name-only
```

### Compare two branches with stat summary

```bash
omw diff develop main --stat
```
