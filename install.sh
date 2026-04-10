#!/usr/bin/env bash
set -euo pipefail

REPO="getsolaris/copse"
INSTALL_DIR="${HOME}/.local/bin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { printf "%b[copse]%b %s\n" "${GREEN}" "${NC}" "$*"; }
warn() { printf "%b[copse]%b %s\n" "${YELLOW}" "${NC}" "$*"; }
error() { printf "%b[copse]%b %s\n" "${RED}" "${NC}" "$*" >&2; exit 1; }

if ! command -v bun >/dev/null 2>&1; then
  warn "Bun is not installed. Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="${HOME}/.bun/bin:${PATH}"
fi

command -v bun >/dev/null 2>&1 || error "Failed to install Bun. Please install manually: https://bun.sh"

mkdir -p "${INSTALL_DIR}"

info "Using Bun v$(bun --version)"
info "Installing copse globally..."

bun install -g "@getsolaris/copse" || npm install -g "@getsolaris/copse" || error "Global install failed"

if command -v copse >/dev/null 2>&1; then
  info "Installed: $(copse --version 2>/dev/null || printf 'unknown')"
else
  warn "copse is not on PATH yet. Ensure Bun's bin directory is available."
fi

cat <<'EOF'

Shell integration for `copse switch`:

copse() {
  if [ "$1" = "switch" ] || [ "$1" = "sw" ]; then
    local output
    output=$(command copse "$@" 2>/dev/null)
    if [[ "$output" == cd\ * ]]; then
      eval "$output"
    else
      command copse "$@"
    fi
  else
    command copse "$@"
  fi
}
EOF

info "Installation complete. Run 'copse --help' to get started."
