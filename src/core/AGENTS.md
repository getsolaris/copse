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

`ensureConfigInitialized(overridePath?)` is called once per process from `src/cli/index.ts` (skipped only when the user explicitly runs `omw init`). It is idempotent: returns `{ path, created: false }` when the file already exists, otherwise creates `DEFAULT_CONFIG` and returns `{ path, created: true }`. The CLI prints a one-line stderr notice only when `created === true` AND `process.stdout.isTTY` (so pipes and CI stay quiet).

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

## Bun API Access

All Bun API calls use `(Bun as any)` cast — required because `shims.d.ts` declares `Bun: any`.
```typescript
(Bun as any).spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
(Bun as any).env.HOME
(Bun as any).cwd
```
Exception: `Bun.Glob` and `Bun.env` are used directly in files that don't go through the shim.
