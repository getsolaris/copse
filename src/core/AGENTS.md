# src/core/ — Pure Logic Layer

Shared business logic for both CLI and TUI. No UI, no process.exit, no console output.

## Module Map

| File | Responsibility | Key Exports |
|------|---------------|-------------|
| `git.ts` | All git subprocess operations | `GitWorktree` (static class), `invalidateGitCache()` |
| `config.ts` | Config load/validate/expand | `loadConfig()`, `loadRawConfig()`, `getRepoConfig()`, `expandTemplate()`, `validateConfig()`, `initConfig()`, `ensureConfigInitialized()` |
| `workspace.ts` | Parent-directory repo auto-discovery | `discoverRepos()`, `expandWorkspaces()` |
| `doctor.ts` | Health checks + auto-fix | `runAllChecks()`, `runFixes()`, check functions |
| `hooks.ts` | Shell command execution | `executeHooks()`, `HookError`, `HookTimeoutError` |
| `focus.ts` | Monorepo focus metadata + open-target resolution | `readFocus()`, `writeFocus()`, `hasFocus()`, `resolveFocusOpenTarget()`, `FocusNotFoundError` |
| `files.ts` | File copy/symlink ops | `copyFiles()`, `linkFiles()`, `cleanupFiles()` |
| `monorepo.ts` | Monorepo package detection (pnpm/turbo/nx/lerna/yarn) | `detectMonorepoTools()`, `discoverPackages()`, `validateFocusPaths()` |
| `glob-hooks.ts` | Per-package hook matching | `matchHooksForFocus()`, `executeGlobHooks()` |
| `skill-templates.ts` | AI agent skill file generation | `writeSkillFile()`, `generateSkillContent()`, `generateReferenceFiles()`, `getSkillFilePath()` |
| `session.ts` | Tmux session management | `openSession()`, `closeSession()`, `listSessions()`, `SessionError` |
| `orchestration/create-worktree.ts` | Full create-worktree pipeline (fetch → add → upstream → files → hooks → session → PR meta → activity log) | `createWorktreeFlow()` |
| `orchestration/remove-worktree.ts` | Full remove-worktree pipeline (hooks → session kill → remove → activity log). Exposes `planRemoveWorktreeSteps()` + `executeRemoveWorktreeFlow()` so composers (e.g. archive) can share the plan without emitting it twice. | `removeWorktreeFlow()`, `planRemoveWorktreeSteps()`, `executeRemoveWorktreeFlow()` |
| `orchestration/archive-worktree.ts` | Archive worktree as patch + optionally remove. Composes with `removeWorktreeFlow` for the remove phase so archive gets session kill, monorepo postRemove hooks, and the `delete` activity event for free. | `archiveWorktreeFlow()` |
| `orchestration/import-worktree.ts` | Adopt an existing worktree into copse metadata + activity log. | `importWorktreeFlow()` |
| `orchestration/rename-worktree.ts` | Rename branch + optionally move worktree directory + activity log. | `renameWorktreeFlow()` |
| `orchestration/types.ts` | Shared orchestration types | `StepProgressHandler`, `CREATE_STEP_IDS`, `REMOVE_STEP_IDS`, `ARCHIVE_STEP_IDS`, `IMPORT_STEP_IDS`, `RENAME_STEP_IDS`, `CreateWorktreeOpts`, `RemoveWorktreeOpts`, `ArchiveWorktreeOpts`, `ImportWorktreeOpts`, `RenameWorktreeOpts` |
| `types.ts` | Shared types + errors | `Worktree`, `GitError`, `GitVersionError` |
| `test-helpers.ts` | Test utilities | `createTempRepo()`, `createTempDir()`, `cleanupTempDirs()` |

## Git Subprocess Cache

`git.ts` caches results in a module-level `Map<string, CacheEntry>` with 3-second TTL.

**Cache keys**: `list:{repoPath}`, `ahead-behind:{dir}:{branch}`, `last-commit:{dir}`, `dirty-count:{dir}`

**MUST invalidate** (`invalidateGitCache()`) after:
- `GitWorktree.add()`, `.remove()`, `.move()`, `.prune()`, `.unlock()`
- Any operation that changes git state

**MUST NOT** cache write operations or assume stale data is safe.

## Config Loading: `loadConfig` vs `loadRawConfig`

`config.ts` exposes **two** loaders. They share the same parse/validate path but differ on a single critical step — **whether `expandWorkspaces()` runs**:

| Function | Workspace expansion | Use for |
|---|---|---|
| `loadConfig()` | ✓ runs (discovered repos merged into `repos[]`) | Operational code that needs the full set of known repos: CLI commands, TUI worktree list, git operations |
| `loadRawConfig()` | ✗ skipped | Code that displays or **writes back** the user-authored config file: `ConfigView.tsx` |

