import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync, writeFileSync, rmSync } from "fs";
import { basename, join } from "path";
import { createWorktreeFlow } from "./create-worktree.ts";
import { removeWorktreeFlow } from "./remove-worktree.ts";
import { archiveWorktreeFlow } from "./archive-worktree.ts";
import { importWorktreeFlow } from "./import-worktree.ts";
import { renameWorktreeFlow } from "./rename-worktree.ts";
import {
  CREATE_STEP_IDS,
  REMOVE_STEP_IDS,
  ARCHIVE_STEP_IDS,
  IMPORT_STEP_IDS,
  RENAME_STEP_IDS,
  type StepProgressHandler,
} from "./types.ts";
import { invalidateGitCache } from "../git.ts";
import { getActivityLogPath, readActivityLog } from "../activity-log.ts";
import { getMetadataFilePath } from "../metadata.ts";
import {
  cleanupTempDirs,
  createTempRepo,
  createTempRepoWithRemote,
} from "../test-helpers.ts";
import type { OmlConfig } from "../config.ts";

interface CapturedEvents {
  planned: string[];
  started: string[];
  done: string[];
  errored: [string, string][];
}

function capture(): { handler: StepProgressHandler; events: CapturedEvents } {
  const events: CapturedEvents = { planned: [], started: [], done: [], errored: [] };
  const handler: StepProgressHandler = {
    onStepPlan: (plan) => events.planned.push(...plan.map((p) => p.id)),
    onStepStart: (id) => events.started.push(id),
    onStepDone: (id) => events.done.push(id),
    onStepError: (id, msg) => events.errored.push([id, msg]),
  };
  return { handler, events };
}

afterEach(() => {
  invalidateGitCache();
  cleanupTempDirs();
});

