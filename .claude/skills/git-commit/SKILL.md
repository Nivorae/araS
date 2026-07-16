---
name: git-commit
description: This skill should be used when the user asks to "commit", "create a commit", "make a commit", "git commit", "write a commit message", "review commit message", "check commit format", or invokes "/commit". Enforces the project's conventional commit format — no scopes, imperative mood, <72 chars, no Claude signature.
---

# Git Commit

Creates well-formatted commits and reviews commit messages for compliance with this project's commit conventions.

## Commit Format

```
<type>: <description>
```

**NEVER use scoped format** — `feat(ui):`, `fix(api):`, `chore(deps):` are all **forbidden**.

## Valid Types

| Type       | Use                     |
| ---------- | ----------------------- |
| `feat`     | New feature             |
| `fix`      | Bug fix                 |
| `docs`     | Documentation only      |
| `style`    | Formatting, whitespace  |
| `refactor` | Code restructuring      |
| `perf`     | Performance improvement |
| `test`     | Tests (add/fix)         |
| `chore`    | Build, tools, config    |

## Rules

- **One line only** — no body, no context, no bullet points below the subject
- **Imperative mood**: "add" not "added", "fix" not "fixed"
- **First line < 72 chars**
- **No scope in parentheses** — `feat:` never `feat(scope):`
- **No Claude signature** — no "Co-Authored-By: Claude" lines

## Commit Process

1. Run `/simplify` on files to be committed
2. Check staged files: `git diff --cached --name-only`
3. If nothing staged, stage relevant changes with `git add`
4. Analyze changes for split opportunities (see below)
5. **Commit directly** — no confirmation needed unless a split is recommended
6. Only ask user if split criteria apply

## Split Criteria (ask user only if)

- Different types mixed in one commit (e.g., `feat` + `fix`)
- Unrelated file patterns (e.g., `src/` feature + `docs/` unrelated to that feature)
- Multiple distinct logical concerns

## Output Format

```
✓ Committed: [abc1234]
  feat: add hero section component
  3 files changed, 145 insertions(+), 2 deletions(+)
```

## Commit Format Review

To review an existing commit message or a proposed message for compliance:

1. Check format is exactly `<type>: <description>` — single line, no body — reject scoped variants and any multi-line messages
2. Verify type is one of the 8 valid types
3. Verify description uses imperative mood
4. Verify total length < 72 characters
5. Verify no Claude signature appended
6. Report result using the output format below

### Review Output Format

```
[PASS] feat: add user authentication — ✅ valid
[FAIL] feat(auth): add login — ❌ scoped format forbidden
[FAIL] Fixed the bug in user service — ❌ past tense, missing type prefix
[WARN] chore: update dependencies and fix login bug and refactor db — ⚠️ multiple concerns, consider splitting
```

## Additional Resources

### Reference Files

- **`references/commit-format-review.md`** — Full review checklist, violation examples, and multi-commit split guidance
