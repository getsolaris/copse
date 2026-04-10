# copse shell-init

Print shell integration code for `copse switch`. Required for automatic directory switching.

## Usage

```
copse shell-init [shell]
```

Supported shells: `bash`, `zsh`, `fish`

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--completions` | | Generate shell completions (`bash`, `zsh`, `fish`) |

## Examples

### Set up zsh integration

Add to your `~/.zshrc`:

```bash
eval "$(copse shell-init zsh)"
```

### Set up bash integration

Add to your `~/.bashrc`:

```bash
eval "$(copse shell-init bash)"
```

### Set up fish integration

Add to your `~/.config/fish/config.fish`:

```fish
copse shell-init fish | source
```

### Generate zsh completions

```bash
copse shell-init --completions zsh > ~/.zsh/completions/_copse
```

### Generate bash completions

```bash
copse shell-init --completions bash > /etc/bash_completion.d/copse
```

### Generate fish completions

```bash
copse shell-init --completions fish > ~/.config/fish/completions/copse.fish
```
