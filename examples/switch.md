# omw switch

Switch to a worktree directory. Outputs a `cd` command for shell eval.

## Usage

```
omw switch <branch-or-path>
omw sw <branch-or-path>
```

## Prerequisites

Shell integration must be set up first. See [shell-init.md](shell-init.md).

## Examples

### Switch to a worktree by branch name

```bash
omw sw feature/login
```

### Switch using the full command name

```bash
omw switch feature/auth
```

### With shell integration (recommended)

After running `omw shell-init`, switching will automatically `cd` into the worktree:

```bash
# This changes your working directory to the worktree
omw sw feature/login
```

### Without shell integration

Without shell integration, you need to eval the output manually:

```bash
eval $(omw switch feature/login)
```
