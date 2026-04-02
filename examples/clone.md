# omw clone

Clone a repository and initialize omw configuration.

## Usage

```
omw clone <url> [path]
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--template` | `-t` | Apply a named template after cloning |
| `--init-config` | | Initialize omw config after cloning (default: true) |

## Examples

### Clone a repository

```bash
omw clone https://github.com/user/repo.git
```

### Clone to a specific directory

```bash
omw clone https://github.com/user/repo.git ~/projects/my-repo
```

### Clone and apply a template

```bash
omw clone https://github.com/user/repo.git --template frontend
```

### Clone with SSH

```bash
omw clone git@github.com:user/repo.git
```

### Clone without initializing config

```bash
omw clone https://github.com/user/repo.git --no-init-config
```
