import { afterEach, describe, expect, it } from "bun:test";
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";
import { cleanupTempDirs, createTempDir } from "./test-helpers.ts";
import { executeInstallPlan } from "./updater-execute.ts";

afterEach(() => {
  cleanupTempDirs();
});

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

describe("update install execution", () => {
  it("replaces a standalone script atomically when the digest matches", async () => {
    const root = createTempDir("copse-update-standalone-");
    const targetPath = join(root, "copse.js");
    const bytes = new TextEncoder().encode("new script\n");
    writeFileSync(targetPath, "old script\n", "utf-8");
    chmodSync(targetPath, 0o755);

    const result = await executeInstallPlan({
      kind: "standalone",
      method: "standalone",
      targetPath,
      preserveModeFrom: targetPath,
      downloadUrl: "https://example.test/copse.js",
      digest: sha256(bytes),
    }, {
      download: async () => bytes,
    });

    expect(result.status).toBe("updated");
    expect(readFileSync(targetPath, "utf-8")).toBe("new script\n");
    expect(statSync(targetPath).mode & 0o777).toBe(0o755);
  });

  it("keeps the existing standalone script when digest verification fails", async () => {
    const root = createTempDir("copse-update-standalone-");
    const targetPath = join(root, "copse.js");
    writeFileSync(targetPath, "old script\n", "utf-8");
    chmodSync(targetPath, 0o755);

    await expect(executeInstallPlan({
      kind: "standalone",
      method: "standalone",
      targetPath,
      preserveModeFrom: targetPath,
      downloadUrl: "https://example.test/copse.js",
      digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    }, {
      download: async () => new TextEncoder().encode("new script\n"),
    })).rejects.toThrow("digest mismatch");

    expect(readFileSync(targetPath, "utf-8")).toBe("old script\n");
    expect(existsSync(`${targetPath}.tmp`)).toBeFalse();
  });
});
