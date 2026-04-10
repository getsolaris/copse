# copse session

Manage tmux sessions for worktrees. Requires tmux.

## Usage

```
copse session [branch-or-path]
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--list` | `-l` | List active copse tmux sessions |
| `--kill` | `-k` | Kill the session for the specified worktree |
| `--kill-all` | | Kill all copse tmux sessions |
| `--layout` | | Use a named layout from config |
| `--json` | `-j` | Output in JSON format |

## Examples

### Open a session for a worktree

```bash
copse session feature/auth
```

If a session exists, attaches to it. Otherwise creates one and attaches.

### Open with a specific layout

```bash
copse session feature/auth --layout api
```

### List active sessions

```bash
copse session --list
```

```
Active sessions (3):

  copse_feat-auth-token  feat/auth-token  3 windows [api]
  copse_feat-user-api    feat/user-api    3 windows [api] (attached)
  copse_fix-gateway      fix/gateway      1 windows
```

### List as JSON

```bash
copse session --list --json
```

### Kill a session

```bash
copse session feature/auth --kill
```

### Kill all copse sessions

```bash
copse session --kill-all
```

### Create worktree with session

```bash
copse add feature/login --session
copse add feature/login --session --layout api
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

With `autoCreate: true`, every `copse add` automatically creates a tmux session.
With `autoKill: true`, every `copse remove` automatically kills the associated session.

### Auto-switch in tmux

With `sessions.enabled: true`, running `copse switch` inside tmux automatically switches to the target worktree's tmux session instead of outputting a `cd` command.
