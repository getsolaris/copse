# src/tui/ — Terminal UI Layer

SolidJS + @opentui/solid interactive terminal UI. Launched by `omw` (no args).

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
    │   ├── ConfigView (views/ConfigView.tsx) — config display
    │   ├── CommandPalette (views/CommandPalette.tsx) — Ctrl+P fuzzy search
    │   └── Spinner (views/Spinner.tsx) — animated braille dots spinner
    └── Footer bar (keyboard hints)
```

## State Architecture

**AppContext** (`activeTab`, `selectedWorktreeIndex`, `showRemove`, `showCommandPalette`)
- `TabId = "list" | "add" | "config" | "doctor"`
- Only ONE modal at a time (CommandPalette or Remove)

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

SolidJS JSX transform is loaded via `bunfig.toml` preload (`@opentui/solid/preload`).
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
