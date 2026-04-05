# omw add

Create a new worktree for a branch.

## Usage

```
omw add <branch> [path]
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--create` | `-c` | Optional compatibility flag; missing branches are created automatically |
| `--base` | `-b` | Base branch or commit for the new branch |
| `--focus` | `-f` | Focus packages for monorepo (comma or space separated) |
| `--template` | `-t` | Use a named template from config |
| `--pr` | | Create worktree from a GitHub PR number (requires `gh` CLI) |
| `--session` | `-s` | Create a tmux session for this worktree |
| `--layout` | | Session layout name from config |

## Examples

### Create a worktree for an existing branch

```bash
omw add feature/login
```

### Create a worktree with a new branch

```bash
omw add feature/auth
```

### Create a new branch based on a specific branch

```bash
omw add feature/api --base develop
```

### Specify a custom path for the worktree

```bash
omw add feature/login ../my-project-login
```

### Create a worktree from a GitHub PR

```bash
omw add --pr 42
```

### Use a config template

```bash
omw add feature/dashboard --template frontend
```

### Focus on specific monorepo packages

```bash
omw add feature/auth --focus @app/web,@app/api
```

### Combine multiple options

```bash
omw add feature/payments --base main --focus @app/billing --template backend
```

### Create a worktree with a tmux session

```bash
omw add feature/review --session --layout dev
```

`--create` remains supported for backward compatibility, but new branches are now created automatically when missing.
