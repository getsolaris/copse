# Current Command Groups

Use this file as a convenience reference. Re-check the registry before large smoke runs.
Trust the source code over this file if they diverge.

**Note:** All references to `oml` should be replaced with `copse`, and `oh-my-lemontree` with `copse`.

## TUI Startup

- `bun run src/index.ts`

---

## Config / Init / Shell Setup

### `config`

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--init` | boolean | — | Create default config file |
| `--show` | boolean | `-s` | Print config JSON to stdout |
| `--edit` | boolean | `-e` | Open config in `$EDITOR` |
| `--path` | boolean | — | Print config file path |
| `--validate` | boolean | — | Validate config against schema |
| `--profiles` | boolean | — | List all config profiles |
| `--profile` | string | — | Profile name (use with `--activate` or `--delete`) |
| `--activate` | boolean | — | Activate named profile (requires `--profile`) |
| `--delete` | boolean | — | Delete named profile (requires `--profile`) |

**Test invocations:**

```bash
# --init: creates config file
bun run src/index.ts config --init
# expect: exit 0, config file created at $XDG_CONFIG_HOME/copse/config.json

# --path: prints config path
bun run src/index.ts config --path
# expect: exit 0, prints absolute path to config.json

# --show: prints config JSON
bun run src/index.ts config --show
# expect: exit 0, valid JSON on stdout

# --validate: validates config
bun run src/index.ts config --validate
# expect: exit 0 on valid config, exit 1 on invalid

# --edit: opens editor (use EDITOR=/usr/bin/true to avoid blocking)
EDITOR=/usr/bin/true bun run src/index.ts config --edit
# expect: exit 0, editor invoked and returned

# --profiles: lists profiles
bun run src/index.ts config --profiles
# expect: exit 0, lists available profiles (empty list is valid)

# --profile + --activate: activates a profile
bun run src/index.ts config --profile work --activate
# expect: exit 0 if profile exists, exit 1 if not found

# --profile + --delete: deletes a profile
bun run src/index.ts config --profile work --delete
# expect: exit 0 if profile exists and deleted, exit 1 if not found

# negative: --activate without --profile
bun run src/index.ts config --activate
# expect: exit 1, error message about missing --profile

# negative: --delete without --profile
bun run src/index.ts config --delete
# expect: exit 1, error message about missing --profile
```

---

### `init`

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--skill` | string | `-s` | Install AI agent skill (choices: `claude-code`, `codex`, `opencode`) |

**Test invocations:**

```bash
# no flags: creates config.json
bun run src/index.ts init
# expect: exit 0, config.json created at $XDG_CONFIG_HOME/copse/config.json

# --skill claude-code: installs claude-code skill
bun run src/index.ts init --skill claude-code
# expect: exit 0, skill files written to $HOME/.claude/skills/oml/

# --skill opencode: installs opencode skill
bun run src/index.ts init --skill opencode
# expect: exit 0, skill files written to $XDG_CONFIG_HOME/opencode/skill/oml/

# -s alias
bun run src/index.ts init -s claude-code
# expect: exit 0, same as --skill claude-code

# negative: invalid skill name
bun run src/index.ts init --skill invalid-platform
# expect: exit 1, error listing valid choices

# idempotent: running twice does not error
bun run src/index.ts init
bun run src/index.ts init
# expect: both exit 0
```

---

### `shell-init [shell]`

| Positional | Values | Description |
|------------|--------|-------------|
| `shell` | `bash`, `zsh`, `fish` | Shell to generate integration for |

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--completions` | string | — | Generate shell completions for given shell |

**Test invocations:**

```bash
# positional bash
bun run src/index.ts shell-init bash
# expect: exit 0, shell function definition on stdout

# positional zsh
bun run src/index.ts shell-init zsh
# expect: exit 0, shell function definition on stdout

# positional fish
bun run src/index.ts shell-init fish
# expect: exit 0, fish function definition on stdout

