# copse init

Initialize copse config or install copse skill for AI coding agents.

## Usage

```
copse init
copse init --skill <platform>
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--skill` | `-s` | Install AI agent skill for the specified platform |

## Supported Platforms

| Platform | Skill Path |
|----------|-----------|
| `claude-code` | `~/.claude/skills/copse/SKILL.md` |
| `codex` | `~/.agents/skills/copse/SKILL.md` |
| `opencode` | `~/.config/opencode/skill/copse/SKILL.md` |

## Examples

### Initialize config only

```bash
copse init
# ✓ Initialized config → ~/.config/copse/config.json
```

### Install skill for Claude Code

```bash
copse init --skill claude-code
# ✓ Installed → ~/.claude/skills/copse/
#     SKILL.md
#     references/ (21 commands)
```

### Install skill for Codex

```bash
copse init --skill codex
# ✓ Installed → ~/.agents/skills/copse/
#     SKILL.md
#     references/ (21 commands)
```

### Install skill for OpenCode

```bash
copse init --skill opencode
# ✓ Installed → ~/.config/opencode/skill/copse/
#     SKILL.md
#     references/ (21 commands)
```

## Behavior

- **Without `--skill`**: Reuses config initialization and creates only `config.json`
- **First skill install**: Creates the skill directory and `SKILL.md` file
- **Subsequent skill installs**: Updates the skill files (idempotent)

All platforms use the same `SKILL.md` format with `name` and `description` frontmatter.
