import type { CommandModule } from "yargs";
import { basename, resolve } from "node:path";
import { existsSync } from "node:fs";
import { GitWorktree } from "../../core/git.ts";
import { GitError } from "../../core/types.ts";
import { loadConfig, getRepoConfig, expandTemplate } from "../../core/config.ts";
import { resolveMainRepo } from "../utils.ts";
import { HookError, HookTimeoutError } from "../../core/hooks.ts";
import { createWorktreeFlow, CREATE_STEP_IDS } from "../../core/orchestration/index.ts";

const cmd: CommandModule = {
  command: "add [branch] [path]",
  describe: "Create a new worktree for a branch",
  builder: (yargs) =>
    yargs
      .positional("branch", { type: "string", describe: "Branch name" })
      .positional("path", { type: "string", describe: "Worktree directory path" })
      .option("create", {
        type: "boolean",
        alias: "c",
        describe: "Optional compatibility flag; missing branches are created automatically",
      })
      .option("base", { type: "string", alias: "b", describe: "Base branch/commit for new branch" })
      .option("focus", {
        type: "array",
        alias: "f",
        describe: "Focus packages for monorepo (comma or space separated paths)",
        string: true,
      })
      .option("template", { type: "string", alias: "t", describe: "Use a named template from config" })
      .option("pr", {
        type: "number",
        describe: "Create worktree from a GitHub PR number (requires gh CLI)",
      })
      .option("session", { type: "boolean", alias: "s", describe: "Create a tmux session for this worktree" })
      .option("layout", { type: "string", describe: "Session layout name from config" })
      .option("fetch", {
        type: "boolean",
        default: true,
        describe: "Auto-fetch when base is a remote ref (e.g. origin/main). Use --no-fetch to skip",
      }),
  handler: async (argv) => {
    let branch = argv.branch as string | undefined;
    const prNumber = argv.pr as number | undefined;
    const mainRepoPath = await resolveMainRepo();
    const repoName = basename(mainRepoPath);

    if (!branch && !prNumber) {
      console.error("Error: specify a branch or use --pr <number>.");
      process.exit(1);
    }

    if (prNumber) {
      try {
        const proc = (Bun as any).spawn(
          ["gh", "pr", "view", String(prNumber), "--json", "headRefName", "--jq", ".headRefName"],
          { cwd: mainRepoPath, stdout: "pipe", stderr: "pipe" },
        );
        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
          proc.exited,
        ]);
        if (exitCode !== 0) {
          console.error(`Error: failed to resolve PR #${prNumber}: ${stderr.trim()}`);
          console.error("Make sure 'gh' CLI is installed and authenticated.");
          process.exit(1);
        }
        branch = stdout.trim();
        if (!branch) {
          console.error(`Error: PR #${prNumber} has no branch name`);
          process.exit(1);
        }
        console.log(`PR #${prNumber} → branch '${branch}'`);
      } catch {
        console.error("Error: 'gh' CLI not found. Install it from https://cli.github.com");
        process.exit(1);
      }
    }

    if (!branch) {
      console.error("Error: could not determine branch name.");
      process.exit(1);
    }

    const safeBranch = branch.replace(/\//g, "-");
    const config = loadConfig();
    const repoConfig = getRepoConfig(config, mainRepoPath);

    const pathTemplate = (argv.path as string | undefined) ?? repoConfig.worktreeDir;
    const expandedPath = expandTemplate(pathTemplate, { repo: repoName, branch: safeBranch });
    const worktreePath = resolve(mainRepoPath, expandedPath);

    console.log(`Creating worktree for branch '${branch}'...`);
    console.log(`  Target: ${worktreePath}`);

    const existing = await GitWorktree.list(mainRepoPath);
    const alreadyCheckedOut = existing.find((worktree) => worktree.branch === branch);
    if (alreadyCheckedOut) {
      console.error(`Error: branch '${branch}' is already checked out in ${alreadyCheckedOut.path}`);
      process.exit(1);
    }

    if (existsSync(worktreePath)) {
      console.error(`Error: directory already exists: ${worktreePath}`);
      process.exit(1);
    }

    const rawFocus = argv.focus as string[] | undefined;
    const focusPaths = rawFocus
      ? rawFocus.flatMap((f) => f.split(/[,\s]+/)).map((f) => f.trim()).filter(Boolean)
      : [];

    const templateName = argv.template as string | undefined;
    if (templateName) {
      console.log(`Using template '${templateName}'`);
    }

    try {
      const result = await createWorktreeFlow(
        config,
        {
          branch,
          worktreePath,
          mainRepoPath,
          repoName,
          base: argv.base as string | undefined,
          focusPaths,
          prNumber,
          templateName,
          session: argv.session as boolean | undefined,
          layoutName: argv.layout as string | undefined,
          fetch: argv.fetch as boolean,
        },
        {
          onStepStart: (id, message) => {
            if (id === CREATE_STEP_IDS.fetch) console.log(`  Fetching${message ? ` ${message}` : ""}...`);
            else if (id === CREATE_STEP_IDS.copyFiles) console.log("  Copying files...");
            else if (id === CREATE_STEP_IDS.linkFiles) console.log("  Linking files...");
            else if (id === CREATE_STEP_IDS.sharedDeps) console.log("  Sharing dependencies...");
            else if (id === CREATE_STEP_IDS.postCreate) console.log("  Running postCreate hooks...");
            else if (id === CREATE_STEP_IDS.monorepoHooks) console.log("  Running monorepo hooks...");
          },
          onStepDone: (id, message) => {
            if (id === CREATE_STEP_IDS.fetch) console.log("  ✓ Fetched");
            else if (id === CREATE_STEP_IDS.worktree) console.log("  ✓ Worktree created");
            else if (id === CREATE_STEP_IDS.upstream) {
              if (message === "no remote branch") console.log("  ℹ No remote branch found — upstream tracking skipped");
              else console.log(`  ✓ Upstream tracking set ${message ?? ""}`);
            } else if (id === CREATE_STEP_IDS.copyFiles) console.log("  ✓ Files copied");
            else if (id === CREATE_STEP_IDS.linkFiles) console.log("  ✓ Files linked");
            else if (id === CREATE_STEP_IDS.sharedDeps) console.log("  ✓ Dependencies shared");
            else if (id === CREATE_STEP_IDS.focus && message) console.log(`  ✓ Focus set: ${message}`);
            else if (id === CREATE_STEP_IDS.postCreate) console.log("  ✓ Hooks completed");
            else if (id === CREATE_STEP_IDS.monorepoHooks) console.log("  ✓ Monorepo hooks completed");
            else if (id === CREATE_STEP_IDS.session) console.log(`  ✓ Session created: ${message ?? ""}`);
            else if (id === CREATE_STEP_IDS.prMeta) console.log(`  ✓ PR #${prNumber} metadata saved`);
          },
          onStepError: (id, message) => {
            if (id === CREATE_STEP_IDS.fetch) console.log(`  ⚠ ${message}`);
            else if (id === CREATE_STEP_IDS.upstream) console.warn(`  ⚠ Could not set upstream tracking: ${message}`);
            else if (id === CREATE_STEP_IDS.session) console.log(`  ⚠ Session create failed: ${message}`);
            else console.warn(`  ⚠ ${id}: ${message}`);
          },
          onHookOutput: (line) => console.log(`    ${line}`),
        },
      );

      if (result.invalidFocusPaths.length > 0) {
        console.log(`  ⚠ Focus paths not found (skipped): ${result.invalidFocusPaths.join(", ")}`);
      }

      console.log(`\nWorktree ready: ${worktreePath}`);
      process.exit(0);
    } catch (err) {
      if (err instanceof HookTimeoutError) {
        console.error(`\nSetup failed, rolled back.`);
        console.error(`Error: hook timed out: ${err.command}`);
      } else if (err instanceof HookError) {
        console.error(`\nSetup failed, rolled back.`);
        console.error(`Error: hook failed (exit ${err.exitCode}): ${err.command}`);
        if (err.stderr) console.error(err.stderr);
      } else if (err instanceof GitError) {
        console.error(`Error creating worktree: ${err.stderr || err.message}`);
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exit(1);
    }
  },
};

export default cmd;
