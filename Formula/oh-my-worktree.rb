class OhMyWorktree < Formula
  desc "Oh My Worktree - Git worktree manager with a TUI"
  homepage "https://github.com/getsolaris/oh-my-worktree"
  url "https://github.com/getsolaris/oh-my-worktree/archive/refs/tags/v0.2.0.tar.gz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"
  version "0.2.0"

  depends_on "oven-sh/bun/bun"

  def install
    # Install deps into libexec to isolate node_modules from Homebrew's
    # dylib relinking. @opentui/core-darwin-arm64 ships a native .dylib
    # whose Mach-O header is too small for Homebrew's install_name_tool
    # rewrite (the Cellar path exceeds the header padding).
    libexec.install Dir["*"]
    cd libexec do
      system "bun", "install", "--frozen-lockfile"
    end

    (bin/"omw").write <<~SH
      #!/bin/bash
      exec "#{Formula["oven-sh/bun/bun"].opt_bin}/bun" run "#{libexec}/src/index.ts" "$@"
    SH
    chmod 0755, bin/"omw"
  end

  test do
    system "#{bin}/omw", "--version"
  end
end