# --completions bash
bun run src/index.ts shell-init --completions bash
# expect: exit 0, bash completion script on stdout

# --completions zsh
bun run src/index.ts shell-init --completions zsh
# expect: exit 0, zsh completion script on stdout

# --completions fish
bun run src/index.ts shell-init --completions fish
# expect: exit 0, fish completion script on stdout

# no args
bun run src/index.ts shell-init
# expect: exit 0 or exit 1 with usage hint (verify current behavior)
```

---

## Worktree Lifecycle

### `add [branch] [path]`

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--create` | boolean | `-c` | Compatibility flag for branch creation |
| `--base` | string | `-b` | Base branch/commit for new branch |
| `--focus` | array/string | `-f` | Focus packages for monorepo |
| `--template` | string | `-t` | Named template from config |
| `--pr` | number | — | GitHub PR number (requires `gh` CLI) |
| `--session` | boolean | `-s` | Create tmux session after add |
| `--layout` | string | — | Session layout name from config |

**Test invocations:**

```bash
# bare add: creates branch + worktree
bun run src/index.ts add feature/smoke-test
# expect: exit 0, worktree created, git worktree list shows new entry

# --base: new branch from specific base
bun run src/index.ts add feature/smoke-base --base main
# expect: exit 0, branch created from main

# -b alias
bun run src/index.ts add feature/smoke-b-alias -b main
# expect: exit 0, same as --base main

# --create / -c: compatibility flag
bun run src/index.ts add feature/smoke-create --create
# expect: exit 0, worktree created

bun run src/index.ts add feature/smoke-c -c
# expect: exit 0, same as --create

# --focus single package
bun run src/index.ts add feature/smoke-focus --focus apps/web
# expect: exit 0, focus metadata stored in git internals

# --focus multiple (comma-separated)
bun run src/index.ts add feature/smoke-focus-multi --focus apps/web,apps/api
# expect: exit 0, both packages in focus metadata

# --focus multiple (repeated flag)
bun run src/index.ts add feature/smoke-focus-repeat --focus apps/web --focus apps/api
# expect: exit 0, both packages in focus metadata

# -f alias
bun run src/index.ts add feature/smoke-f -f apps/web
# expect: exit 0, same as --focus

# --template: apply named template
bun run src/index.ts add feature/smoke-template --template review
# expect: exit 0 if template exists in config, exit 1 if template not found

# -t alias
bun run src/index.ts add feature/smoke-t -t review
# expect: exit 0, same as --template review

# --session: create tmux session (requires tmux)
bun run src/index.ts add feature/smoke-session --session
# expect: exit 0, worktree created, tmux session created

# -s alias
bun run src/index.ts add feature/smoke-s -s
# expect: exit 0, same as --session

# --layout: session layout (requires --session or sessions.autoCreate)
bun run src/index.ts add feature/smoke-layout --session --layout dev
# expect: exit 0, session created with named layout

# --pr: create from GitHub PR (requires gh CLI and network)
# skip in offline fixtures; mark as "requires gh CLI" in evidence

# negative: branch already exists as worktree
bun run src/index.ts add feature/smoke-test  # second time
# expect: exit 1, error about existing worktree

# negative: --template with nonexistent template name
bun run src/index.ts add feature/smoke-bad-template --template nonexistent
# expect: exit 1, error about unknown template
```

---

### `remove <branch-or-path>` (aliases: `rm`)

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--force` | boolean | `-f` | Force removal even with uncommitted changes |
| `--yes` | boolean | `-y` | Skip confirmation prompt |

**Test invocations:**

```bash
# basic remove with --yes
bun run src/index.ts remove feature/smoke-test --yes
# expect: exit 0, worktree gone from git worktree list

# -y alias
bun run src/index.ts remove feature/smoke-test -y
# expect: exit 0, same as --yes

# rm alias
bun run src/index.ts rm feature/smoke-test --yes
# expect: exit 0, same as remove

