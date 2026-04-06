# Manual QA Playbook

Use this playbook for full `omw` CLI smoke testing.

## Source of Truth

- `src/cli/index.ts`
- `src/cli/cmd/*.ts`

Refresh the command list from code before every broad smoke run.

## Isolation Layout

Create one temp root and place these under it:

- `home/` → `HOME`
- `xdg/` → `XDG_CONFIG_HOME`
- `repo/` → seeded git repository under test
- `remote.git/` → optional bare remote for clone/push flows
- `worktrees/` or dedicated per-command dirs for added worktrees
- `tmux/` → isolated tmux socket/tmpdir when session commands are involved

## Recommended Fixture Setup

```bash
TMPROOT=$(mktemp -d)
export HOME="$TMPROOT/home"
export XDG_CONFIG_HOME="$TMPROOT/xdg"
mkdir -p "$HOME" "$XDG_CONFIG_HOME"

# Seed git repo
git init "$TMPROOT/repo"
cd "$TMPROOT/repo"
git config user.email "qa@test.local"
git config user.name "QA"
echo "seed" > seed.txt
git add seed.txt
git commit -m "init"

# Optional bare remote for clone tests
git init --bare "$TMPROOT/remote.git"
git remote add origin "$TMPROOT/remote.git"
git push -u origin main

# Initialize omw config
bun run src/index.ts config --init
```

All commands below assume `cwd=$TMPROOT/repo` and the env vars above are set, unless noted otherwise.

---

## QA Waves

### Wave 1 — Command Manifest

Read the command registry and write down the exact commands to cover.

```bash
# Enumerate registered commands
grep -E "\.command\(" src/cli/index.ts
ls src/cli/cmd/
```

Cross-reference against `references/command-groups.md`. Note any divergence.

---

### Wave 2 — Baseline Verification

Run in this order before any manual command QA:

```bash
bun run typecheck
bun test src/core/git          # targeted if git.ts was touched
bun test
bun run build
bun run src/index.ts           # TUI startup smoke (Ctrl+C to exit)
```

All must pass before proceeding to Wave 3.

---

### Wave 3 — Config / Init / Shell Commands

Run against temp `HOME` / `XDG_CONFIG_HOME`. No real repo needed for most of these.

#### `config --init`

```bash
bun run src/index.ts config --init
# post-condition: file exists at $XDG_CONFIG_HOME/oh-my-worktree/config.json
ls "$XDG_CONFIG_HOME/oh-my-worktree/config.json"
```

Expected: exit 0, file created.

#### `config --path`

```bash
bun run src/index.ts config --path
# post-condition: stdout contains path ending in config.json
```

Expected: exit 0, absolute path printed.

#### `config --show`

```bash
bun run src/index.ts config --show
# post-condition: stdout is valid JSON
bun run src/index.ts config --show | bun -e "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))"
```

Expected: exit 0, parseable JSON.

#### `config --validate`

```bash
# valid config
bun run src/index.ts config --validate
# expect: exit 0

# invalid config (manually corrupt the file)
echo '{"version": "bad"}' > "$XDG_CONFIG_HOME/oh-my-worktree/config.json"
bun run src/index.ts config --validate
# expect: exit 1, validation error message
# restore config
bun run src/index.ts config --init
```

#### `config --edit`

```bash
EDITOR=/usr/bin/true bun run src/index.ts config --edit
# expect: exit 0, editor invoked and returned immediately
```

#### `config --profiles`

```bash
bun run src/index.ts config --profiles
# expect: exit 0, lists profiles (empty list is valid output)
```

#### `config --profile <name> --activate`

```bash
# negative: profile does not exist
bun run src/index.ts config --profile nonexistent --activate
# expect: exit 1, error about missing profile
```

#### `config --profile <name> --delete`

```bash
# negative: profile does not exist
bun run src/index.ts config --profile nonexistent --delete
# expect: exit 1, error about missing profile
```

#### `config --activate` without `--profile` (negative)

```bash
bun run src/index.ts config --activate
# expect: exit 1, error about missing --profile
```

#### `config --delete` without `--profile` (negative)

