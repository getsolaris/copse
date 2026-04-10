# copse config

Manage copse configuration.

Configuration is stored at `~/.config/copse/config.json` (XDG-compliant).

## Usage

```
copse config [flags]
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
copse config --init
```

### Show current configuration

```bash
copse config --show
```

### Open config in your editor

```bash
copse config --edit
```

### Print the config file path

```bash
copse config --path
```

### Validate your config

```bash
copse config --validate
```

### List available profiles

```bash
copse config --profiles
```

### Activate a profile

```bash
copse config --profile work --activate
```

### Delete a profile

```bash
copse config --profile old-setup --delete
```