# --force: remove dirty worktree
# (create worktree, add uncommitted file, then remove)
bun run src/index.ts remove feature/smoke-dirty --force --yes
# expect: exit 0, worktree removed despite dirty state

# -f alias
bun run src/index.ts remove feature/smoke-dirty -f -y
# expect: exit 0, same as --force --yes

# negative: remove nonexistent branch
bun run src/index.ts remove feature/does-not-exist --yes
# expect: exit 1, error about unknown worktree

# negative: remove dirty worktree without --force
bun run src/index.ts remove feature/smoke-dirty --yes
# expect: exit 1, error about uncommitted changes
```

---

### `switch <branch-or-path>` (aliases: `sw`)

No flags. Positional only.

**Test invocations:**

```bash
# switch to existing worktree (requires shell integration for cd behavior)
bun run src/index.ts switch feature/smoke-test
# expect: exit 0, prints path or switch instruction

# sw alias
bun run src/index.ts sw feature/smoke-test
# expect: exit 0, same as switch

# negative: switch to nonexistent branch
bun run src/index.ts switch feature/does-not-exist
# expect: exit 1, error about unknown worktree
```

---

### `rename <old> <new>`

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--move-path` | boolean | — | Also rename the worktree directory on disk |

**Test invocations:**

```bash
# basic rename
bun run src/index.ts rename feature/smoke-old feature/smoke-new
# expect: exit 0, branch renamed, git worktree list shows new name

# --move-path: rename directory too
bun run src/index.ts rename feature/smoke-old feature/smoke-new --move-path
# expect: exit 0, branch renamed, directory moved to new path

# negative: old branch does not exist
bun run src/index.ts rename feature/does-not-exist feature/smoke-new
# expect: exit 1, error about unknown worktree

# negative: new branch name already exists
bun run src/index.ts rename feature/smoke-old feature/already-exists
# expect: exit 1, error about name conflict
```

---

### `clean`

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--dry-run` | boolean | `-n` | Show what would be removed without removing |
| `--yes` | boolean | `-y` | Skip confirmation prompt |
| `--stale` | boolean | — | Include stale worktrees (uses lifecycle config) |

**Test invocations:**

```bash
# --dry-run: preview only
bun run src/index.ts clean --dry-run
# expect: exit 0, lists candidates without removing anything

# -n alias
bun run src/index.ts clean -n
# expect: exit 0, same as --dry-run

# --yes: skip confirmation
bun run src/index.ts clean --yes
# expect: exit 0, removes merged worktrees without prompting

# -y alias
bun run src/index.ts clean -y
# expect: exit 0, same as --yes

# --stale: include stale worktrees
bun run src/index.ts clean --stale --dry-run
# expect: exit 0, lists merged + stale candidates

# combined: --stale --yes
bun run src/index.ts clean --stale --yes
# expect: exit 0, removes merged and stale worktrees

# no merged worktrees: clean repo
bun run src/index.ts clean --dry-run
# expect: exit 0, "nothing to clean" or empty output
```

---

## Inspection / Reporting

### `list` (aliases: `ls`)

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--json` | boolean | `-j` | Output as JSON |
| `--porcelain` | boolean | `-p` | Machine-readable output |
| `--all` | boolean | `-a` | All configured repos |

**Test invocations:**

```bash
# default: table output
bun run src/index.ts list
# expect: exit 0, table with Branch/Path/Focus columns

# ls alias
bun run src/index.ts ls
# expect: exit 0, same as list

# --json
bun run src/index.ts list --json
# expect: exit 0, valid JSON array on stdout

# -j alias
bun run src/index.ts list -j
# expect: exit 0, same as --json

# --porcelain
bun run src/index.ts list --porcelain
# expect: exit 0, machine-readable lines (one worktree per line)

# -p alias
bun run src/index.ts list -p
# expect: exit 0, same as --porcelain

# --all: all configured repos
bun run src/index.ts list --all
# expect: exit 0, lists worktrees across all repos in config

# -a alias
bun run src/index.ts list -a
# expect: exit 0, same as --all

# combined: --json --all
bun run src/index.ts list --json --all
# expect: exit 0, JSON array covering all repos
```

