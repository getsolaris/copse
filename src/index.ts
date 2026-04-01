#!/usr/bin/env bun
// Explicitly import the SolidJS preload so it works regardless of cwd
// (bunfig.toml preload only works when running from the project directory)
import "@opentui/solid/preload";

import "./cli/index.ts";