```bash
bun run src/index.ts config --delete
# expect: exit 1, error about missing --profile
```

---

#### `init` (no flags)

```bash
bun run src/index.ts init
# post-condition: config.json exists
ls "$XDG_CONFIG_HOME/oh-my-worktree/config.json"
# expect: exit 0
```

#### `init --skill claude-code`

```bash
bun run src/index.ts init --skill claude
# post-condition: skill files exist
ls "$HOME/.claude/skills/omw/SKILL.md"
# expect: exit 0
```

#### `init -s claude-code` (alias)

```bash
bun run src/index.ts init -s claude
# expect: exit 0, same result as --skill claude
```

#### `init --skill opencode`

```bash
bun run src/index.ts init --skill opencode
# post-condition: skill files exist
ls "$XDG_CONFIG_HOME/opencode/skill/omw/SKILL.md"
# expect: exit 0
```

#### `init --skill invalid` (negative)

```bash
bun run src/index.ts init --skill invalid-platform
# expect: exit 1, error listing valid choices
```

#### `init` idempotent

```bash
bun run src/index.ts init
bun run src/index.ts init
# expect: both exit 0, no error on second run
```

---

#### `shell-init bash`

```bash
bun run src/index.ts shell-init bash
# expect: exit 0, shell function definition on stdout (contains "omw()")
```

#### `shell-init zsh`

```bash
bun run src/index.ts shell-init zsh
# expect: exit 0, shell function definition on stdout
```

#### `shell-init fish`

```bash
bun run src/index.ts shell-init fish
# expect: exit 0, fish function definition on stdout
```

#### `shell-init --completions bash`

```bash
bun run src/index.ts shell-init --completions bash
# expect: exit 0, bash completion script on stdout
```

#### `shell-init --completions zsh`

```bash
bun run src/index.ts shell-init --completions zsh
# expect: exit 0, zsh completion script on stdout
```

#### `shell-init --completions fish`

```bash
bun run src/index.ts shell-init --completions fish
# expect: exit 0, fish completion script on stdout
```

---

### Wave 4 — Seeded Repo Read-Only Commands

Run against the seeded temp repo. No worktree mutations in this wave.

#### `list` (default)

```bash
cd "$TMPROOT/repo"
bun run src/index.ts list
# expect: exit 0, table with at least the main worktree row
```

#### `list --json` / `-j`

```bash
bun run src/index.ts list --json
# post-condition: valid JSON array
bun run src/index.ts list -j | bun -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); if(!Array.isArray(d)) throw new Error('not array')"
# expect: exit 0
```

#### `list --porcelain` / `-p`

```bash
bun run src/index.ts list --porcelain
bun run src/index.ts list -p
# expect: exit 0, machine-readable lines
```

#### `list --all` / `-a`

```bash
bun run src/index.ts list --all
bun run src/index.ts list -a
# expect: exit 0 (may show only current repo if no others configured)
```

#### `list --json --all`

```bash
bun run src/index.ts list --json --all
# expect: exit 0, valid JSON
```

---

#### `status` (default)

```bash
bun run src/index.ts status
# expect: exit 0, status table
```

#### `status --json` / `-j`

```bash
bun run src/index.ts status --json
bun run src/index.ts status -j
# expect: exit 0, valid JSON
```

#### `status --all` / `-a`

```bash
bun run src/index.ts status --all
bun run src/index.ts status -a
# expect: exit 0
```

#### `status --json --all`

```bash
bun run src/index.ts status --json --all
# expect: exit 0, valid JSON
```

---

#### `doctor` (default)

```bash
bun run src/index.ts doctor
# expect: exit 0 on clean repo, "All checks passed"
```

#### `doctor --json` / `-j`

```bash
bun run src/index.ts doctor --json
bun run src/index.ts doctor -j
# post-condition: valid JSON with results array
bun run src/index.ts doctor --json | bun -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); if(!d.checks) throw new Error('no checks key')"
# expect: exit 0
```

#### `doctor --fix`

```bash
bun run src/index.ts doctor --fix
# expect: exit 0, attempts fixes (no-op on clean repo)
```

#### `doctor --json --fix`

