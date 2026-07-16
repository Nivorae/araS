---
description: Commit with conventional message format
argument-hint: [--no-verify]
allowed-tools:
  [
    "Bash(git add:*)",
    "Bash(git status:*)",
    "Bash(git commit:*)",
    "Bash(git diff:*)",
    "Bash(git log:*)",
  ]
---

# Git Commit

Creates well-formatted commits with conventional messages.

## Format

```
<type>: <description>
```

**NEVER use scoped format like `feat(ui):` or `fix(api):`**

## Types

| Type       | Use                |
| ---------- | ------------------ |
| `feat`     | New feature        |
| `fix`      | Bug fix            |
| `docs`     | Documentation      |
| `style`    | Formatting         |
| `refactor` | Code restructuring |
| `perf`     | Performance        |
| `test`     | Tests              |
| `chore`    | Build/tools        |

## Rules

- **One line only** — no body, no context, no additional lines after the subject
- Imperative mood ("add" not "added")
- Subject <72 chars
- No scope in parentheses
- No Claude signature

## Split Criteria (ask user only if)

- Different types (feat + fix mixed)
- Unrelated file patterns (src/ + docs/ unrelated changes)
- Multiple logical concerns in single commit

## Process

1. Run `/simplify` on files to be committed
2. Check staged files (`git diff --cached`)
3. If nothing staged, stage relevant changes
4. Analyze for split opportunities
5. **Commit directly** unless split is recommended
6. Only ask user if changes should be split into multiple commits

## Output

```
✓ Committed: [abc1234]
  feat: add hero section component
  3 files changed, 145 insertions(+), 2 deletions(-)
```
