# src/core/ — Pure Logic Layer

Shared business logic for both CLI and TUI. No UI, no process.exit, no console output.

## Module Map

| File | Responsibility | Key Exports |
|------|---------------|-------------|
| `git.ts` | All git subprocess operations | `GitWorktree` (static class), `invalidateGitCache()` |
| `config.ts` | Config load/validate/expand | `loadConfig()`, `getRepoConfig()`, `expandTemplate()`, `validateConfig()` |
| `doctor.ts` | Health checks + auto-fix | `runAllChecks()`, `runFixes()`, check functions |
| `hooks.ts` | Shell command execution | `executeHooks()`, `HookError`, `HookTimeoutError` |
| `focus.ts` | Monorepo focus metadata | `readFocus()`, `writeFocus()`, `hasFocus()` |
| `files.ts` | File copy/symlink ops | `copyFiles()`, `linkFiles()`, `cleanupFiles()` |
| `monorepo.ts` | Workspace detection | `detectMonorepoTools()`, `discoverPackages()`, `validateFocusPaths()` |
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
