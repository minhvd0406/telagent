class Telagent < Formula
  desc "Lightweight Telegram bridge CLI for AI coding agents"
  homepage "https://github.com/minhvd0406/telagent"
  url "https://github.com/minhvd0406/telagent/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "REPLACE_WITH_RELEASE_TARBALL_SHA256"
  license "MIT"

  depends_on "node@20"

  def install
    libexec.install Dir["*"]
    (bin/"telagent").write <<~SH
      #!/bin/bash
      exec "#{Formula["node@20"].opt_bin}/node" "#{libexec}/bin/telagent.mjs" "$@"
    SH
  end

  test do
    assert_match "Telagent", shell_output("#{bin}/telagent --help")
  end
end
