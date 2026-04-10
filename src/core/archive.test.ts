import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { basename } from "path";
import { cleanupTempDirs, createTempDir, createTempRepo, runGit } from "./test-helpers";
import { createArchive, getArchiveDetail, getArchiveDir, listArchives } from "./archive";

let originalHome: string | undefined;

function setTestHome(): void {
  originalHome = (Bun as any).env.HOME;
  const home = createTempDir("copse-archive-home-");
  (Bun as any).env.HOME = home;
  process.env.HOME = home;
}

afterEach(() => {
  if (originalHome) {
    (Bun as any).env.HOME = originalHome;
    process.env.HOME = originalHome;
  }
  cleanupTempDirs();
});

describe("getArchiveDir", () => {
  it("returns ~/.copse/archives under HOME", () => {
    setTestHome();
    expect(getArchiveDir()).toBe(`${(Bun as any).env.HOME}/.copse/archives`);
  });
});

describe("createArchive", () => {
  it("archives a dirty worktree with uncommitted changes", async () => {
    setTestHome();
    const repoPath = await createTempRepo("copse-archive-dirty-repo-");

    await Bun.write(`${repoPath}/README.md`, "# temp repo\n\nDirty change\n");

    const entry = await createArchive(repoPath, repoPath);
    expect(entry.repo).toBe(basename(repoPath));
    expect(entry.patchPath).toContain(`${entry.repo}/`);
    expect(existsSync(entry.patchPath)).toBeTrue();
    expect(existsSync(entry.patchPath.replace(/\.patch$/, ".json"))).toBeTrue();

    const patch = readFileSync(entry.patchPath, "utf-8");
    expect(patch).toContain("README.md");
  });

  it("archives a clean worktree and still includes recent commits", async () => {
    setTestHome();
    const repoPath = await createTempRepo("copse-archive-clean-repo-");

    const entry = await createArchive(repoPath, repoPath);
    expect(existsSync(entry.patchPath)).toBeTrue();

    const patch = readFileSync(entry.patchPath, "utf-8");
    expect(patch).toContain("Subject: [PATCH");
  });

  it("sanitizes branch names with slashes for filenames", async () => {
    setTestHome();
    const repoPath = await createTempRepo("copse-archive-branch-repo-");
    await runGit(["checkout", "-b", "feature/archive-test"], repoPath);

    const entry = await createArchive(repoPath, repoPath);
    expect(basename(entry.patchPath)).toContain("feature-archive-test-");
    expect(basename(entry.patchPath)).not.toContain("feature/archive-test");
  });
});

describe("listArchives and getArchiveDetail", () => {
  it("lists archives sorted by archivedAt desc and supports repo filter", async () => {
    setTestHome();
    const repoA = await createTempRepo("copse-archive-list-a-");
    const repoB = await createTempRepo("copse-archive-list-b-");

    const first = await createArchive(repoA, repoA);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await createArchive(repoB, repoB);

    const all = await listArchives();
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all[0]?.archivedAt >= all[1]?.archivedAt).toBeTrue();
    expect(all[0]?.patchPath).toBe(second.patchPath);

    const filtered = await listArchives(basename(repoA));
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.patchPath).toBe(first.patchPath);
  });

  it("returns patch detail content", async () => {
    setTestHome();
    const repoPath = await createTempRepo("copse-archive-detail-repo-");
    await Bun.write(`${repoPath}/README.md`, "# temp repo\n\nArchive detail\n");

    const entry = await createArchive(repoPath, repoPath);
    const detail = getArchiveDetail(entry.patchPath);
    expect(detail.length).toBeGreaterThan(0);
    expect(detail).toContain("README.md");
  });
});
