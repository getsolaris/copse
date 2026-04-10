# copse clone

Clone a repository and initialize copse configuration.

## Usage

```
copse clone <url> [path]
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--template` | `-t` | Apply a named template after cloning |
| `--init-config` | | Initialize copse config after cloning (default: true) |

## Examples

### Clone a repository

```bash
copse clone https://github.com/user/repo.git
```

### Clone to a specific directory

```bash
copse clone https://github.com/user/repo.git ~/projects/my-repo
```

### Clone and apply a template

```bash
copse clone https://github.com/user/repo.git --template frontend
```

### Clone with SSH

```bash
copse clone git@github.com:user/repo.git
```

### Clone without initializing config

```bash
copse clone https://github.com/user/repo.git --no-init-config
```