describe("createWorktreeFlow", () => {
  const baseConfig: OmlConfig = { version: 1, defaults: { autoUpstream: false } };

  it("plans and runs minimal create flow (worktree + activityLog)", async () => {
    const repoPath = await createTempRepo("copse-orch-min-");
    const wtPath = join(repoPath, "..", `copse-orch-min-wt-${Date.now()}`);
    const { handler, events } = capture();

    try {
      await createWorktreeFlow(
        baseConfig,
        {
          branch: "feat/min",
          worktreePath: wtPath,
          mainRepoPath: repoPath,
          repoName: basename(repoPath),
        },
        handler,
      );

      expect(events.planned).toEqual([CREATE_STEP_IDS.worktree, CREATE_STEP_IDS.activityLog]);
      expect(events.done).toContain(CREATE_STEP_IDS.worktree);
      expect(events.done).toContain(CREATE_STEP_IDS.activityLog);
      expect(existsSync(wtPath)).toBeTrue();

      const logEvents = readActivityLog(repoPath);
      expect(logEvents).toHaveLength(1);
      expect(logEvents[0].event).toBe("create");
      expect(logEvents[0].branch).toBe("feat/min");
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it("runs full pipeline when config has every feature enabled", async () => {
    const repoPath = await createTempRepo("copse-orch-full-");
    const wtPath = join(repoPath, "..", `copse-orch-full-wt-${Date.now()}`);
    writeFileSync(join(repoPath, ".env"), "TOKEN=abc\n");

    const config: OmlConfig = {
      version: 1,
      defaults: {
        autoUpstream: false,
        copyFiles: [".env"],
        linkFiles: [],
        postCreate: ["echo hook-ran"],
        postRemove: [],
      },
    };

    const { handler, events } = capture();

    try {
      await createWorktreeFlow(
        config,
        {
          branch: "feat/full",
          worktreePath: wtPath,
          mainRepoPath: repoPath,
          repoName: basename(repoPath),
        },
        handler,
      );

      expect(events.planned).toContain(CREATE_STEP_IDS.worktree);
      expect(events.planned).toContain(CREATE_STEP_IDS.copyFiles);
      expect(events.planned).toContain(CREATE_STEP_IDS.postCreate);
      expect(events.planned).toContain(CREATE_STEP_IDS.activityLog);

      expect(events.done).toContain(CREATE_STEP_IDS.copyFiles);
      expect(events.done).toContain(CREATE_STEP_IDS.postCreate);
      expect(existsSync(join(wtPath, ".env"))).toBeTrue();
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it("fetches when base is a remote ref and branch does not exist", async () => {
    const { repoPath } = await createTempRepoWithRemote("copse-orch-fetch-");
    const wtPath = join(repoPath, "..", `copse-orch-fetch-wt-${Date.now()}`);
    const { handler, events } = capture();

    try {
      await createWorktreeFlow(
        { version: 1, defaults: { autoUpstream: false, base: "origin/main" } },
        {
          branch: "feat/from-remote",
          worktreePath: wtPath,
          mainRepoPath: repoPath,
          repoName: basename(repoPath),
        },
        handler,
      );

      expect(events.planned[0]).toBe(CREATE_STEP_IDS.fetch);
      expect(events.done).toContain(CREATE_STEP_IDS.fetch);
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it("does not fetch when --fetch=false is explicit", async () => {
    const { repoPath } = await createTempRepoWithRemote("copse-orch-nofetch-");
    const wtPath = join(repoPath, "..", `copse-orch-nofetch-wt-${Date.now()}`);
    const { handler, events } = capture();

    try {
      await createWorktreeFlow(
        { version: 1, defaults: { autoUpstream: false, base: "origin/main" } },
        {
          branch: "feat/no-fetch",
          worktreePath: wtPath,
          mainRepoPath: repoPath,
          repoName: basename(repoPath),
          fetch: false,
        },
        handler,
      );

      expect(events.planned).not.toContain(CREATE_STEP_IDS.fetch);
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it("does not fetch when base is not a remote ref", async () => {
    const repoPath = await createTempRepo("copse-orch-local-base-");
    const wtPath = join(repoPath, "..", `copse-orch-local-base-wt-${Date.now()}`);
    const { handler, events } = capture();

    try {
      await createWorktreeFlow(
        { version: 1, defaults: { autoUpstream: false, base: "main" } },
        {
          branch: "feat/local-base",
          worktreePath: wtPath,
          mainRepoPath: repoPath,
          repoName: basename(repoPath),
        },
        handler,
      );

      expect(events.planned).not.toContain(CREATE_STEP_IDS.fetch);
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it("applies template.base as fallback when --base not passed", async () => {
    const { repoPath } = await createTempRepoWithRemote("copse-orch-tmpl-");
    const wtPath = join(repoPath, "..", `copse-orch-tmpl-wt-${Date.now()}`);
    const { handler, events } = capture();

    try {
      await createWorktreeFlow(
        {
          version: 1,
          defaults: { autoUpstream: false },
          templates: { hotfix: { base: "origin/main" } },
        },
        {
          branch: "feat/tmpl",
          worktreePath: wtPath,
          mainRepoPath: repoPath,
          repoName: basename(repoPath),
          templateName: "hotfix",
        },
        handler,
      );

      expect(events.planned[0]).toBe(CREATE_STEP_IDS.fetch);
      expect(events.done).toContain(CREATE_STEP_IDS.fetch);
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it("rolls back worktree when a hook fails", async () => {
    const repoPath = await createTempRepo("copse-orch-rollback-");
    const wtPath = join(repoPath, "..", `copse-orch-rollback-wt-${Date.now()}`);

    try {
      await expect(
        createWorktreeFlow(
          {
            version: 1,
            defaults: { autoUpstream: false, postCreate: ["exit 42"] },
          },
          {
            branch: "feat/rollback",
            worktreePath: wtPath,
            mainRepoPath: repoPath,
            repoName: basename(repoPath),
          },
        ),
      ).rejects.toThrow();

      expect(existsSync(wtPath)).toBeFalse();
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it("writes PR metadata when prNumber is provided", async () => {
    const repoPath = await createTempRepo("copse-orch-pr-");
    const wtPath = join(repoPath, "..", `copse-orch-pr-wt-${Date.now()}`);

    try {
      await createWorktreeFlow(
        { version: 1, defaults: { autoUpstream: false } },
        {
          branch: "feat/pr",
          worktreePath: wtPath,
          mainRepoPath: repoPath,
          repoName: basename(repoPath),
          prNumber: 42,
        },
      );

      const prMetaPath = getMetadataFilePath(wtPath, "copse-pr");
      expect(existsSync(prMetaPath)).toBeTrue();
      const meta = JSON.parse(readFileSync(prMetaPath, "utf-8"));
      expect(meta.number).toBe(42);
      expect(meta.branch).toBe("feat/pr");
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });
});

describe("removeWorktreeFlow", () => {
  it("plans and runs minimal remove flow (worktree + activityLog)", async () => {
    const repoPath = await createTempRepo("copse-orch-rm-min-");
    const wtPath = join(repoPath, "..", `copse-orch-rm-min-wt-${Date.now()}`);

    await createWorktreeFlow(
      { version: 1, defaults: { autoUpstream: false } },
      {
        branch: "feat/rm-min",
        worktreePath: wtPath,
        mainRepoPath: repoPath,
        repoName: basename(repoPath),
      },
    );

    try {
      const { handler, events } = capture();
      await removeWorktreeFlow(
        { version: 1 },
        {
          worktreePath: wtPath,
          mainRepoPath: repoPath,
          repoName: basename(repoPath),
          branch: "feat/rm-min",
          force: true,
        },
        handler,
      );

      expect(events.planned).toEqual([REMOVE_STEP_IDS.worktree, REMOVE_STEP_IDS.activityLog]);
      expect(events.done).toContain(REMOVE_STEP_IDS.worktree);
      expect(events.done).toContain(REMOVE_STEP_IDS.activityLog);
      expect(existsSync(wtPath)).toBeFalse();

      const logEvents = readActivityLog(repoPath);
      const deleteEvents = logEvents.filter((e) => e.event === "delete");
      expect(deleteEvents).toHaveLength(1);
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it("runs postRemove hooks from config", async () => {
    const repoPath = await createTempRepo("copse-orch-rm-hook-");
    const wtPath = join(repoPath, "..", `copse-orch-rm-hook-wt-${Date.now()}`);

    const config: OmlConfig = {
      version: 1,
      defaults: { autoUpstream: false, postRemove: ["echo bye"] },
    };

    await createWorktreeFlow(config, {
      branch: "feat/rm-hook",
      worktreePath: wtPath,
      mainRepoPath: repoPath,
      repoName: basename(repoPath),
    });

    try {
      const { handler, events } = capture();
      await removeWorktreeFlow(
        config,
        {
          worktreePath: wtPath,
          mainRepoPath: repoPath,
          repoName: basename(repoPath),
          branch: "feat/rm-hook",
          force: true,
        },
        handler,
      );

      expect(events.planned).toContain(REMOVE_STEP_IDS.postRemove);
      expect(events.done).toContain(REMOVE_STEP_IDS.postRemove);
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it("writes activity log with 'delete' event and correct branch", async () => {
    const repoPath = await createTempRepo("copse-orch-rm-log-");
    const wtPath = join(repoPath, "..", `copse-orch-rm-log-wt-${Date.now()}`);

    await createWorktreeFlow(
      { version: 1, defaults: { autoUpstream: false } },
      {
        branch: "feat/log-check",
        worktreePath: wtPath,
        mainRepoPath: repoPath,
        repoName: basename(repoPath),
      },
    );

    try {
      await removeWorktreeFlow(
        { version: 1 },
        {
          worktreePath: wtPath,
          mainRepoPath: repoPath,
          repoName: basename(repoPath),
          branch: "feat/log-check",
          force: true,
        },
      );

      expect(existsSync(getActivityLogPath(repoPath))).toBeTrue();
      const logEvents = readActivityLog(repoPath);
      const deleteEvent = logEvents.find((e) => e.event === "delete" && e.branch === "feat/log-check");
      expect(deleteEvent).toBeDefined();
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });
});

describe("CLI/TUI parity invariant", () => {
  it("same config + opts produces same step plan regardless of caller", async () => {
    const repoPath = await createTempRepo("copse-orch-parity-");
    const wtPath = join(repoPath, "..", `copse-orch-parity-wt-${Date.now()}`);
    writeFileSync(join(repoPath, ".env"), "X=1\n");

    const config: OmlConfig = {
      version: 1,
      defaults: {
        autoUpstream: false,
        copyFiles: [".env"],
        postCreate: ["echo ok"],
      },
    };

    try {
      const callers = ["cli", "tui"] as const;
      const plansByCaller = new Map<string, readonly string[]>();

      for (const caller of callers) {
        const { handler, events } = capture();
        const branch = `feat/parity-${caller}`;
        const localWtPath = join(repoPath, "..", `copse-parity-${caller}-${Date.now()}`);

        try {
          await createWorktreeFlow(
            config,
            {
              branch,
              worktreePath: localWtPath,
              mainRepoPath: repoPath,
              repoName: basename(repoPath),
            },
            handler,
          );
          plansByCaller.set(caller, [...events.planned]);
        } finally {
          rmSync(localWtPath, { recursive: true, force: true });
        }
      }

      expect(plansByCaller.get("cli")).toEqual(plansByCaller.get("tui"));
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });
});

describe("archiveWorktreeFlow", () => {
  it("keeps worktree when --keep is set (only archives + logs archive event)", async () => {
    const repoPath = await createTempRepo("copse-arch-keep-");
    const wtPath = join(repoPath, "..", `copse-arch-keep-wt-${Date.now()}`);
    await createWorktreeFlow(
      { version: 1, defaults: { autoUpstream: false } },
      {
        branch: "feat/arch-keep",
        worktreePath: wtPath,
        mainRepoPath: repoPath,
        repoName: basename(repoPath),
      },
    );
    writeFileSync(join(wtPath, "new.txt"), "work\n");

    try {
      const { handler, events } = capture();
      const { archiveEntry } = await archiveWorktreeFlow(
        { version: 1 },
        {
          worktreePath: wtPath,
          mainRepoPath: repoPath,
          repoName: basename(repoPath),
          branch: "feat/arch-keep",
          keep: true,
        },
        handler,
      );

      expect(events.planned).toEqual([
        ARCHIVE_STEP_IDS.createArchive,
        ARCHIVE_STEP_IDS.activityLogArchive,
      ]);
      expect(events.done).toContain(ARCHIVE_STEP_IDS.createArchive);
      expect(events.done).toContain(ARCHIVE_STEP_IDS.activityLogArchive);
      expect(existsSync(wtPath)).toBeTrue();
      expect(existsSync(archiveEntry.patchPath)).toBeTrue();

      const logEvents = readActivityLog(repoPath);
      expect(logEvents.some((e) => e.event === "archive")).toBeTrue();
      expect(logEvents.some((e) => e.event === "delete")).toBeFalse();
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it("archives then removes when --keep is false (fires both archive and remove steps)", async () => {
    const repoPath = await createTempRepo("copse-arch-rm-");
    const wtPath = join(repoPath, "..", `copse-arch-rm-wt-${Date.now()}`);
    await createWorktreeFlow(
      { version: 1, defaults: { autoUpstream: false } },
      {
        branch: "feat/arch-rm",
        worktreePath: wtPath,
        mainRepoPath: repoPath,
        repoName: basename(repoPath),
      },
    );

    try {
      const { handler, events } = capture();
      await archiveWorktreeFlow(
        { version: 1 },
        {
          worktreePath: wtPath,
          mainRepoPath: repoPath,
          repoName: basename(repoPath),
          branch: "feat/arch-rm",
          keep: false,
        },
        handler,
      );

      expect(events.planned).toEqual([
        ARCHIVE_STEP_IDS.createArchive,
        ARCHIVE_STEP_IDS.activityLogArchive,
        REMOVE_STEP_IDS.worktree,
        REMOVE_STEP_IDS.activityLog,
      ]);
      expect(events.done).toContain(REMOVE_STEP_IDS.worktree);
      expect(existsSync(wtPath)).toBeFalse();

      const logEvents = readActivityLog(repoPath);
      expect(logEvents.some((e) => e.event === "archive")).toBeTrue();
      expect(logEvents.some((e) => e.event === "delete" && e.branch === "feat/arch-rm")).toBeTrue();
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it("runs postRemove hooks during remove phase when --keep is false (regression: archive used to skip monorepo hooks)", async () => {
    const repoPath = await createTempRepo("copse-arch-hooks-");
    const wtPath = join(repoPath, "..", `copse-arch-hooks-wt-${Date.now()}`);

    const config = {
      version: 1 as const,
      defaults: { autoUpstream: false, postRemove: ["echo archived-bye"] },
    };

    await createWorktreeFlow(config, {
      branch: "feat/arch-hooks",
      worktreePath: wtPath,
      mainRepoPath: repoPath,
      repoName: basename(repoPath),
    });

    try {
      const { handler, events } = capture();
      await archiveWorktreeFlow(
        config,
        {
          worktreePath: wtPath,
          mainRepoPath: repoPath,
          repoName: basename(repoPath),
          branch: "feat/arch-hooks",
          keep: false,
        },
        handler,
      );

      expect(events.planned).toContain(REMOVE_STEP_IDS.postRemove);
      expect(events.done).toContain(REMOVE_STEP_IDS.postRemove);
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });
});

describe("importWorktreeFlow", () => {
  it("imports a pre-created worktree with activity log", async () => {
    const repoPath = await createTempRepo("copse-imp-");
    const wtPath = join(repoPath, "..", `copse-imp-wt-${Date.now()}`);
    await createWorktreeFlow(
      { version: 1, defaults: { autoUpstream: false } },
      {
        branch: "feat/imp",
        worktreePath: wtPath,
        mainRepoPath: repoPath,
        repoName: basename(repoPath),
      },
    );

    try {
      const { handler, events } = capture();
      const result = await importWorktreeFlow({ targetPath: wtPath }, handler);

      expect(events.planned).toEqual([
        IMPORT_STEP_IDS.validate,
        IMPORT_STEP_IDS.importWorktree,
        IMPORT_STEP_IDS.activityLog,
      ]);
      expect(events.done).toContain(IMPORT_STEP_IDS.importWorktree);
      expect(events.done).toContain(IMPORT_STEP_IDS.activityLog);
      expect(result.branch).toBe("feat/imp");

      const logEvents = readActivityLog(repoPath);
      expect(logEvents.some((e) => e.event === "import" && e.branch === "feat/imp")).toBeTrue();
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it("throws ImportError for invalid targets (not a git directory)", async () => {
    const { handler, events } = capture();
    await expect(
      importWorktreeFlow({ targetPath: `/tmp/copse-does-not-exist-${Date.now()}` }, handler),
    ).rejects.toThrow();
    expect(events.errored[0]?.[0]).toBe(IMPORT_STEP_IDS.validate);
  });
});

describe("renameWorktreeFlow", () => {
  it("renames branch and logs rename event", async () => {
    const repoPath = await createTempRepo("copse-rename-");
    const wtPath = join(repoPath, "..", `copse-rename-wt-${Date.now()}`);
    await createWorktreeFlow(
      { version: 1, defaults: { autoUpstream: false } },
      {
        branch: "feat/rename-old",
        worktreePath: wtPath,
        mainRepoPath: repoPath,
        repoName: basename(repoPath),
      },
    );

    try {
      const { handler, events } = capture();
      const result = await renameWorktreeFlow(
        {
          mainRepoPath: repoPath,
          oldBranch: "feat/rename-old",
          newBranch: "feat/rename-new",
          worktreePath: wtPath,
          movePath: false,
        },
        handler,
      );

      expect(events.planned).toEqual([
        RENAME_STEP_IDS.renameBranch,
        RENAME_STEP_IDS.activityLog,
      ]);
      expect(events.done).toContain(RENAME_STEP_IDS.renameBranch);
      expect(result.newBranch).toBe("feat/rename-new");
      expect(result.moved).toBeFalse();

      const logEvents = readActivityLog(repoPath);
      const renameEvent = logEvents.find((e) => e.event === "rename" && e.branch === "feat/rename-new");
      expect(renameEvent).toBeDefined();
      expect(renameEvent?.details?.oldBranch).toBe("feat/rename-old");
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });

  it("moves worktree directory when movePath=true", async () => {
    const repoPath = await createTempRepo("copse-rename-mv-");
    const wtPath = join(repoPath, "..", `copse-rename-mv-wt-${basename(repoPath)}-feat-mv-old`);
    await createWorktreeFlow(
      { version: 1, defaults: { autoUpstream: false } },
      {
        branch: "feat/mv-old",
        worktreePath: wtPath,
        mainRepoPath: repoPath,
        repoName: basename(repoPath),
      },
    );

    try {
      const { handler, events } = capture();
      const result = await renameWorktreeFlow(
        {
          mainRepoPath: repoPath,
          oldBranch: "feat/mv-old",
          newBranch: "feat/mv-new",
          worktreePath: wtPath,
          movePath: true,
        },
        handler,
      );

      expect(events.planned).toContain(RENAME_STEP_IDS.movePath);
      expect(events.done).toContain(RENAME_STEP_IDS.movePath);
      expect(result.moved).toBeTrue();
      expect(result.newWorktreePath).not.toBe(wtPath);
      expect(existsSync(wtPath)).toBeFalse();
      expect(existsSync(result.newWorktreePath)).toBeTrue();

      rmSync(result.newWorktreePath, { recursive: true, force: true });
    } finally {
      rmSync(wtPath, { recursive: true, force: true });
    }
  });
});
