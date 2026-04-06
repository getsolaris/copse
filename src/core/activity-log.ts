import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname } from "path";
import type { ActivityEvent } from "./types.ts";
import { getMetadataFilePath } from "./metadata.ts";

const maxLogLines = 1000;
const truncateToLines = 500;

export function getActivityLogPath(repoPath: string): string {
  return getMetadataFilePath(repoPath, "omw-activity.log");
}

export function logActivity(repoPath: string, event: ActivityEvent): void {
  const activityLogPath = getActivityLogPath(repoPath);
  mkdirSync(dirname(activityLogPath), { recursive: true });

  appendFileSync(activityLogPath, `${JSON.stringify(event)}\n`, { encoding: "utf-8", mode: 0o600 });

  const lines = readFileSync(activityLogPath, "utf-8").split(/\r?\n/).filter(Boolean);
  if (lines.length > maxLogLines) {
    const recentLines = lines.slice(-truncateToLines);
    writeFileSync(activityLogPath, `${recentLines.join("\n")}\n`, { encoding: "utf-8", mode: 0o600 });
  }
}

export function readActivityLog(repoPath: string, opts?: { limit?: number }): ActivityEvent[] {
  const activityLogPath = getActivityLogPath(repoPath);
  const limit = opts?.limit ?? 50;

  if (!existsSync(activityLogPath)) {
    return [];
  }

  const lines = readFileSync(activityLogPath, "utf-8").split(/\r?\n/).filter(Boolean);
  const events = lines.map((line) => JSON.parse(line) as ActivityEvent);

  return events.reverse().slice(0, limit);
}

export function clearActivityLog(repoPath: string): void {
  rmSync(getActivityLogPath(repoPath), { force: true });
}
