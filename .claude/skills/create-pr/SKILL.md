---
name: create-pr
description: Commit, push, and open a PR to develop
allowed-tools: Bash(git checkout:*), Bash(git status:*), Bash(git push:*), Bash(gh pr create:*), Bash(git diff:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(node:*), Bash(pnpm diagram:png)
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`

## Branch guard

You MUST NOT be on `main` or `develop`. If you are, stop and tell the user:

> "You're on `{branch}`. Switch to a working branch first."

## Architecture diagram check

Before committing, run `git diff --name-only origin/main...HEAD` plus the
uncommitted changes above and compare them with the trigger list in
`CLAUDE.md` → "Architecture diagram".

- **No trigger matches** → leave the diagram alone.
- **A trigger matches** → follow that section's steps (edit the JSON, archify
  `finalize`, `pnpm diagram:png`) and commit the diagram files as a separate
  `docs: update architecture diagram` commit before the PR. If `finalize` fails
  and can't be repaired, stop and tell the user instead of opening the PR.

Tell the user which outcome applied (and which trigger matched) in your reply.

## Your task

Based on the above changes:

1. Use the `/git-commit` skill to create a commit — no Co-Authored-By, no description body
2. Push the branch to origin
3. Create a pull request using `gh pr create --base develop` — title only, no description body

Always target `develop` as the base branch. Never target `main`.

Do all of the above in a single message.
