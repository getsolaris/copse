import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { dirname } from "path";
import type { ActivityEvent } from "./types.ts";
import { getMetadataFilePath } from "./metadata.ts";

const maxLogLines = 1000;
const truncateToLines = 500;
const truncateCheckBytes = 80 * maxLogLines;

export function getActivityLogPath(repoPath: string): string {
  return getMetadataFilePath(repoPath, "copse-activity.log");
}

export function logActivity(repoPath: string, event: ActivityEvent): void {
  const activityLogPath = getActivityLogPath(repoPath);
  mkdirSync(dirname(activityLogPath), { recursive: true });

  appendFileSync(activityLogPath, `${JSON.stringify(event)}\n`, { encoding: "utf-8", mode: 0o600 });

  const stat = statSync(activityLogPath, { throwIfNoEntry: false });
  if (stat && stat.size > truncateCheckBytes) {
    const lines = readFileSync(activityLogPath, "utf-8").split(/\r?\n/).filter(Boolean);
    if (lines.length > maxLogLines) {
      const recentLines = lines.slice(-truncateToLines);
      writeFileSync(activityLogPath, `${recentLines.join("\n")}\n`, { encoding: "utf-8", mode: 0o600 });
    }
  }
}

export function readActivityLog(repoPath: string, opts?: { limit?: number }): ActivityEvent[] {
  const activityLogPath = getActivityLogPath(repoPath);
  const limit = opts?.limit ?? 50;

  if (!existsSync(activityLogPath)) {
    return [];
  }

  const raw = readFileSync(activityLogPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const start = Math.max(0, lines.length - limit);
  const events: ActivityEvent[] = [];

  for (let i = lines.length - 1; i >= start; i--) {
    try {
      events.push(JSON.parse(lines[i]) as ActivityEvent);
    } catch {
      // skip malformed lines
    }
  }

  return events;
}

export function clearActivityLog(repoPath: string): void {
  rmSync(getActivityLogPath(repoPath), { force: true });
}
