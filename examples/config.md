# omw config

Manage oh-my-worktree configuration.

Configuration is stored at `~/.config/oh-my-worktree/config.json` (XDG-compliant).

## Usage

```
omw config [flags]
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--init` | | Create default config file |
| `--show` | `-s` | Print current config as JSON |
| `--edit` | `-e` | Open config in `$EDITOR` |
| `--path` | | Print the config file path |
| `--validate` | | Validate config against schema |
| `--profiles` | | List available config profiles |
| `--profile` | | Profile name (for activation or deletion) |
| `--activate` | | Activate the specified profile |
| `--delete` | | Delete the specified profile |

## Examples

### Create a default config file

```bash
omw config --init
```

### Show current configuration

```bash
omw config --show
```

### Open config in your editor

```bash
omw config --edit
```

### Print the config file path

```bash
omw config --path
```

### Validate your config

```bash
omw config --validate
```

### List available profiles

```bash
omw config --profiles
```

### Activate a profile

```bash
omw config --profile work --activate
```

### Delete a profile

```bash
omw config --profile old-setup --delete
```
