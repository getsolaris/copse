import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync, writeFileSync, rmSync } from "fs";
import { basename, join } from "path";
import { createWorktreeFlow } from "./create-worktree.ts";
import { removeWorktreeFlow } from "./remove-worktree.ts";
import {
  CREATE_STEP_IDS,
  REMOVE_STEP_IDS,
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
