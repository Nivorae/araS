---
description: Generate changelog entries from git commit history, bump package.json version, and optionally create a git tag
argument-hint: [version] [--tag]
allowed-tools: Bash(git:*), Read, Edit, Write, AskUserQuestion
---

# Changelog

Generate changelog entries from git commit history, bump the root `package.json` version, and commit both atomically.

## Instructions

### 1. Parse Arguments

- Extract `version` (optional positional arg) and `--tag` flag from the arguments.

### 2. Branch Check + Sync (always)

- Run `git branch --show-current`. If not `develop`, stop and print:
  > ❌ `/git:changelog` must run on `develop`. Current: `<branch>`.
- Abort if working tree is dirty (`git status --porcelain` non-empty).
- Pull latest: `git pull --ff-only origin develop`. Stop on failure (diverged branch needs manual resolve before bumping version).
- These checks run **before any reads, writes, or version computation** — version must be derived from up-to-date remote state.

### 3. Determine Version

**If version argument provided:** Use it as-is, skip to step 4.

**If no version argument:**

- Read `"version"` from root `package.json`.
- If `"version"` field is absent, stop and print:
  > ❌ Root `package.json` has no `"version"` field. Add one before running `/git:changelog`.
- Detect version scheme by inspecting existing `## ...` headers in `CHANGELOG.md`:

| Pattern   | Scheme     | Example     |
| --------- | ---------- | ----------- |
| `X.Y.Z`   | Semver     | `1.4.2`     |
| `W.X.Y.Z` | Date-based | `26.3.16.1` |

**Date-based scheme** (`W.X.Y.Z`):

- `W` = last two digits of year (e.g. `26` for 2026)
- `X` = month (no leading zero — `3`, not `03`)
- `Y` = day (no leading zero — `16`, not `016`)
- `Z` = daily increment (starts at `1`, increments if multiple releases same day)

Auto-compute next date-based version from today's date — no prompt needed.

**Semver scheme:**

- Use `AskUserQuestion` to confirm the next version, pre-filling the suggested next patch:
  > Current version is `1.5.0`. What should the next version be? (suggested: `1.5.1`)
- Use the user's answer as the version.

### 4. Find Commits Since Last Version

```bash
git log --oneline --format="%s" $(git log --oneline --all --grep="chore: bump version" | head -2 | tail -1 | cut -d' ' -f1)..HEAD
```

**Bootstrap case:** If no prior `chore: bump version` commit exists (the above returns empty), collect all commits with no range restriction:

```bash
git log --oneline --format="%s"
```

### 5. Parse Conventional Commits

Map commit types to changelog prefixes:

| Git Commit Type       | Changelog Prefix | Example Transformation |
| --------------------- | ---------------- | ---------------------- |
| `feat: add X`         | Added            | Added X                |
| `fix: resolve Y`      | Fixed            | Fixed Y                |
| `refactor: improve Z` | Improved         | Improved Z             |
| `chore: update W`     | Changed          | Changed W              |
| `docs: add V`         | Updated          | Updated V              |
| `perf: optimize U`    | Improved         | Improved U             |
| `BREAKING CHANGE`     | **BREAKING**     | Requires manual review |

**Skip these commits**:

- `chore: bump version to X.Y.Z` (version bumps)
- `Merge branch ...` (merge commits)
- Commits without conventional prefix

### 6. Generate Entries

For each parsed commit:

1. Remove the type prefix (`feat:`, `fix:`, etc.)
2. Capitalize first letter after prefix
3. Apply verb prefix mapping
4. Wrap technical terms in backticks

**Before**: `feat: add Chrome integration to frontend-design skill`
**After**: `- Added Chrome integration to \`frontend-design\` skill`

### 7. Write `CHANGELOG.md`

- If `CHANGELOG.md` does not exist, create it with `# Changelog` as the first line.
- Insert new version section immediately after `# Changelog`:

```markdown
## 1.5.1

- Added feature description
- Fixed bug description
- Improved performance of X
```

Use whichever version format matches the project's detected scheme.

### 8. Update Root `package.json` Version

- Edit root `package.json` to set `"version": "X.Y.Z"`.
- Never touch `frontend/package.json`, `backend/package.json`, or `shared/package.json`.

### 9. Commit Both Files — Explicit Staging Only

```bash
git add CHANGELOG.md package.json
git commit -m "chore: bump version to X.Y.Z"
```

Never use `git add .` or `git add -A` — only stage the two named files.

### 10. Tag (if `--tag` flag)

- Check if tag already exists:
  ```bash
  git tag -l "vX.Y.Z"
  ```
- If it exists, stop and print:
  > ❌ Tag `vX.Y.Z` already exists. Delete it first with: `git tag -d vX.Y.Z`
- Otherwise, create the tag:
  ```bash
  git tag vX.Y.Z
  ```
- Print:
  > 🏷 Tagged `vX.Y.Z` — run `git push --tags` to push to remote.

### 11. Validation

Verify the output follows format rules:

- `# Changelog` as H1 title (preserved)
- `## X.Y.Z` or `## W.X.Y.Z` as H2 version headers (match detected scheme)
- Single `-` bullet per entry (flat list, no categories)
- Entry starts with verb prefix (Added/Fixed/Improved/Changed/Removed/Updated)
- Reverse chronological (newest version at top)
- Root `package.json` `"version"` matches the new changelog version

## Format Rules

**DO**:

- Use flat bullet list (no nested categories)
- Start each entry with a verb (Added, Fixed, Improved, Changed, Removed, Updated)
- Use backticks for code/technical terms
- Keep entries concise (single line when possible)

**DON'T**:

- Create nested category sections (### Added, ### Fixed)
- Include version bump commits
- Include merge commits
- Use vague entries like "Various improvements"

## Commit Type Quick Reference

| Prefix      | Maps To     | Use When                  |
| ----------- | ----------- | ------------------------- |
| `feat:`     | Added       | New functionality         |
| `fix:`      | Fixed       | Bug fixes                 |
| `refactor:` | Improved    | Code restructuring        |
| `perf:`     | Improved    | Performance improvements  |
| `chore:`    | Changed     | Maintenance, dependencies |
| `docs:`     | Updated     | Documentation changes     |
| `style:`    | Changed     | Formatting, code style    |
| `test:`     | Added/Fixed | Test additions/fixes      |