**Why this split is mandatory:** writing an expanded config back to disk via `writeAtomically()` would serialize every workspace-discovered repo as if the user had typed it into `repos[]`, permanently. Subsequent loads then see them as explicit entries even after the workspace is removed. `loadRawConfig()` exists to prevent that footgun.

**Rule of thumb:** if your code path eventually calls `writeAtomically(getConfigPath(), …)`, it MUST use `loadRawConfig()` to read the current state first. All other read paths use `loadConfig()`.

## First-Run Auto-Init

`ensureConfigInitialized(overridePath?)` is called once per process from `src/cli/index.ts` (skipped only when the user explicitly runs `copse init`). It is idempotent: returns `{ path, created: false }` when the file already exists, otherwise creates `DEFAULT_CONFIG` and returns `{ path, created: true }`. The CLI prints a one-line stderr notice only when `created === true` AND `process.stdout.isTTY` (so pipes and CI stay quiet).

## Doctor Pattern

`runAllChecks(cwd)` fetches worktrees **once** and passes the array to all check functions:
```typescript
const worktrees = await GitWorktree.list(cwd).catch((): Worktree[] => []);
checkStaleWorktrees(worktrees);      // sync — takes Worktree[]
checkOrphanedDirectories(worktrees); // sync — takes Worktree[]
checkLockStatus(worktrees);          // sync — takes Worktree[]
checkDirtyWorktrees(worktrees);      // sync — takes Worktree[]
```
Never add new checks that call `list()` independently.

## Testing Rules

- Test files: `*.test.ts` co-located in this directory
- **Always** in `afterEach`: `cleanupTempDirs()` + `invalidateGitCache()`
- Use `createTempRepo()` for git operations, `createTempDir()` for filesystem ops
- `runGit()` helper sets deterministic author/committer env vars
- Access private methods via `(GitWorktree as any).methodName` when needed

## Error Contract

- Core functions **throw** — never `process.exit()` or `console.error()`
- Custom errors carry structured data (`exitCode`, `stderr`, `command`)
- Use `empty catch {}` only for genuinely optional fallbacks (e.g., `.catch(() => false)`)

## Orchestration Layer (CLI/TUI Parity)

**`src/core/orchestration/`** is the single source of truth for multi-step worktree operations. CLI commands (`src/cli/cmd/{add,remove,archive,import,rename}.ts`) and TUI views (`src/tui/views/WorktreeCreate.tsx`, `WorktreeRemove.tsx`, `BulkActions.tsx`) delegate to the same flow functions.

**Rule:** any step that triggers a side effect during worktree create/remove/archive/import/rename MUST live here, not in the caller. Adding a new config-driven step (e.g., new hook, new metadata write) to only one caller is a bug — it WILL drift.

**Composition pattern:** when one flow needs to reuse another (e.g. `archiveWorktreeFlow` needs to remove the worktree when `--keep` is false), use the split `planXxxSteps()` + `executeXxxFlow()` pair. The composer:

1. Calls `planRemoveWorktreeSteps()` to get the remove plan without executing or emitting it.
2. Emits a combined plan via `handler.onStepPlan` ONCE, up front.
3. Executes its own steps.
4. Calls `executeRemoveWorktreeFlow()` (which does NOT call `onStepPlan` again) with a handler stripped of `onStepPlan`.

This keeps the UI's step list stable — no mid-flow plan re-emission.

### Handler contract

Each flow accepts a `StepProgressHandler` for UI feedback:

```typescript
interface StepProgressHandler {
  onStepPlan?: (steps: readonly StepPlanEntry[]) => void;   // called once, up-front
  onStepStart?: (id: string, message?: string) => void;
  onStepDone?: (id: string, message?: string) => void;
  onStepError?: (id: string, message: string) => void;
  onHookOutput?: (line: string) => void;
}
```

- CLI handlers print to `console.log` / `console.warn`
- TUI handlers update SolidJS progress state (`progressSteps` signal)
- Tests assert on step IDs via the same handler

### Step IDs

Step IDs are constants (`CREATE_STEP_IDS`, `REMOVE_STEP_IDS`) — never hardcode strings in consumers. Tests in `orchestration.test.ts` verify:
- `onStepPlan` fires exactly once, ordered correctly for the config
- Each step's `onStepStart` → (`onStepDone` or `onStepError`) lifecycle completes
- Same config produces identical plan across CLI and TUI callers (parity invariant)

### Rollback

`createWorktreeFlow` auto-removes the worktree (force=true, best-effort) when any step after `worktree` throws. Callers only see the original error.

## Bun API Access

All Bun API calls use `(Bun as any)` cast — required because `shims.d.ts` declares `Bun: any`.
```typescript
(Bun as any).spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
(Bun as any).env.HOME
(Bun as any).cwd
```
Exception: `Bun.Glob` and `Bun.env` are used directly in files that don't go through the shim.
