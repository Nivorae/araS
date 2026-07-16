---
description: Suggest a branch name from changes, then create and switch to it from latest main
argument-hint: [requirement]
allowed-tools:
  [
    "Bash(git status:*)",
    "Bash(git diff:*)",
    "Bash(git branch:*)",
    "Bash(git fetch:*)",
    "Bash(git checkout:*)",
    "Bash(git rev-parse:*)",
  ]
---

# Git Branch

Suggest a branch name from the current changes and the requirement, then
**create it from the latest `main` and switch to it** — carrying any uncommitted
work onto the new branch.

## Process

1. **Analyze** — `git status`, `git diff --cached --stat`, and `git diff --stat`
   (unstaged) to read the change scope. Combine with the `$ARGUMENTS` requirement.
2. **Pick a name** — choose the type + a lowercase-hyphenated description (table below).
3. **Create from main and switch** — always base the branch on `main`, never the
   branch currently checked out:

   ```bash
   git fetch origin main
   git checkout -b <name> --no-track origin/main
   ```

   If there is no `origin` remote, fall back to local main:

   ```bash
   git checkout -b <name> --no-track main
   ```

4. **Confirm** — print the new branch name and the base it was created from.

## Branch Types

| Type         | Pattern                    | Example                 |
| ------------ | -------------------------- | ----------------------- |
| Feature      | `feature/description`      | `feature/user-auth`     |
| Bugfix       | `bugfix/description`       | `bugfix/nav-overflow`   |
| Hotfix       | `hotfix/description`       | `hotfix/security-patch` |
| Experimental | `experimental/description` | `experimental/new-api`  |
| Release      | `release/version`          | `release/1.2.0`         |

With ticket: `feature/JIRA-123_description` (underscore separates ticket from description).

## Rules

- Lowercase with hyphens; underscore only between ticket and description.
- **Always create from `main`** — the commands above guarantee this. Never branch
  off the current feature branch.
- `--no-track` stops the new branch from adopting `main` as its push/pull upstream.
  Set the real upstream on first push: `git push -u origin <name>`.
- Uncommitted changes are carried onto the new branch (intended). If `git checkout -b`
  reports that local changes would be overwritten, **stop and report** — never force.
- If the branch already exists, propose a distinct variant (e.g. add `-2` or a more
  specific description) instead of failing.

## Output

```
✅ Created and switched to `feature/user-authentication` (from origin/main)
```
