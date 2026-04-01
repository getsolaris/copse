class OhMyWorktree < Formula
  desc "Oh My Worktree - Git worktree manager with a TUI"
  homepage "https://github.com/getsolaris/oh-my-worktree"
  url "https://github.com/getsolaris/oh-my-worktree/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"
  version "0.1.0"

  depends_on "oven-sh/bun/bun"

  def install
    system "bun", "install", "--frozen-lockfile"
    bin.install "src/index.ts" => "omw"
    chmod 0755, bin/"omw"
  end

  test do
    system "#{bin}/omw", "--version"
  end
end
