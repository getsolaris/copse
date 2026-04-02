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
    │   └── CommandPalette (views/CommandPalette.tsx) — Ctrl+P fuzzy search
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

## Performance Rules

- **Debounce detail fetches**: WorktreeList uses 150ms debounce on selection change. Prevents subprocess spam during rapid j/k navigation.
- **Guard stale responses**: After async fetch, verify `selectedWt()?.path === path` before `setExtra()`.
- **@opentui renders differentially**: Only changed terminal cells are written. Rendering is NOT the bottleneck — git subprocesses are.

## Rendering Primitives

Use `@opentui/solid` elements only — never raw ANSI:
```tsx
<box x={0} y={0} width={w} height={h} backgroundColor={theme.bg.base}>
<text x={1} y={0} fg={theme.text.primary}>{"content"}</text>
<scrollbox>...</scrollbox>
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
