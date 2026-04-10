# copse import

Adopt an existing worktree into copse management with metadata tracking.

## Usage

```
copse import <path>
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--focus` | `-f` | Focus packages for monorepo (comma or space separated) |
| `--pin` | | Pin the worktree after importing |

## Examples

### Import an existing worktree

```bash
copse import ../my-project-feature
```

### Import with monorepo focus

```bash
copse import ../my-project-feature --focus @app/web,@app/api
```

### Import and pin immediately

```bash
copse import ../my-project-feature --pin
```

### Import with focus and pin

```bash
copse import ../my-project-hotfix --focus @app/core --pin
```
