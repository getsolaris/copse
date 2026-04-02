# omw shell-init

Print shell integration code for `omw switch`. Required for automatic directory switching.

## Usage

```
omw shell-init [shell]
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
eval "$(omw shell-init zsh)"
```

### Set up bash integration

Add to your `~/.bashrc`:

```bash
eval "$(omw shell-init bash)"
```

### Set up fish integration

Add to your `~/.config/fish/config.fish`:

```fish
omw shell-init fish | source
```

### Generate zsh completions

```bash
omw shell-init --completions zsh > ~/.zsh/completions/_omw
```

### Generate bash completions

```bash
omw shell-init --completions bash > /etc/bash_completion.d/omw
```

### Generate fish completions

```bash
omw shell-init --completions fish > ~/.config/fish/completions/omw.fish
```
