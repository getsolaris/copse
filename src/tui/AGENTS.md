# src/tui/ — Terminal UI Layer

SolidJS + @opentui/solid interactive terminal UI. Launched by `copse` (no args).

## Component Tree

```
App.tsx (launchTUI → render)
├── AppProvider (context/AppContext.tsx) — UI state: activeTab, selectedIndex, modals
├── GitProvider (context/GitContext.tsx) — data: worktrees, refetch, loading, error
└── AppShell
    ├── Header bar
    ├── Sidebar (views/Sidebar.tsx) — worktree list with j/k navigation
    ├── Main content (switched by activeTab)
    │   ├── WorktreeList (views/WorktreeList.tsx) — detail view + status info
    │   ├── WorktreeCreate (views/WorktreeCreate.tsx) — branch + focus input form
    │   ├── WorktreeRemove (views/WorktreeRemove.tsx) — confirmation dialog
    │   ├── DoctorView (views/DoctorView.tsx) — health checks + auto-fix
    │   ├── ConfigView (views/ConfigView.tsx) — full config display + inline editing (string, strArray as JSON, boolean, theme, enum) with Tab-cycle through field-specific presets, via setNestedValue + writeAtomically. Loads via `loadRawConfig()` (NOT `loadConfig()`) so workspace-discovered repos are not shown in the `Repos` section nor serialized back to disk on edit. Renders a dedicated `Workspaces` section above `Repos` listing each `workspaces[]` entry (path, depth, exclude, defaults).
    │   ├── CommandPalette (views/CommandPalette.tsx) — Ctrl+P fuzzy search
    │   ├── FocusPicker (views/FocusPicker.tsx) — modal picker for `o` key when worktree has 2+ focus paths
    │   └── Spinner (views/Spinner.tsx) — animated braille dots spinner
    └── Footer bar (keyboard hints)
```

## State Architecture

**AppContext** (`activeTab`, `selectedWorktreeIndex`, `showRemove`, `showCommandPalette`, `focusPickerData`)
- `TabId = "list" | "add" | "config" | "doctor"`
- Only ONE modal at a time (CommandPalette, Remove, BulkActions, or FocusPicker)
- `focusPickerData: { worktreePath, focusPaths } | null` — when set, FocusPicker is shown and the global `useKeyboard` yields to the picker's own handler

**GitContext** (`worktrees`, `refetch`, `loading`, `error`)
- `createResource` fetches worktrees on mount
- `refetch()` invalidates git cache then re-fetches
- Components read `git.worktrees()` reactively

## Keyboard Handler Scoping

Every `useKeyboard()` callback MUST check active state first:
```typescript
useKeyboard((event: any) => {
  if (app.activeTab() !== "list") return;  // scope to tab
  if (app.showCommandPalette()) return;     // yield to modal
  // handle keys...
});
```
Failing to scope causes key conflicts across views.

### inputFocused Guard Pattern

When native `<input>` components are focused, global shortcuts must be guarded. Escape and Ctrl+P always pass through; everything else yields to the input:
```typescript
useKeyboard((event) => {
  // These always pass through regardless of input focus
  if (event.name === "escape") { ... }
  if (event.ctrl && event.name === "p") { ... }
  // Block other keys while an input is focused
  if (app.inputFocused()) return;
  // Normal key handling below...
});
```
The `inputFocused` signal lives in AppContext and is set/cleared by `<input>` focus/blur events.

## Worktree Operations: Delegate to Orchestration

TUI views that create or remove worktrees **must not** re-implement the pipeline (fetch, copy files, hooks, session create/kill, activity log, etc.). Call `createWorktreeFlow` / `removeWorktreeFlow` from `src/core/orchestration/` instead.

**Why:** adding a feature to only one caller (CLI or TUI) is how parity bugs happen — missing session auto-create, missing monorepo postRemove hooks, missing activity logs. The orchestration layer is the single source of truth; the handler callbacks are the ONLY UI-specific glue.

