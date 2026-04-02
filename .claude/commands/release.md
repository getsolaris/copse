---
description: Commit, push, and create a GitHub release with auto-generated notes
---

# Release Workflow

Analyze all changes, commit, push, and create a GitHub release.

## Steps

### 1. Pre-flight checks
- Run `gh auth status` — if wrong account is active, run `gh auth switch` to the repo owner
- Run `git status` and `git diff --stat` to understand all changes
- Run `git log --oneline -5` to see recent commit style
- Run the project's test/typecheck/build commands to verify everything passes

### 2. Version bump
- Read `package.json` (or equivalent) for current version
- Determine bump type from changes:
  - **patch** (0.0.x): bug fixes, docs, refactoring only
  - **minor** (0.x.0): new features, new commands, new functionality
  - **major** (x.0.0): breaking changes, API changes
- Update the version in package.json

### 3. Commit
- Stage all changes with `git add -A`
- Write a commit message following conventional commits:
  - First line: `feat:` / `fix:` / `chore:` + concise summary
  - Body: bullet list of key changes (what was added/changed/fixed)
- Commit (do NOT use --no-verify)

### 4. Push
- Push to the current branch's remote

### 5. Create GitHub release
- Tag: `v{version}` (e.g., `v0.2.0`)
- Title: `v{version}`
- Release notes structure:
  ```
  ## What's New
  ### {Category} (e.g., New Commands, Enhancements, Bug Fixes, Performance, etc.)
  - **{feature name}** — one-line description
  ```
- Group changes into logical categories
- Use `gh release create` with `--notes` via heredoc

### 6. Report
- Print the release URL
- Summarize: version, commit SHA, number of files changed

## Rules
- ALL content in English
- Do NOT skip tests/typecheck/build — fail early
- Do NOT force push
- Do NOT skip git hooks
- If tests fail, fix them before releasing
- Ask the user before proceeding if anything looks wrong (e.g., uncommitted secrets, failing tests)
