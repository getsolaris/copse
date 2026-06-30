# copse update

Check for and install copse updates.

Update checks are explicit and prompt-driven. copse does not run a background daemon, does not send telemetry, and never performs a silent update.

## Usage

```
copse update [flags]
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--check` | | Check for updates without installing |
| `--yes` | `-y` | Install without prompting |
| `--json` | `-j` | Output as JSON |
| `--ignore` | | Ignore the current latest version |

## Examples

### Check without installing

```bash
copse update --check
```

### Install after confirmation

```bash
copse update
```

### Install non-interactively

```bash
copse update --yes
```

### Use JSON output

```bash
copse update --check --json
```

### Ignore the current latest version

```bash
copse update --ignore
```

This writes `updates.ignoredVersion` in `~/.config/copse/config.json`.

## Install routing

- Homebrew installs run `brew upgrade getsolaris/tap/copse`.
- Bun global installs run `bun install -g @getsolaris/copse@<version>`.
- npm global installs run `npm install -g @getsolaris/copse@<version>`.
- Standalone installs replace the current binary only when the release asset has a sha256 digest.
- Source/dev checkouts are not overwritten; update them with git or reinstall copse.

## Launch-time and TUI prompts

Interactive CLI commands and the TUI can show an update prompt after the configured interval. Scripts stay quiet: non-TTY runs, JSON/porcelain output, help/version output, `copse init`, and `copse update` skip launch-time prompts.

```json
{
  "updates": {
    "enabled": true,
    "checkIntervalHours": 24,
    "ignoredVersion": "1.2.3"
  }
}
```

Set `updates.enabled` to `false` to disable launch-time and TUI prompts. The explicit `copse update` command still works.