**Pattern:**
```tsx
const stepIndexById: Record<string, number> = {};
await createWorktreeFlow(config, opts, {
  onStepPlan: (plan) => {
    const steps = plan.map((entry, idx) => {
      stepIndexById[entry.id] = idx;
      return { label: entry.label, status: "pending" as StepStatus };
    });
    setProgressSteps(steps);
  },
  onStepStart: (id) => updateStep(stepIndexById[id], { status: "running" }),
  onStepDone: (id, message) => updateStep(stepIndexById[id], { status: "done", message }),
  onStepError: (id, message) => updateStep(stepIndexById[id], { status: "error", message }),
  onHookOutput: (line) => {
    const lastRunning = progressSteps().findLastIndex(s => s.status === "running");
    if (lastRunning >= 0) updateStep(lastRunning, { message: line });
  },
});
```

Views that delegate today: `WorktreeCreate.tsx`, `WorktreeRemove.tsx`, `BulkActions.tsx`.

## Performance Rules

- **Debounce detail fetches**: WorktreeList uses 150ms debounce on selection change. Prevents subprocess spam during rapid j/k navigation.
- **Guard stale responses**: After async fetch, verify `selectedWt()?.path === path` before `setExtra()`.
- **@opentui renders differentially**: Only changed terminal cells are written. Rendering is NOT the bottleneck — git subprocesses are.
- **Spinner cleanup**: Spinner uses `setInterval` (80ms tick) for braille dot animation. Always cleaned up via `onCleanup` — no leaked intervals.

## Rendering Primitives

Use `@opentui/solid` elements only — never raw ANSI:
```tsx
<box x={0} y={0} width={w} height={h} backgroundColor={theme.bg.base}>
<text x={1} y={0} fg={theme.text.primary}>{"content"}</text>
<scrollbox height={N} focused>...</scrollbox>
<input value={val()} onInput={setVal} placeholder="..." focused={bool} />
<diff content={diffText} mode="unified" />
<code language="diff" code={codeText} />
```

`<Portal>` wraps modals to guarantee correct z-ordering above all other content:
```tsx
import { Portal } from "@opentui/solid";
<Portal><PopupShell>...</PopupShell></Portal>
```

## Theme Integration

Import `theme` from `../themes.ts`. Never hardcode colors.
```typescript
theme.text.primary    // fg color
theme.bg.base         // background
theme.text.error      // red
theme.text.success    // green
theme.text.warning    // yellow
theme.text.accent     // highlight
theme.border.default  // border
theme.select.focusedBg // selected item bg
```

### Syntax Highlighting

For diff and code blocks, use theme-aware syntax colors:
```typescript
theme.syntax?.keyword  // syntax highlight colors (optional field)

import { getSyntaxStyle } from "../themes.ts";
const syntaxStyle = getSyntaxStyle(themeName);
// Returns SYNTAX_DARK or SYNTAX_LIGHT based on the active theme
```
Pass `syntaxStyle` to `<code>` or `<diff>` components that accept a `theme` prop.

## JSX Setup

SolidJS JSX transform is registered by `@opentui/solid/preload`, which is loaded two ways:

1. **`bunfig.toml` preload** — applies when Bun is invoked from the project root (local dev, tests).
2. **Explicit `import "@opentui/solid/preload"` in `src/index.ts`** — applies when Bun is invoked from a different cwd, which is how Homebrew launches us (`bun run $LIBEXEC/src/index.ts`). Without this import, the Homebrew path fails with `Cannot find module 'react/jsx-dev-runtime'` (see git 41cc2d3 regression).

The bundled `dist/copse.js` does not need either: the build plugin in `scripts/build.ts` transforms JSX at build time and strips the runtime preload import from the bundle.

Intrinsic elements declared in `App.tsx`:
```typescript
declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      box: any; text: any; scrollbox: any; input: any; select: any;
    }
  }
}
```