```bash
bun run src/index.ts doctor --json --fix
# expect: exit 0, JSON output after fix attempt
```

#### `doctor` on dirty repo (negative)

```bash
# Create orphaned worktree directory to trigger a check failure
mkdir -p "$TMPROOT/orphaned-wt"
# Run doctor — should detect issue
bun run src/index.ts doctor
# expect: exit 1, lists detected issues
rm -rf "$TMPROOT/orphaned-wt"
```

---

#### `diff <ref1> [ref2]`

First create a second branch with a different commit:

```bash
git checkout -b feature/diff-b
echo "change" >> seed.txt
git add seed.txt && git commit -m "change"
git checkout main
```

#### `diff` two refs

```bash
bun run src/index.ts diff main feature/diff-b
# expect: exit 0, diff output showing the change
```

#### `diff` one ref (against HEAD)

```bash
bun run src/index.ts diff feature/diff-b
# expect: exit 0, diff between feature/diff-b and current HEAD
```

#### `diff --stat` / `-s`

```bash
bun run src/index.ts diff main feature/diff-b --stat
bun run src/index.ts diff main feature/diff-b -s
# expect: exit 0, diffstat summary with insertion/deletion counts
```

#### `diff --name-only` / `-n`

```bash
bun run src/index.ts diff main feature/diff-b --name-only
bun run src/index.ts diff main feature/diff-b -n
# expect: exit 0, only "seed.txt" on stdout, no diff content
```

#### `diff` nonexistent ref (negative)

```bash
bun run src/index.ts diff feature/does-not-exist
# expect: exit 1, git error about unknown ref
```

---

#### `exec <command>` (read-only variant)

```bash
bun run src/index.ts exec "echo \$OMW_BRANCH"
# expect: exit 0, branch name printed for each worktree
```

#### `exec --json` / `-j`

```bash
bun run src/index.ts exec "echo hello" --json
bun run src/index.ts exec "echo hello" -j
# expect: exit 0, valid JSON array
```

#### `exec --clean`

```bash
bun run src/index.ts exec "echo clean" --clean
# expect: exit 0, runs in clean worktrees only
```

#### `exec --dirty`

```bash
# Make a worktree dirty first (add uncommitted file)
echo "dirty" > "$TMPROOT/repo/dirty.txt"
bun run src/index.ts exec "echo dirty" --dirty
git checkout -- .  # restore
# expect: exit 0, ran in dirty worktree
```

#### `exec --parallel` / `-p`

```bash
bun run src/index.ts exec "echo hello" --parallel
bun run src/index.ts exec "echo hello" -p
# expect: exit 0, output from all worktrees
```

#### `exec --parallel --json`

```bash
bun run src/index.ts exec "echo hello" --parallel --json
# expect: exit 0, valid JSON
```

#### `exec --dirty --clean` (negative — mutually exclusive)

```bash
bun run src/index.ts exec "echo hello" --dirty --clean
# expect: exit 1 or empty result
```

---

#### `log` (default)

```bash
bun run src/index.ts log
# expect: exit 0, up to 20 activity events (may be empty on fresh fixture)
```

#### `log --limit`

```bash
bun run src/index.ts log --limit 5
# expect: exit 0, at most 5 events
```

#### `log --limit 1`

```bash
bun run src/index.ts log --limit 1
# expect: exit 0, 0 or 1 events
```

#### `log --json` / `-j`

```bash
bun run src/index.ts log --json
bun run src/index.ts log -j
# expect: exit 0, valid JSON array
```

#### `log --limit abc` (negative)

```bash
bun run src/index.ts log --limit abc
# expect: exit 1, error about invalid number
```

#### `logs` alias

```bash
bun run src/index.ts logs
# expect: exit 0, same as log
```

---

### Wave 5 — Mutating Worktree Commands

Use disposable worktrees. After each mutation, verify with `git worktree list --porcelain`.

#### `add` (bare)

```bash
bun run src/index.ts add feature/smoke-add
git worktree list --porcelain | grep "feature/smoke-add"
# expect: exit 0, worktree entry present
```

#### `add --base` / `-b`