---

### `status` (aliases: `st`)

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--json` | boolean | `-j` | Output as JSON |
| `--all` | boolean | `-a` | All configured repos |

**Test invocations:**

```bash
# default
bun run src/index.ts status
# expect: exit 0, status table for current repo

# st alias
bun run src/index.ts st
# expect: exit 0, same as status

# --json
bun run src/index.ts status --json
# expect: exit 0, valid JSON on stdout

# -j alias
bun run src/index.ts status -j
# expect: exit 0, same as --json

# --all
bun run src/index.ts status --all
# expect: exit 0, status for all configured repos

# -a alias
bun run src/index.ts status -a
# expect: exit 0, same as --all

# combined: --json --all
bun run src/index.ts status --json --all
# expect: exit 0, JSON covering all repos
```

---

### `doctor`

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--json` | boolean | `-j` | JSON output |
| `--fix` | boolean | — | Auto-fix detected issues |

**Test invocations:**

```bash
# default: human-readable
bun run src/index.ts doctor
# expect: exit 0 if healthy, exit 1 if issues found

# --json
bun run src/index.ts doctor --json
# expect: exit 0 or 1, valid JSON with check results array

# -j alias
bun run src/index.ts doctor -j
# expect: exit 0 or 1, same as --json

# --fix: auto-fix issues
bun run src/index.ts doctor --fix
# expect: exit 0, attempts to fix detected issues

# combined: --json --fix
bun run src/index.ts doctor --json --fix
# expect: exit 0, JSON output after fix attempt

# healthy repo: all checks pass
bun run src/index.ts doctor
# expect: exit 0, "All checks passed" message

# dirty repo: doctor reports issues
# (create orphaned worktree dir, then run doctor)
bun run src/index.ts doctor
# expect: exit 1, lists specific issues found
```

---

### `diff <ref1> [ref2]`

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--stat` | boolean | `-s` | Diffstat summary only |
| `--name-only` | boolean | `-n` | Only changed file names |

**Test invocations:**

```bash
# two refs: full diff
bun run src/index.ts diff feature/a feature/b
# expect: exit 0, diff output between branches

# one ref: compare against HEAD
bun run src/index.ts diff feature/a
# expect: exit 0, diff between feature/a and current HEAD

# --stat
bun run src/index.ts diff feature/a feature/b --stat
# expect: exit 0, diffstat summary (insertions/deletions counts)

# -s alias
bun run src/index.ts diff feature/a feature/b -s
# expect: exit 0, same as --stat

# --name-only
bun run src/index.ts diff feature/a feature/b --name-only
# expect: exit 0, only file names listed, no diff content

# -n alias
bun run src/index.ts diff feature/a feature/b -n
# expect: exit 0, same as --name-only

# negative: nonexistent ref
bun run src/index.ts diff feature/does-not-exist
# expect: exit 1, git error about unknown ref
```

---

### `exec <command>`

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--all` | boolean | `-a` | All configured repos |
| `--dirty` | boolean | — | Only dirty worktrees |
| `--clean` | boolean | — | Only clean worktrees |
| `--behind` | boolean | — | Only worktrees behind upstream |
| `--parallel` | boolean | `-p` | Run in parallel |
| `--json` | boolean | `-j` | JSON output |

**Test invocations:**

```bash
# env vars available in command
bun run src/index.ts exec "echo \$COPSE_BRANCH"
# expect: exit 0, branch name printed for each worktree
```

---

### `log` (aliases: `logs`)

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--limit` | number | — | Last N entries (default: 20) |
| `--json` | boolean | `-j` | JSON output |
| `--clear` | boolean | — | Clear activity log |

**Test invocations:**

```bash
# default: last 20 events
bun run src/index.ts log
# expect: exit 0, up to 20 activity events

# logs alias
bun run src/index.ts logs
# expect: exit 0, same as log

