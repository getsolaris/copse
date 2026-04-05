# omw session

Manage tmux sessions for worktrees. Requires tmux.

## Usage

```
omw session [branch-or-path]
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--list` | `-l` | List active omw tmux sessions |
| `--kill` | `-k` | Kill the session for the specified worktree |
| `--kill-all` | | Kill all omw tmux sessions |
| `--layout` | | Use a named layout from config |
| `--json` | `-j` | Output in JSON format |

## Examples

### Open a session for a worktree

```bash
omw session feature/auth
```

If a session exists, attaches to it. Otherwise creates one and attaches.

### Open with a specific layout

```bash
omw session feature/auth --layout api
```

### List active sessions

```bash
omw session --list
```

```
Active sessions (3):

  omw_feat-auth-token  feat/auth-token  3 windows [api]
  omw_feat-user-api    feat/user-api    3 windows [api] (attached)
  omw_fix-gateway      fix/gateway      1 windows
```

### List as JSON

```bash
omw session --list --json
```

### Kill a session

```bash
omw session feature/auth --kill
```

### Kill all omw sessions

```bash
omw session --kill-all
```

### Create worktree with session

```bash
omw add feature/login --session
omw add feature/login --session --layout api
```

### Auto-create/kill via config

```json
{
  "sessions": {
    "autoCreate": true,
    "autoKill": true,
    "defaultLayout": "dev",
    "layouts": {
      "dev": {
        "windows": [
          { "name": "editor", "command": "$EDITOR ." },
          { "name": "dev", "command": "bun dev" },
          { "name": "test", "command": "bun test --watch" }
        ]
      }
    }
  }
}
```

With `autoCreate: true`, every `omw add` automatically creates a tmux session.
With `autoKill: true`, every `omw remove` automatically kills the associated session.

### Auto-switch in tmux

With `sessions.enabled: true`, running `omw switch` inside tmux automatically switches to the target worktree's tmux session instead of outputting a `cd` command.
