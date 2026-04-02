# AGENTS.md — oh-my-worktree

## Project Overview

Git worktree manager with TUI (SolidJS + @opentui/solid) and CLI (yargs). Runtime: Bun. Language: TypeScript (strict mode).

## Build / Lint / Test Commands

```bash
bun run typecheck          # tsc --noEmit --skipLibCheck
bun test                   # Run all tests
bun test src/core/git      # Run tests in a single file (partial match)
bun test --filter "parses" # Run tests matching description
bun run build              # Bundle to dist/omw.js
bun run src/index.ts       # Launch TUI (dev mode)
bun run src/index.ts <cmd> # Run CLI command (dev mode)
```

No linter or formatter is configured. Follow existing code style exactly.

## Architecture

```
src/
  cli/
    index.ts          # CLI entrypoint — yargs setup, lazy imports commands
    cmd/*.ts           # One file per CLI command (CommandModule export default)
  tui/
    App.tsx            # TUI entrypoint — SolidJS + @opentui/solid
    context/*.tsx       # SolidJS context providers (AppContext, GitContext)
    views/*.tsx         # SolidJS components (WorktreeList, Sidebar, DoctorView, etc.)
    themes.ts          # Theme definitions
  core/
    git.ts             # GitWorktree static class — all git subprocess operations
    config.ts          # Config loading, validation, expansion
    hooks.ts           # Hook execution (postCreate, postRemove)
    doctor.ts          # Health check functions
    focus.ts           # Focus metadata (stored in git internals)
    files.ts           # File copy/symlink operations
    monorepo.ts        # Monorepo detection and package discovery
    glob-hooks.ts      # Glob-matched per-package hooks
    types.ts           # Shared types and custom error classes
    test-helpers.ts    # Temp repo creation, cleanup for tests
```

## Code Style

### Imports

- Use `.ts` extensions for local imports: `import { GitWorktree } from "./git.ts";`
- Use `.tsx` extensions for JSX files: `import { useApp } from "../context/AppContext.tsx";`
- Group order: third-party → node builtins → local modules (no blank lines between groups)
- Use `import type` for type-only imports: `import type { CommandModule } from "yargs";`

### TypeScript

- `strict: true` — no `as any`, `@ts-ignore`, `@ts-expect-error`
- Exception: `(Bun as any)` is the established pattern for Bun API calls (shims.d.ts declares `Bun: any`)
- Prefer `interface` over `type` for object shapes
- Export types alongside their implementations in the same file
- Custom error classes extend `Error` with structured fields (see `types.ts`)

### Naming

- Files: kebab-case (`glob-hooks.ts`, `test-helpers.ts`)
- Functions/variables: camelCase (`expandTemplate`, `worktreePath`)
- Classes: PascalCase (`GitWorktree`, `HookError`)
- Types/Interfaces: PascalCase (`ResolvedRepoConfig`, `DoctorCheckResult`)
- Constants: camelCase or UPPER_SNAKE for module-level (`DEFAULT_CACHE_TTL`, `SIDEBAR_W`)

### Error Handling

- Custom error classes with structured data: `GitError(message, exitCode, stderr, command)`
- CLI commands catch errors and print user-friendly messages before `process.exit(1)`
- Core functions throw errors — CLI layer catches and formats
- Empty `catch {}` blocks are acceptable for optional/fallback operations
- Never swallow errors silently in core logic

### Async Patterns

- Use `Promise.all()` for independent parallel operations
- Sequential execution for dependent operations (hooks execute in order)
- git.ts has a TTL cache (`gitCache`) — invalidate with `invalidateGitCache()` after mutations

### CLI Commands

Every CLI command follows this pattern:
```typescript
import type { CommandModule } from "yargs";

const cmd: CommandModule = {
  command: "name <required> [optional]",
  aliases: ["alias"],
  describe: "One-line description",
  builder: (yargs) => yargs.option("flag", { type: "boolean", alias: "f", describe: "..." }),
  handler: async (argv) => {
    try {
      // implementation
      process.exit(0);
    } catch (err) {
      if (err instanceof GitError) {
        console.error(`Git error: ${err.message}`);
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exit(1);
    }
  },
};

export default cmd;
```

Register new commands in `src/cli/index.ts` — add to the `Promise.all` import array and chain `.command()`.

### TUI Components

- SolidJS JSX with `@opentui/solid` primitives: `<box>`, `<text>`, `<scrollbox>`
- Use `createSignal` for local state, `createMemo` for derived values
- Use `createEffect(on(...))` for side effects with explicit dependencies
- Keyboard handlers via `useKeyboard()` — check `app.activeTab()` to scope key bindings
- Theme colors via `theme.text.primary`, `theme.bg.base`, etc. (never hardcode colors)
- Declare JSX intrinsic elements in App.tsx (`declare module "solid-js"`)

### Testing

- Test framework: `bun:test` — import `{ describe, it, expect, afterEach }` from `"bun:test"`
- Test files: co-located as `*.test.ts` in `src/core/`
- Use `test-helpers.ts`: `createTempRepo()`, `createTempDir()`, `cleanupTempDirs()`
- Always call `cleanupTempDirs()` in `afterEach`
- Call `invalidateGitCache()` in `afterEach` when testing git operations
- Structure: `describe("ClassName.method")` → `it("does specific thing")`

### Git Operations

All git commands go through `GitWorktree.run()` (private static). This:
- Spawns `Bun.spawn(["git", ...args])` with `LC_ALL=C` for deterministic output
- Captures stdout/stderr via `new Response(proc.stdout).text()`
- Throws `GitError` on non-zero exit code
- Results are cached with 3-second TTL — call `invalidateGitCache()` after write operations

### Performance

- git subprocess cache: 3s TTL in `gitCache` (Map). Always invalidate after mutations (add/remove/lock).
- TUI detail view: 150ms debounce on selection change to prevent subprocess spam during j/k navigation.
- Doctor checks: `runAllChecks()` fetches worktrees once and passes the array to all check functions.

## Subdirectory Guides

- `src/core/AGENTS.md` — Module API surface, git cache invalidation rules, error contracts, testing patterns
- `src/tui/AGENTS.md` — Component tree, state architecture, keyboard scoping, theme integration, performance rules

## Key Constraints

- Runtime is Bun, not Node — use `Bun.spawn`, `Bun.Glob`, `Bun.env`
- No standalone binary — distributed as npm package (`bun install -g`)
- TUI uses SolidJS JSX transform via `bunfig.toml` preload (Babel plugin)
- Config file: `~/.config/oh-my-worktree/config.json` (XDG-compliant)
- Focus metadata: stored in git internals (`<gitdir>/omw-focus`), not in worktree root
