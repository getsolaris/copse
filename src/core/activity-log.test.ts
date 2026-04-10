import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { invalidateGitCache } from "./git.ts";
import {
  clearActivityLog,
  getActivityLogPath,
  logActivity,
  readActivityLog,
} from "./activity-log.ts";
import { cleanupTempDirs, createTempDir, createTempRepo, runGit } from "./test-helpers.ts";
import type { ActivityEvent } from "./types.ts";

afterEach(() => {
  cleanupTempDirs();
  invalidateGitCache();
});

describe("getActivityLogPath", () => {
  it("returns .git/copse-activity.log for main worktree", async () => {
    const repoPath = await createTempRepo();
    const activityLogPath = getActivityLogPath(repoPath);

    expect(activityLogPath).toBe(join(repoPath, ".git", "copse-activity.log"));
  });

  it("returns git metadata dir path for linked worktree", async () => {
    const repoPath = await createTempRepo();
    const wtPath = createTempDir("copse-activity-wt-");
    await runGit(["worktree", "add", wtPath, "-b", "activity-linked"], repoPath);

    const activityLogPath = getActivityLogPath(wtPath);

    expect(activityLogPath).not.toContain(join(wtPath, ".git"));
    expect(activityLogPath).toContain("copse-activity.log");
    expect(activityLogPath).toContain(repoPath);
  });
});

describe("activity log operations", () => {
  it("returns empty list when log file does not exist", async () => {
    const repoPath = await createTempRepo();

    expect(readActivityLog(repoPath)).toEqual([]);
  });

  it("appends multiple events and reads newest first", async () => {
    const repoPath = await createTempRepo();

    const first: ActivityEvent = {
      timestamp: "2026-01-01T00:00:00.000Z",
      event: "create",
      branch: "feature/one",
      path: "/tmp/one",
      details: { repo: "a" },
    };
    const second: ActivityEvent = {
      timestamp: "2026-01-01T00:01:00.000Z",
      event: "switch",
      branch: "feature/two",
      path: "/tmp/two",
      details: { repo: "a" },
    };

    logActivity(repoPath, first);
    logActivity(repoPath, second);

    expect(readActivityLog(repoPath)).toEqual([second, first]);
  });

  it("applies limit when reading activity log", async () => {
    const repoPath = await createTempRepo();

    for (let i = 0; i < 5; i += 1) {
      const event: ActivityEvent = {
        timestamp: `2026-01-01T00:00:0${i}.000Z`,
        event: "create",
        branch: `feature/${i}`,
      };
      logActivity(repoPath, event);
    }

    const result = readActivityLog(repoPath, { limit: 2 });

    expect(result).toHaveLength(2);
    expect(result[0]?.branch).toBe("feature/4");
    expect(result[1]?.branch).toBe("feature/3");
  });

  it("clears activity log file", async () => {
    const repoPath = await createTempRepo();
    const event: ActivityEvent = {
      timestamp: "2026-01-01T00:00:00.000Z",
      event: "delete",
      branch: "feature/old",
    };

    logActivity(repoPath, event);
    const activityLogPath = getActivityLogPath(repoPath);
    expect(existsSync(activityLogPath)).toBeTrue();

    clearActivityLog(repoPath);

    expect(existsSync(activityLogPath)).toBeFalse();
    expect(readActivityLog(repoPath)).toEqual([]);
  });

  it("truncates to most recent 500 lines when log exceeds 1000 lines", async () => {
    const repoPath = await createTempRepo();

    for (let i = 0; i <= 1000; i += 1) {
      const event: ActivityEvent = {
        timestamp: `2026-01-01T00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z`,
        event: "create",
        branch: `feature/${i}`,
      };
      logActivity(repoPath, event);
    }

    const activityLogPath = getActivityLogPath(repoPath);
    const lines = readFileSync(activityLogPath, "utf-8").split(/\r?\n/).filter(Boolean);
    const result = readActivityLog(repoPath, { limit: 1000 });

    expect(lines).toHaveLength(500);
    expect(result).toHaveLength(500);
    expect(result[0]?.branch).toBe("feature/1000");
    expect(result[499]?.branch).toBe("feature/501");
  });
});