# --limit
bun run src/index.ts log --limit 5
# expect: exit 0, at most 5 events

# --limit 1
bun run src/index.ts log --limit 1
# expect: exit 0, exactly 1 event (or 0 if log is empty)

# --json
bun run src/index.ts log --json
# expect: exit 0, valid JSON array of log entries

# -j alias
bun run src/index.ts log -j
# expect: exit 0, same as --json

# --clear
bun run src/index.ts log --clear
# expect: exit 0, log cleared; subsequent `log` shows empty

# negative: --limit with non-numeric value
bun run src/index.ts log --limit abc
# expect: exit 1, error about invalid number
```

---

## Metadata Helpers

### `pin [branch]` (aliases: `unpin`)

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--reason` | string | — | Reason for pinning |
| `--list` | boolean | — | List pinned worktrees |
| `--json` | boolean | `-j` | JSON output (with `--list`) |
| `--unpin` | boolean | — | Unpin mode |

**Test invocations:**

```bash
# pin a worktree
bun run src/index.ts pin feature/smoke-test
# expect: exit 0, worktree pinned

# pin with reason
bun run src/index.ts pin feature/smoke-test --reason "active sprint"
# expect: exit 0, pin metadata includes reason string

# --list: list pinned worktrees
bun run src/index.ts pin --list
# expect: exit 0, lists all pinned worktrees

# --list --json
bun run src/index.ts pin --list --json
# expect: exit 0, valid JSON array of pinned worktrees

# -j alias (with --list)
bun run src/index.ts pin --list -j
# expect: exit 0, same as --list --json

# unpin alias
bun run src/index.ts unpin feature/smoke-test
# expect: exit 0, worktree unpinned

# --unpin flag
bun run src/index.ts pin feature/smoke-test --unpin
# expect: exit 0, same as unpin alias

# negative: pin nonexistent branch
bun run src/index.ts pin feature/does-not-exist
# expect: exit 1, error about unknown worktree

# negative: unpin a worktree that is not pinned
bun run src/index.ts unpin feature/smoke-test
# expect: exit 0 or exit 1 (verify current behavior — idempotent or error)
```

---

### `open [branch-or-path]`

Focus-aware editor open. Resolves the target path based on focus metadata:

- 0 focus paths set → opens worktree root.
- 1 focus path set → opens `<worktree>/<focus>` automatically.
- 2+ focus paths set → exits with an error and asks for `--focus <path>` or `--root`.

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--editor` | string | `-e` | Editor command to use |
| `--focus` | string | `-f` | Open a specific focus path (must match an existing focus entry) |
| `--root` | boolean | — | Force opening the worktree root, ignoring focus paths |
| `--list-editors` | boolean | — | List detected editors |

**Test invocations:**

```bash
# Setup: 3 worktrees with no/single/multi focus
mkdir -p apps/web apps/api && git add -A && git commit -m "pkgs"
bun run src/index.ts add feature/smoke-test                          # no focus
bun run src/index.ts add feature/smoke-single --focus apps/web       # 1 focus
bun run src/index.ts add feature/smoke-multi --focus apps/web,apps/api  # 2+ focus

# open with explicit editor (no focus → root)
bun run src/index.ts open feature/smoke-test --editor /usr/bin/true
# expect: exit 0, "Opening <worktree-root> with /usr/bin/true..."

# -e alias
bun run src/index.ts open feature/smoke-test -e /usr/bin/true
# expect: exit 0, same as --editor

# --list-editors: list detected editors
bun run src/index.ts open --list-editors
# expect: exit 0, list of detected editors on stdout

# no branch: open current worktree
bun run src/index.ts open --editor /usr/bin/true
# expect: exit 0, opens current worktree in editor

# focus-aware: 1 focus path → opens that path automatically
bun run src/index.ts open feature/smoke-single --editor /usr/bin/true
# expect: exit 0, "Opening <worktree>/apps/web with /usr/bin/true [focus: apps/web]..."

