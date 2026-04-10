#!/usr/bin/env bun
// DO NOT REMOVE: bunfig.toml's preload only runs from the project cwd,
// but Homebrew invokes `bun run $LIBEXEC/src/index.ts` from the user's cwd.
// Without this explicit import, @opentui/solid's runtime plugin never
// registers and JSX falls back to react/jsx-dev-runtime (see git 41cc2d3
// regression). Idempotent and safe for the bundled dist/copse.js path.
import "@opentui/solid/preload";

import "./cli/index.ts";
