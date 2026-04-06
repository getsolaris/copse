import type { Worktree } from "./types.ts";
import type { LifecycleConfig } from "./config.ts";
import { GitWorktree } from "./git.ts";
import { isPinned } from "./pin.ts";
import { mapWithLimit } from "./concurrency.ts";

export interface StaleWorktree {
  worktree: Worktree;
  lastActivity: Date | null;
  daysSinceActivity: number;
}

export interface LifecycleReport {
  merged: Worktree[];
  stale: StaleWorktree[];
  pinProtected: Worktree[];
  overLimit: boolean;
  totalCount: number;
  maxWorktrees: number | null;
}

export async function analyzeLifecycle(
  worktrees: Worktree[],
  config: LifecycleConfig,
  mainBranch: string,
  mainRepoPath: string,
): Promise<LifecycleReport> {
  const nonMain = worktrees.filter((wt) => !wt.isMain);
  const pinProtected = nonMain.filter((wt) => isPinned(wt.path));
  const pinProtectedPaths = new Set(pinProtected.map((wt) => wt.path));

  let merged: Worktree[] = [];
  if (config.autoCleanMerged) {
    const candidates = nonMain.filter((wt) => !pinProtectedPaths.has(wt.path) && wt.branch);
    const checked = await mapWithLimit(candidates, 10, async (wt) => ({
      wt,
      isMerged: await GitWorktree.isMergedInto(wt.branch!, mainBranch, mainRepoPath),
    }));
    merged = checked.filter((c) => c.isMerged && !c.wt.isDirty).map((c) => c.wt);
  }

  let stale: StaleWorktree[] = [];
  if (config.staleAfterDays && config.staleAfterDays > 0) {
    const now = new Date();
    const candidates = nonMain.filter((wt) => !pinProtectedPaths.has(wt.path));
    const checked = await mapWithLimit(candidates, 10, async (wt) => {
      const lastActivity = await GitWorktree.getWorktreeLastActivity(wt.path);
      const daysSince = lastActivity
        ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
        : Infinity;
      return { wt, lastActivity, daysSince };
    });
    stale = checked
      .filter((c) => c.daysSince >= config.staleAfterDays!)
      .map((c) => ({ worktree: c.wt, lastActivity: c.lastActivity, daysSinceActivity: c.daysSince === Infinity ? -1 : c.daysSince }));
  }

  const overLimit = config.maxWorktrees
    ? nonMain.length > config.maxWorktrees
    : false;

  return {
    merged,
    stale,
    pinProtected,
    overLimit,
    totalCount: nonMain.length,
    maxWorktrees: config.maxWorktrees ?? null,
  };
}

export function formatLifecycleReport(report: LifecycleReport): string {
  const lines: string[] = [];

  if (report.pinProtected.length > 0) {
    lines.push(`Pin-protected worktrees (${report.pinProtected.length}):`);
    for (const wt of report.pinProtected) {
      lines.push(`  ${wt.branch ?? "(detached)"} → ${wt.path}`);
    }
  }

  if (report.merged.length > 0) {
    lines.push(`Merged worktrees (${report.merged.length}):`);
    for (const wt of report.merged) {
      lines.push(`  ${wt.branch ?? "(detached)"} → ${wt.path}`);
    }
  }

  if (report.stale.length > 0) {
    lines.push(`Stale worktrees (${report.stale.length}):`);
    for (const s of report.stale) {
      const daysLabel = s.daysSinceActivity < 0 ? "unknown" : `${s.daysSinceActivity} days`;
      lines.push(`  ${s.worktree.branch ?? "(detached)"} — inactive ${daysLabel}`);
    }
  }

  if (report.overLimit) {
    lines.push(`Worktree limit exceeded: ${report.totalCount}/${report.maxWorktrees}`);
  }

  if (lines.length === 0) {
    lines.push("All worktrees are healthy.");
  }

  return lines.join("\n");
}