```bash
bun run src/index.ts add feature/smoke-base --base main
git worktree list --porcelain | grep "feature/smoke-base"
# expect: exit 0, branch created from main
bun run src/index.ts add feature/smoke-b-alias -b main
git worktree list --porcelain | grep "feature/smoke-b-alias"
# expect: exit 0
```

#### `add --create` / `-c`

```bash
bun run src/index.ts add feature/smoke-create --create
git worktree list --porcelain | grep "feature/smoke-create"
# expect: exit 0
bun run src/index.ts add feature/smoke-c -c
git worktree list --porcelain | grep "feature/smoke-c"
# expect: exit 0
```

#### `add --focus` / `-f`

```bash
bun run src/index.ts add feature/smoke-focus --focus apps/web
# post-condition: focus metadata stored in git internals
cat "$(git rev-parse --git-dir)/omw-focus" 2>/dev/null || echo "check git internals"
# expect: exit 0

bun run src/index.ts add feature/smoke-focus-multi --focus apps/web,apps/api
# expect: exit 0, both packages in focus

bun run src/index.ts add feature/smoke-focus-repeat --focus apps/web --focus apps/api
# expect: exit 0, both packages in focus

bun run src/index.ts add feature/smoke-f -f apps/web
# expect: exit 0
```

#### `add --template` / `-t`

```bash
# First add a template to config
# (manually edit $XDG_CONFIG_HOME/oh-my-worktree/config.json to add "review" template)
bun run src/index.ts add feature/smoke-template --template review
# expect: exit 0 if template exists

bun run src/index.ts add feature/smoke-t -t review
# expect: exit 0

# negative: nonexistent template
bun run src/index.ts add feature/smoke-bad-template --template nonexistent
# expect: exit 1, error about unknown template
```

#### `add` duplicate (negative)

```bash
bun run src/index.ts add feature/smoke-add  # second time
# expect: exit 1, error about existing worktree
```

---

#### `remove` / `rm`

```bash
# Setup: ensure feature/smoke-add exists
bun run src/index.ts remove feature/smoke-add --yes
git worktree list --porcelain | grep "feature/smoke-add"
# expect: exit 0, entry no longer present

# rm alias
bun run src/index.ts add feature/smoke-rm
bun run src/index.ts rm feature/smoke-rm --yes
git worktree list --porcelain | grep "feature/smoke-rm"
# expect: exit 0, entry gone

# -y alias
bun run src/index.ts add feature/smoke-y
bun run src/index.ts remove feature/smoke-y -y
# expect: exit 0
```

#### `remove --force` / `-f`

```bash
# Create worktree, add uncommitted file
bun run src/index.ts add feature/smoke-dirty
DIRTY_PATH=$(git worktree list --porcelain | grep -A1 "feature/smoke-dirty" | grep worktree | awk '{print $2}')
echo "dirty" > "$DIRTY_PATH/dirty.txt"

# Remove without --force (negative)
bun run src/index.ts remove feature/smoke-dirty --yes
# expect: exit 1, error about uncommitted changes

# Remove with --force
bun run src/index.ts remove feature/smoke-dirty --force --yes
git worktree list --porcelain | grep "feature/smoke-dirty"
# expect: exit 0, worktree gone

# -f -y aliases
bun run src/index.ts add feature/smoke-dirty2
DIRTY_PATH2=$(git worktree list --porcelain | grep -A1 "feature/smoke-dirty2" | grep worktree | awk '{print $2}')
echo "dirty" > "$DIRTY_PATH2/dirty.txt"
bun run src/index.ts remove feature/smoke-dirty2 -f -y
# expect: exit 0
```

#### `remove` nonexistent (negative)

```bash
bun run src/index.ts remove feature/does-not-exist --yes
# expect: exit 1, error about unknown worktree
```

---

#### `switch` / `sw`

```bash
bun run src/index.ts add feature/smoke-switch
bun run src/index.ts switch feature/smoke-switch
# expect: exit 0, prints path or switch instruction

bun run src/index.ts sw feature/smoke-switch
# expect: exit 0, same as switch

# negative: nonexistent branch
bun run src/index.ts switch feature/does-not-exist
# expect: exit 1, error about unknown worktree
```

---

#### `rename`

