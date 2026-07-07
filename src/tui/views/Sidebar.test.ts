import { describe, expect, it } from "bun:test";
import { buildSidebarMetadata, getSidebarScrollTop } from "./Sidebar.tsx";
import type { Worktree } from "../../core/types.ts";

function testWorktree(path: string): Worktree {
  return {
    path,
    branch: path.split("/").at(-1) ?? null,
    head: "abc123",
    isMain: false,
    isDirty: false,
    isLocked: false,
    repoName: "repo",
    repoPath: "/repo",
  };
}

describe("getSidebarScrollTop", () => {
  it("keeps a selected row below the first viewport visible", () => {
    const scrollTop = getSidebarScrollTop(46, 18);

    expect(scrollTop).toBe(29);
    expect(46 - scrollTop).toBeLessThan(18);
  });

  it("does not scroll while the selected row is already visible", () => {
    expect(getSidebarScrollTop(5, 18)).toBe(0);
  });
});

describe("buildSidebarMetadata", () => {
  it("reads metadata once per worktree when rows reuse the cached map", () => {
    const worktrees = [testWorktree("/repo/a"), testWorktree("/repo/b")];
    const sessionReads: string[] = [];
    const pinReads: string[] = [];

    const metadata = buildSidebarMetadata(worktrees, {
      hasSession: (path) => {
        sessionReads.push(path);
        return path.endsWith("/a");
      },
      pinned: (path) => {
        pinReads.push(path);
        return path.endsWith("/b");
      },
    });

    const rowPasses = [
      metadata.get("/repo/a"),
      metadata.get("/repo/b"),
      metadata.get("/repo/a"),
      metadata.get("/repo/b"),
    ];

    expect(rowPasses.map((entry) => entry?.hasSession)).toEqual([true, false, true, false]);
    expect(rowPasses.map((entry) => entry?.pinned)).toEqual([false, true, false, true]);
    expect(sessionReads).toEqual(["/repo/a", "/repo/b"]);
    expect(pinReads).toEqual(["/repo/a", "/repo/b"]);
  });
});
