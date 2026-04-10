# copse diff

Show diff between two worktrees or branches.

## Usage

```
copse diff <ref1> [ref2]
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
copse diff feature/login
```

### Diff between two branches

```bash
copse diff feature/login feature/auth
```

### Show only a summary of changes

```bash
copse diff feature/login --stat
```

### Show only changed file names

```bash
copse diff feature/login --name-only
```

### Compare two branches with stat summary

```bash
copse diff develop main --stat
```