```bash
bun run src/index.ts add feature/smoke-old
bun run src/index.ts rename feature/smoke-old feature/smoke-new
git worktree list --porcelain | grep "feature/smoke-new"
git worktree list --porcelain | grep "feature/smoke-old"
# expect: exit 0, new name present, old name absent
```

#### `rename --move-path`

```bash
bun run src/index.ts add feature/smoke-rename-dir
OLD_PATH=$(git worktree list --porcelain | grep -A1 "feature/smoke-rename-dir" | grep worktree | awk '{print $2}')
bun run src/index.ts rename feature/smoke-rename-dir feature/smoke-renamed --move-path
# post-condition: old path gone, new path exists
ls "$OLD_PATH" 2>/dev/null && echo "FAIL: old path still exists" || echo "OK: old path gone"
# expect: exit 0
```

#### `rename` nonexistent (negative)

```bash
bun run src/index.ts rename feature/does-not-exist feature/smoke-new
# expect: exit 1, error about unknown worktree
```

#### `rename` to existing name (negative)

```bash
bun run src/index.ts add feature/smoke-a
bun run src/index.ts add feature/smoke-b
bun run src/index.ts rename feature/smoke-a feature/smoke-b
# expect: exit 1, error about name conflict
```

---

#### `clean`

```bash
# Create and merge a branch to make it cleanable
git checkout -b feature/smoke-merged
git checkout main
git merge feature/smoke-merged --no-ff -m "merge"
bun run src/index.ts add feature/smoke-merged  # add worktree for merged branch

# dry-run first
bun run src/index.ts clean --dry-run
# expect: exit 0, lists feature/smoke-merged as candidate

# -n alias
bun run src/index.ts clean -n
# expect: exit 0, same as --dry-run

# actual clean
bun run src/index.ts clean --yes
git worktree list --porcelain | grep "feature/smoke-merged"
# expect: exit 0, merged worktree removed

# -y alias
# (setup another merged branch first)
git checkout -b feature/smoke-merged2
git checkout main
git merge feature/smoke-merged2 --no-ff -m "merge2"
bun run src/index.ts add feature/smoke-merged2
bun run src/index.ts clean -y
# expect: exit 0
```

#### `clean --stale`

```bash
bun run src/index.ts clean --stale --dry-run
# expect: exit 0, lists merged + stale candidates (stale requires lifecycle config)
```

#### `clean` on clean repo

```bash
bun run src/index.ts clean --dry-run
# expect: exit 0, "nothing to clean" or empty output
```

---

#### `pin` / `unpin`

```bash
bun run src/index.ts add feature/smoke-pin

# pin
bun run src/index.ts pin feature/smoke-pin
# expect: exit 0, worktree pinned

# pin with reason
bun run src/index.ts pin feature/smoke-pin --reason "active sprint"
# expect: exit 0, reason stored in metadata

# --list
bun run src/index.ts pin --list
# expect: exit 0, feature/smoke-pin appears in list

# --list --json
bun run src/index.ts pin --list --json
# expect: exit 0, valid JSON array

# -j alias (with --list)
bun run src/index.ts pin --list -j
# expect: exit 0, same as --list --json

# unpin alias
bun run src/index.ts unpin feature/smoke-pin
# expect: exit 0, worktree unpinned

# verify no longer in list
bun run src/index.ts pin --list
# expect: feature/smoke-pin absent

# --unpin flag
bun run src/index.ts pin feature/smoke-pin  # re-pin
bun run src/index.ts pin feature/smoke-pin --unpin
# expect: exit 0, unpinned

# negative: pin nonexistent branch
bun run src/index.ts pin feature/does-not-exist
# expect: exit 1, error about unknown worktree
```

---

#### `open`

```bash
bun run src/index.ts add feature/smoke-open

# --editor / -e
bun run src/index.ts open feature/smoke-open --editor /usr/bin/true
# expect: exit 0, editor invoked with worktree path

bun run src/index.ts open feature/smoke-open -e /usr/bin/true
# expect: exit 0, same as --editor

# --list-editors
bun run src/index.ts open --list-editors
# expect: exit 0, list of detected editors on stdout

# no branch: open current worktree
bun run src/index.ts open --editor /usr/bin/true
# expect: exit 0, opens current worktree

# negative: nonexistent branch
bun run src/index.ts open feature/does-not-exist --editor /usr/bin/true
# expect: exit 1, error about unknown worktree
```