# focus-aware: 2+ focus paths without flag → error
bun run src/index.ts open feature/smoke-multi --editor /usr/bin/true
# expect: exit 1, "Error: worktree has multiple focus paths set: apps/web, apps/api"

# --focus / -f: pick a specific focus path
bun run src/index.ts open feature/smoke-multi --focus apps/api --editor /usr/bin/true
# expect: exit 0, "Opening <worktree>/apps/api with /usr/bin/true [focus: apps/api]..."

bun run src/index.ts open feature/smoke-multi -f apps/web --editor /usr/bin/true
# expect: exit 0, "Opening <worktree>/apps/web with /usr/bin/true [focus: apps/web]..."

# --root: force worktree root
bun run src/index.ts open feature/smoke-multi --root --editor /usr/bin/true
# expect: exit 0, "Opening <worktree-root> with /usr/bin/true..." (no focus label)

# negative: --focus path that is not in the worktree's focus list
bun run src/index.ts open feature/smoke-multi --focus apps/mobile --editor /usr/bin/true
# expect: exit 1, "Error: Focus path 'apps/mobile' is not set; available: apps/web, apps/api."

# negative: --focus on a worktree without any focus set
bun run src/index.ts open feature/smoke-test --focus apps/web --editor /usr/bin/true
# expect: exit 1, "Error: Focus path 'apps/web' is not set; no focus paths are set on this worktree."

# negative: nonexistent branch
bun run src/index.ts open feature/does-not-exist --editor /usr/bin/true
# expect: exit 1, error about unknown worktree
```

---

## Remote / Import / Archive

### `clone <url> [path]`

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--template` | string | `-t` | Apply named template after cloning |
| `--init-config` | boolean | — | Initialize oml config (default: true) |

**Test invocations:**

```bash
# basic clone from local bare remote
bun run src/index.ts clone file://$TMPDIR/remote.git $TMPDIR/cloned-repo
# expect: exit 0, repo cloned, config.json created inside cloned-repo

# --template: apply template after clone
bun run src/index.ts clone file://$TMPDIR/remote.git $TMPDIR/cloned-tmpl --template review
# expect: exit 0, template applied after clone

# -t alias
bun run src/index.ts clone file://$TMPDIR/remote.git $TMPDIR/cloned-t -t review
# expect: exit 0, same as --template review

# --no-init-config: skip config initialization
bun run src/index.ts clone file://$TMPDIR/remote.git $TMPDIR/cloned-noinit --no-init-config
# expect: exit 0, repo cloned, no config.json created

# negative: invalid URL
bun run src/index.ts clone not-a-valid-url $TMPDIR/cloned-bad
# expect: exit 1, git clone error

# negative: target path already exists
bun run src/index.ts clone file://$TMPDIR/remote.git $TMPDIR/cloned-repo
# expect: exit 1, error about existing directory
```

---

### `import <path>`

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--focus` | array/string | `-f` | Focus packages for monorepo |
| `--pin` | boolean | — | Pin the worktree immediately after import |

**Test invocations:**

```bash
# basic import of manually-created worktree
bun run src/index.ts import $TMPDIR/manual-worktree
# expect: exit 0, worktree adopted with oml metadata

# --focus: set focus packages
bun run src/index.ts import $TMPDIR/manual-worktree --focus apps/web
# expect: exit 0, focus metadata stored

# --focus comma-separated
bun run src/index.ts import $TMPDIR/manual-worktree --focus apps/web,apps/api
# expect: exit 0, both packages in focus metadata

# -f alias
bun run src/index.ts import $TMPDIR/manual-worktree -f apps/web
# expect: exit 0, same as --focus

# --pin: pin immediately
bun run src/index.ts import $TMPDIR/manual-worktree --pin
# expect: exit 0, worktree imported and pinned

# combined: --focus + --pin
bun run src/index.ts import $TMPDIR/manual-worktree --focus apps/web --pin
# expect: exit 0, imported with focus and pinned

