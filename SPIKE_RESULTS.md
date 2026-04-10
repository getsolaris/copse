# Spike Results: OpenTUI + bun build --compile

## Summary
- **Dev mode works**: YES (bunfig.tcop preload registers Babel JSX transform)
- **Standalone binary compile result**: FAIL (SolidJS JSX transform not applied at compile time)
- **Binary size**: 63 MB (compiled but non-functional)
- **Final distribution decision**: npm global package (`bun install -g copse`)

## Dev Mode Test
```text
  Hello from copse!

  OpenTUI + SolidJS is working!
```
Dev mode confirmed working with `bun run src/spike.tsx`.

## Compile Attempts

### Attempt 1: --compile --minify --bytecode
```
error: "await" can only be used inside an "async" function
  at @opentui/core/index-wv534m5j.js:1683:31
error: top-level await transform failure
```
Result: exit 1 (top-level await in @opentui/core Yoga WASM loader)

### Attempt 2: --compile --minify (no bytecode)
```
[26ms]  minify  -4.79 MB (estimate)
[11ms]  bundle  31 modules
[185ms] compile  /tmp/copse-spike-no-bytecode
```
Result: exit 0 — binary created (63MB)

### Binary Runtime Test
```
$ cd /tmp && ./copse-spike-no-bytecode
[TUI launches, shows OpenTUI Console panel with error stack]
at VZ (/$bunfs/root/copse-spike-no-bytecode:160:51856)
at render (/$bunfs/root/copse-spike-no-bytecode:160:95126)
```
Result: TUI loads but crashes — SolidJS JSX was compiled as React-style JSX (wrong transform)

## Root Cause Analysis

OpenTUI SolidJS requires a **Babel JSX transform** (babel-preset-solid) that:
- In dev mode: Registered via `bunfig.tcop` preload → Bun plugin intercepts module loading
- In compiled binary: The preload mechanism doesn't survive compilation

The `bun-plugin` approach for build-time JSX transform fails due to:
```
TypeError: _debug is not a function
  at @babel/traverse/lib/path/index.js:31
```
Babel's `debug` module has CJS/ESM incompatibility in Bun's bundler context.

## Why Standard Binary Distribution Fails
1. `--bytecode`: Fails (top-level await in @opentui/core Yoga WASM)
2. Without `--bytecode`: Binary created but SolidJS JSX not properly transformed
3. bun-plugin at build-time: Babel/debug module CJS/ESM incompatibility
4. Result: Cannot create a working standalone binary with current @opentui/solid

## Final Distribution Decision

**npm global package** — ship as `bun install -g copse`

Rationale:
- copse targets developers who already use git worktrees and modern JS tools
- Requiring Bun is reasonable (like requiring Node for npm tools)
- This is how `degit`, `vite`, `tsx`, and other developer tools distribute
- Homebrew formula: `depends_on "oven-sh/bun/bun"` + install via bun
- curl install: install Bun if not present, then `bun install -g copse`

## Impact on Task 20 (Build Script)

Task 20 MUST be updated to:
- NOT use `bun build --compile`
- Instead: `bun build --outfile dist/copse.js` (bundle without compile)
- Set shebang `#!/usr/bin/env bun` in the bundled output
- package.json `bin.copse` → `dist/copse.js`
- GitHub releases: upload the bundled `dist/copse.js` (not compiled binaries)
- Homebrew formula: download `dist/copse.js` from GitHub release, use bun as dependency
- curl install: install bun if needed + download dist/copse.js to ~/.local/bin/copse

## Impact on Tasks 15-19 (TUI)

TUI tasks can proceed as-is with `@opentui/solid` — dev mode is confirmed working.
The only change is distribution approach (npm package instead of standalone binary).
NO changes needed to TUI implementation tasks.