---

#### `log --clear`

```bash
# Generate some log entries first
bun run src/index.ts add feature/smoke-log-clear
bun run src/index.ts remove feature/smoke-log-clear --yes

bun run src/index.ts log
# expect: shows entries

bun run src/index.ts log --clear
# expect: exit 0, log cleared

bun run src/index.ts log
# expect: exit 0, empty log
```

---

### Wave 6 — Remote / Archive / Import Commands

#### `clone`

```bash
# Setup bare remote
git init --bare "$TMPROOT/remote.git"
cd "$TMPROOT/repo"
git remote add origin "$TMPROOT/remote.git"
git push -u origin main

# basic clone
bun run src/index.ts clone "file://$TMPROOT/remote.git" "$TMPROOT/cloned-basic"
ls "$TMPROOT/cloned-basic"
# expect: exit 0, repo cloned

# --no-init-config
bun run src/index.ts clone "file://$TMPROOT/remote.git" "$TMPROOT/cloned-noinit" --no-init-config
ls "$TMPROOT/cloned-noinit"
ls "$TMPROOT/cloned-noinit/.config" 2>/dev/null && echo "FAIL: config created" || echo "OK: no config"
# expect: exit 0, no omw config created

# --template / -t (requires template in config)
bun run src/index.ts clone "file://$TMPROOT/remote.git" "$TMPROOT/cloned-tmpl" --template review
# expect: exit 0 if template exists in config

bun run src/index.ts clone "file://$TMPROOT/remote.git" "$TMPROOT/cloned-t" -t review
# expect: exit 0, same as --template

# negative: invalid URL
bun run src/index.ts clone "not-a-valid-url" "$TMPROOT/cloned-bad"
# expect: exit 1, git clone error

# negative: target path already exists
bun run src/index.ts clone "file://$TMPROOT/remote.git" "$TMPROOT/cloned-basic"
# expect: exit 1, error about existing directory
```

---

#### `import`

```bash
# Create a manual worktree to import
cd "$TMPROOT/repo"
git worktree add "$TMPROOT/manual-wt" -b feature/manual

# basic import
bun run src/index.ts import "$TMPROOT/manual-wt"
# expect: exit 0, worktree adopted

# --focus / -f
git worktree add "$TMPROOT/manual-wt2" -b feature/manual2
bun run src/index.ts import "$TMPROOT/manual-wt2" --focus apps/web
# expect: exit 0, focus metadata stored

bun run src/index.ts import "$TMPROOT/manual-wt2" -f apps/web,apps/api
# expect: exit 0, both packages in focus

# --pin
git worktree add "$TMPROOT/manual-wt3" -b feature/manual3
bun run src/index.ts import "$TMPROOT/manual-wt3" --pin
# post-condition: worktree appears in pin --list
bun run src/index.ts pin --list | grep "feature/manual3"
# expect: exit 0, pinned

# combined: --focus + --pin
git worktree add "$TMPROOT/manual-wt4" -b feature/manual4
bun run src/index.ts import "$TMPROOT/manual-wt4" --focus apps/web --pin
# expect: exit 0

# negative: path does not exist
bun run src/index.ts import /nonexistent/path
# expect: exit 1, error about missing directory

# negative: path is not a git worktree
mkdir -p "$TMPROOT/not-a-wt"
bun run src/index.ts import "$TMPROOT/not-a-wt"
# expect: exit 1, error about invalid worktree
```

---

#### `archive`