# negative: path does not exist
bun run src/index.ts import /nonexistent/path
# expect: exit 1, error about missing directory

# negative: path is not a git worktree
bun run src/index.ts import $TMPDIR/not-a-worktree
# expect: exit 1, error about invalid worktree
```

---

### `archive [branch]`

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--yes` | boolean | `-y` | Skip confirmation prompt |
| `--keep` | boolean | — | Archive without removing the worktree |
| `--list` | boolean | — | List all archives |
| `--json` | boolean | `-j` | JSON output (with `--list`) |

**Test invocations:**

```bash
# archive and remove
bun run src/index.ts archive feature/smoke-test --yes
# expect: exit 0, patch file created in ~/.copse/archives/, worktree removed

# -y alias
bun run src/index.ts archive feature/smoke-test -y
# expect: exit 0, same as --yes

# --keep: archive without removing
bun run src/index.ts archive feature/smoke-test --keep --yes
# expect: exit 0, patch file created, worktree still present in git worktree list

# --list: list archives
bun run src/index.ts archive --list
# expect: exit 0, lists archive files

# --list --json
bun run src/index.ts archive --list --json
# expect: exit 0, valid JSON array of archive entries

# -j alias (with --list)
bun run src/index.ts archive --list -j
# expect: exit 0, same as --list --json

# negative: archive nonexistent branch
bun run src/index.ts archive feature/does-not-exist --yes
# expect: exit 1, error about unknown worktree

# negative: archive without --yes (interactive prompt)
bun run src/index.ts archive feature/smoke-test < /dev/null
# expect: exit 1 or prompt aborted (no stdin)
```

---

## Session / tmux

### `session [branch-or-path]` (aliases: `ss`)

| Flag | Type | Alias | Description |
|------|------|-------|-------------|
| `--list` | boolean | `-l` | List active sessions |
| `--kill` | boolean | `-k` | Kill session for given worktree |
| `--kill-all` | boolean | — | Kill all copse-managed sessions |
| `--layout` | string | — | Layout name from config |
| `--json` | boolean | `-j` | JSON output |

**Test invocations:**

```bash
# open/attach session (requires tmux)
bun run src/index.ts session feature/smoke-test
# expect: exit 0, tmux session created or attached

# ss alias
bun run src/index.ts ss feature/smoke-test
# expect: exit 0, same as session

# --list: list active sessions
bun run src/index.ts session --list
# expect: exit 0, lists copse-managed tmux sessions

# -l alias
bun run src/index.ts session -l
# expect: exit 0, same as --list

# --list --json
bun run src/index.ts session --list --json
# expect: exit 0, valid JSON array of session entries

# -j alias (with --list)
bun run src/index.ts session --list -j
# expect: exit 0, same as --list --json

# --kill: kill session for worktree
bun run src/index.ts session feature/smoke-test --kill
# expect: exit 0, tmux session killed

# -k alias
bun run src/index.ts session feature/smoke-test -k
# expect: exit 0, same as --kill

# --kill-all: kill all oml sessions
bun run src/index.ts session --kill-all
# expect: exit 0, all copse-prefixed tmux sessions killed

# --layout: use named layout
bun run src/index.ts session feature/smoke-test --layout dev
# expect: exit 0, session created with dev layout windows

# negative: session for nonexistent branch
bun run src/index.ts session feature/does-not-exist
# expect: exit 1, error about unknown worktree

# negative: --kill for branch with no active session
bun run src/index.ts session feature/smoke-test --kill
# expect: exit 0 or exit 1 (verify current behavior — idempotent or error)
```

---

## Suggested Coverage Checklist

For a broad smoke pass, every command in every group must have at least one real invocation with evidence captured. For flags, the minimum bar is:

- Every boolean flag tested once in the positive case
- Every string/number flag tested with a valid value and one invalid value
- Every alias tested at least once
- Every mutating command verified with a follow-up assertion (`git worktree list --porcelain`, file existence check, tmux session check)
