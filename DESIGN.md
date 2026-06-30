# Copse Design System

## 1. Atmosphere & Identity

Copse is a quiet terminal command center for repeated git worktree operations. It should feel dense, predictable, and calm: the user is already inside a developer workflow, so the UI prioritizes scan speed, stable layout, and terse state feedback. The signature is a low-noise split between a persistent worktree sidebar and focused modal overlays.

## 2. Color

Colors come from `src/tui/themes.ts`. Components must use semantic theme tokens, not literal hex values.

| Role | Token | Usage |
|------|-------|-------|
| Base surface | `theme.bg.base` | Main workspace background |
| Panel surface | `theme.bg.surface` | Sidebar and large content panels |
| Elevated surface | `theme.bg.elevated` | Dialogs, focused overlays, selected groups |
| Overlay surface | `theme.bg.overlay` | Header, footer, modal backdrop |
| Text primary | `theme.text.primary` | Main content |
| Text secondary | `theme.text.secondary` | Hints, labels, inactive controls |
| Text accent | `theme.text.accent` | Current focus, links, primary action text |
| Text success | `theme.text.success` | Completed work |
| Text warning | `theme.text.warning` | Pending or caution states |
| Text error | `theme.text.error` | Failures and destructive warnings |
| Border default | `theme.border.default` | Standard separators |
| Border active | `theme.border.active` | Focused dialog and active borders |
| Border subtle | `theme.border.subtle` | Low-emphasis dividers |

## 3. Typography

The terminal controls typography. Use the current terminal monospace font and one-cell line heights. Text hierarchy comes from position, color, bold spans, and terse labels rather than font size.

| Level | Treatment | Usage |
|-------|-----------|-------|
| Header | Bold or accent text | Panel and dialog titles |
| Body | Primary text | Worktree details and modal body |
| Label | Secondary text | Field labels and key hints |
| Status | Success, warning, or error token | Async state feedback |

## 4. Spacing & Layout

The base unit is one terminal cell. Layout should be deterministic at common widths from 80 to 160 columns.

| Token | Value | Usage |
|-------|-------|-------|
| Cell-1 | 1 column or row | Tight label and line rhythm |
| Cell-2 | 2 columns or rows | Modal footer groups and compact gaps |
| Cell-4 | 4 columns | Minimum screen edge margin for dialogs |

Rules:
- Dialog widths clamp to terminal width and avoid overflow.
- Repeated controls fit on one line at 80 columns when possible.
- Long paths may wrap in detail views, but modal titles and controls must not wrap awkwardly.

## 5. Components

### PopupShell
- Structure: `PopupShell` wraps a bordered `box`, optional backdrop, title, content, and footer.
- Variants: default modal, warning modal, error modal, success modal.
- Spacing: `paddingX={1}`, `paddingY={1}`, and `gap={0..1}`.
- States: idle, loading, success, failure, unsupported.
- Accessibility: every modal exposes keyboard hints in the footer and supports Escape where dismissal is safe.
- Motion: no layout animation. State changes are immediate.

### Status Text
- Structure: one-line message using semantic color tokens.
- Variants: success, warning, error, secondary.
- Spacing: sits on its own terminal row.
- States: loading, done, failed.
- Accessibility: status meaning is conveyed by text first, color second.

## 6. Motion & Interaction

Terminal interactions are immediate. Use no decorative animation except existing loading spinners for real async work.

| Type | Timing | Usage |
|------|--------|-------|
| Immediate | 0 ms | Modal state changes and keyboard actions |
| Spinner | Existing `Spinner` cadence | Long-running loading work only |

Every modal must document active keys in visible footer text. Destructive or mutating actions require Enter or an explicit mnemonic key.

## 7. Depth & Surface

Depth strategy is borders plus tonal shift. Use `theme.bg.elevated` for dialogs, `theme.bg.overlay` for modal backdrops, and `theme.border.active` or status-specific text colors to signal state. Do not add shadows, raw ANSI art, or hardcoded color escapes.
