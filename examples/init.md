# omw init

Initialize omw config or install omw skill for AI coding agents.

## Usage

```
omw init
omw init --skill <platform>
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--skill` | `-s` | Install AI agent skill for the specified platform |

## Supported Platforms

| Platform | Skill Path |
|----------|-----------|
| `claude-code` | `~/.claude/skills/omw/SKILL.md` |
| `codex` | `~/.agents/skills/omw/SKILL.md` |
| `opencode` | `~/.config/opencode/skill/omw/SKILL.md` |

## Examples

### Initialize config only

```bash
omw init
# ✓ Initialized config → ~/.config/oh-my-worktree/config.json
```

### Install skill for Claude Code

```bash
omw init --skill claude-code
# ✓ Installed → ~/.claude/skills/omw/
#     SKILL.md
#     references/ (21 commands)
```

### Install skill for Codex

```bash
omw init --skill codex
# ✓ Installed → ~/.agents/skills/omw/
#     SKILL.md
#     references/ (21 commands)
```

### Install skill for OpenCode

```bash
omw init --skill opencode
# ✓ Installed → ~/.config/opencode/skill/omw/
#     SKILL.md
#     references/ (21 commands)
```

## Behavior

- **Without `--skill`**: Reuses config initialization and creates only `config.json`
- **First skill install**: Creates the skill directory and `SKILL.md` file
- **Subsequent skill installs**: Updates the skill files (idempotent)

All platforms use the same `SKILL.md` format with `name` and `description` frontmatter.
