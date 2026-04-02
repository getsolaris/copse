class OhMyWorktree < Formula
  desc "Oh My Worktree - Git worktree manager with a TUI"
  homepage "https://github.com/getsolaris/oh-my-worktree"
  url "https://github.com/getsolaris/oh-my-worktree.git",
      tag:      "v0.4.0",
      revision: "6ad2270454d41ea598864e445660064e64316b91"
  license "MIT"

  depends_on "oven-sh/bun/bun"

  # Prevent Homebrew from cleaning files inside libexec
  skip_clean "libexec"

  def install
    system "bun", "install"

    # Gzip native dylibs so Homebrew's Mach-O relinking skips them.
    # @opentui ships dylibs whose headers are too small for install_name_tool.
    Dir.glob("node_modules/**/*.dylib").each { |f| system "gzip", f }

    libexec.install Dir["*"]

    # Launcher script decompresses gzipped dylibs on first run
    (bin/"omw").write <<~SH
      #!/bin/bash
      OMW_LIBEXEC="#{libexec}"
      [ -f "$OMW_LIBEXEC/.dylibs_ready" ] || {
        find "$OMW_LIBEXEC/node_modules" -name '*.dylib.gz' -exec gunzip -f {} + 2>/dev/null
        touch "$OMW_LIBEXEC/.dylibs_ready"
      }
      exec "#{Formula["oven-sh/bun/bun"].opt_bin}/bun" run "$OMW_LIBEXEC/src/index.ts" "$@"
    SH
    chmod 0755, bin/"omw"
  end

  test do
    assert_match "oh-my-worktree", shell_output("#{bin}/omw --version")
  end
end
