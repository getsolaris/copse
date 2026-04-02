# omw add

Create a new worktree for a branch.

## Usage

```
omw add <branch> [path]
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--create` | `-c` | Create the branch if it doesn't exist |
| `--base` | `-b` | Base branch or commit for the new branch |
| `--focus` | `-f` | Focus packages for monorepo (comma or space separated) |
| `--template` | `-t` | Use a named template from config |
| `--pr` | | Create worktree from a GitHub PR number (requires `gh` CLI) |

## Examples

### Create a worktree for an existing branch

```bash
omw add feature/login
```

### Create a worktree with a new branch

```bash
omw add feature/auth -c
```

### Create a new branch based on a specific branch

```bash
omw add feature/api -c --base develop
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
omw add feature/dashboard -c --template frontend
```

### Focus on specific monorepo packages

```bash
omw add feature/auth -c --focus @app/web,@app/api
```

### Combine multiple options

```bash
omw add feature/payments -c --base main --focus @app/billing --template backend
```