```bash
cd "$TMPROOT/repo"
bun run src/index.ts add feature/smoke-archive

# archive and remove
bun run src/index.ts archive feature/smoke-archive --yes
git worktree list --porcelain | grep "feature/smoke-archive"
# expect: exit 0, worktree removed; patch file in ~/.omw/archives/

# -y alias
bun run src/index.ts add feature/smoke-archive-y
bun run src/index.ts archive feature/smoke-archive-y -y
# expect: exit 0

# --keep: archive without removing
bun run src/index.ts add feature/smoke-keep
bun run src/index.ts archive feature/smoke-keep --keep --yes
git worktree list --porcelain | grep "feature/smoke-keep"
# expect: exit 0, worktree still present

# --list
bun run src/index.ts archive --list
# expect: exit 0, lists archive entries

# --list --json
bun run src/index.ts archive --list --json
# expect: exit 0, valid JSON array

# -j alias (with --list)
bun run src/index.ts archive --list -j
# expect: exit 0, same as --list --json

# negative: archive nonexistent branch
bun run src/index.ts archive feature/does-not-exist --yes
# expect: exit 1, error about unknown worktree

# negative: no stdin (interactive prompt aborted)
bun run src/index.ts add feature/smoke-noinput
bun run src/index.ts archive feature/smoke-noinput < /dev/null
# expect: exit 1 or prompt aborted
```

---

### Wave 7 — Session / tmux Commands

Use isolated tmux state. Set a unique prefix to avoid colliding with real sessions.

```bash
# Isolated tmux socket
export TMUX_TMPDIR="$TMPROOT/tmux"
mkdir -p "$TMUX_TMPDIR"
TMUX_SOCKET="$TMPROOT/tmux/test.sock"

# Add sessions config to omw config with unique prefix
# (manually patch $XDG_CONFIG_HOME/oh-my-worktree/config.json)
# "sessions": { "enabled": true, "prefix": "omwqa" }
```

#### `session --list` / `-l`

```bash
bun run src/index.ts session --list
bun run src/index.ts session -l
# expect: exit 0, lists omw-managed sessions (empty is valid)
```

#### `session --list --json` / `-j`

```bash
bun run src/index.ts session --list --json
bun run src/index.ts session --list -j
# expect: exit 0, valid JSON array
```

#### `session <branch>` (create/attach)

```bash
cd "$TMPROOT/repo"
bun run src/index.ts add feature/smoke-session

# Create session (requires tmux installed)
bun run src/index.ts session feature/smoke-session
# post-condition: tmux session exists
tmux -S "$TMUX_SOCKET" ls 2>/dev/null | grep "omwqa"
# expect: exit 0, session created
```

#### `ss` alias

```bash
bun run src/index.ts ss feature/smoke-session
# expect: exit 0, same as session
```

#### `session --layout`

```bash
# Requires layout defined in config
bun run src/index.ts session feature/smoke-session --layout dev
# expect: exit 0, session created with dev layout windows
```

#### `session --kill` / `-k`

```bash
bun run src/index.ts session feature/smoke-session --kill
tmux -S "$TMUX_SOCKET" ls 2>/dev/null | grep "omwqa"
# expect: exit 0, session no longer listed

bun run src/index.ts session feature/smoke-session -k
# expect: exit 0, same as --kill
```

#### `session --kill-all`

```bash
# Create multiple sessions first
bun run src/index.ts add feature/smoke-session2
bun run src/index.ts session feature/smoke-session
bun run src/index.ts session feature/smoke-session2

bun run src/index.ts session --kill-all
tmux -S "$TMUX_SOCKET" ls 2>/dev/null | grep "omwqa"
# expect: exit 0, no omwqa sessions remain
```

#### `add --session` / `-s`

```bash
bun run src/index.ts add feature/smoke-add-session --session
tmux -S "$TMUX_SOCKET" ls 2>/dev/null | grep "omwqa"
# expect: exit 0, worktree created and session started

bun run src/index.ts add feature/smoke-add-s -s
# expect: exit 0, same as --session
```

#### `add --session --layout`

```bash
bun run src/index.ts add feature/smoke-add-layout --session --layout dev
# expect: exit 0, worktree created, session with dev layout
```

#### `session` nonexistent branch (negative)

```bash
bun run src/index.ts session feature/does-not-exist
# expect: exit 1, error about unknown worktree
```

---

## Evidence Format

For every command run, capture:

```
COMMAND: bun run src/index.ts <args>
CWD: <path>
ENV: HOME=<tmp> XDG_CONFIG_HOME=<tmp> [TMUX_TMPDIR=<tmp>]
EXIT: <code>
STDOUT: <summary or first 5 lines>
STDERR: <summary or first 5 lines>
POST: <git worktree list output / file existence / tmux ls output>
RESULT: PASS | FAIL | SKIP (reason)
```

---

## Failure Triage

Treat these as fixture issues first:

- intentionally dirty worktree during `doctor`
- unrelated sibling directories under a custom worktree root
- tmux state leaking from a previous test root
- missing `gh` CLI when testing `--pr` flag
- missing `tmux` when testing session commands

Treat these as product bugs when they reproduce in a clean fixture.

---

## Flag Coverage Checklist

Before closing a smoke run, verify every flag below has at least one PASS entry in evidence:

### `add`
- [ ] (bare, no flags)
- [ ] `--create` / `-c`
- [ ] `--base` / `-b`
- [ ] `--focus` / `-f` (single)
- [ ] `--focus` (comma-separated)
- [ ] `--focus` (repeated)
- [ ] `--template` / `-t`
- [ ] `--session` / `-s`
- [ ] `--layout` (with `--session`)
- [ ] `--pr` (mark SKIP if no `gh` CLI)

### `remove` / `rm`
- [ ] `--yes` / `-y`
- [ ] `--force` / `-f`
- [ ] `rm` alias

### `switch` / `sw`
- [ ] (bare)
- [ ] `sw` alias

### `list` / `ls`
- [ ] `--json` / `-j`
- [ ] `--porcelain` / `-p`
- [ ] `--all` / `-a`
- [ ] `ls` alias

### `status` / `st`
- [ ] `--json` / `-j`
- [ ] `--all` / `-a`
- [ ] `st` alias

### `exec`
- [ ] (bare)
- [ ] `--all` / `-a`
- [ ] `--dirty`
- [ ] `--clean`
- [ ] `--behind`
- [ ] `--parallel` / `-p`
- [ ] `--json` / `-j`

### `diff`
- [ ] (two refs)
- [ ] (one ref)
- [ ] `--stat` / `-s`
- [ ] `--name-only` / `-n`

### `doctor`
- [ ] (bare)
- [ ] `--json` / `-j`
- [ ] `--fix`

### `clean`
- [ ] `--dry-run` / `-n`
- [ ] `--yes` / `-y`
- [ ] `--stale`

### `config`
- [ ] `--init`
- [ ] `--show` / `-s`
- [ ] `--edit` / `-e`
- [ ] `--path`
- [ ] `--validate`
- [ ] `--profiles`
- [ ] `--profile` + `--activate`
- [ ] `--profile` + `--delete`

### `init`
- [ ] (bare)
- [ ] `--skill claude-code` / `-s claude-code`
- [ ] `--skill opencode`

### `shell-init`
- [ ] `bash` positional
- [ ] `zsh` positional
- [ ] `fish` positional
- [ ] `--completions bash`
- [ ] `--completions zsh`
- [ ] `--completions fish`

### `pin` / `unpin`
- [ ] (bare pin)
- [ ] `--reason`
- [ ] `--list`
- [ ] `--list --json` / `-j`
- [ ] `--unpin`
- [ ] `unpin` alias

### `open`
- [ ] `--editor` / `-e`
- [ ] `--list-editors`

### `rename`
- [ ] (bare)
- [ ] `--move-path`

### `log` / `logs`
- [ ] (bare)
- [ ] `--limit`
- [ ] `--json` / `-j`
- [ ] `--clear`
- [ ] `logs` alias

### `clone`
- [ ] (bare)
- [ ] `--template` / `-t`
- [ ] `--no-init-config`

### `import`
- [ ] (bare)
- [ ] `--focus` / `-f`
- [ ] `--pin`

### `archive`
- [ ] `--yes` / `-y`
- [ ] `--keep`
- [ ] `--list`
- [ ] `--list --json` / `-j`

### `session` / `ss`
- [ ] (bare)
- [ ] `--list` / `-l`
- [ ] `--list --json` / `-j`
- [ ] `--kill` / `-k`
- [ ] `--kill-all`
- [ ] `--layout`
- [ ] `ss` alias
