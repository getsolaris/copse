#!/usr/bin/env bash
set -euo pipefail

REPO="getsolaris/oh-my-worktree"
INSTALL_DIR="${HOME}/.local/bin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { printf "%b[omw]%b %s\n" "${GREEN}" "${NC}" "$*"; }
warn() { printf "%b[omw]%b %s\n" "${YELLOW}" "${NC}" "$*"; }
error() { printf "%b[omw]%b %s\n" "${RED}" "${NC}" "$*" >&2; exit 1; }

if ! command -v bun >/dev/null 2>&1; then
  warn "Bun is not installed. Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="${HOME}/.bun/bin:${PATH}"
fi

command -v bun >/dev/null 2>&1 || error "Failed to install Bun. Please install manually: https://bun.sh"

mkdir -p "${INSTALL_DIR}"

info "Using Bun v$(bun --version)"
info "Installing oh-my-worktree globally..."

bun install -g "@getsolaris/oh-my-worktree" || npm install -g "@getsolaris/oh-my-worktree" || error "Global install failed"

if command -v omw >/dev/null 2>&1; then
  info "Installed: $(omw --version 2>/dev/null || printf 'unknown')"
else
  warn "omw is not on PATH yet. Ensure Bun's bin directory is available."
fi

cat <<'EOF'

Shell integration for `omw switch`:

omw() {
  if [ "$1" = "switch" ] || [ "$1" = "sw" ]; then
    local output
    output=$(command omw "$@" 2>/dev/null)
    if [[ "$output" == cd\ * ]]; then
      eval "$output"
    else
      command omw "$@"
    fi
  else
    command omw "$@"
  fi
}
EOF

info "Installation complete. Run 'omw --help' to get started."
