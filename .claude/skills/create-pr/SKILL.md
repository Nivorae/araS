---
name: create-pr
description: Commit, push, and open a PR to develop
allowed-tools: Bash(git checkout:*), Bash(git status:*), Bash(git push:*), Bash(gh pr create:*), Bash(git diff:*), Bash(git branch:*), Bash(cat:*), Read, Edit
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Current progress tracking: !`cat docs/TODO.md`

## Branch guard

You MUST NOT be on `main` or `develop`. If you are, stop and tell the user:

> "You're on `{branch}`. Switch to a working branch first."

## Cross-check against docs/TODO.md

Before committing, compare the current branch and the diff's actual content
against the "進行中" section of `docs/TODO.md`:

- If an item there names this branch (or clearly describes this diff), this
  PR is expected — proceed.
- If nothing in `docs/TODO.md` matches this branch/diff, stop and tell the
  user: "This PR isn't tracked in `docs/TODO.md` — want me to add it before
  opening the PR, or is this intentionally untracked?" Proceed only after
  they answer.
- If the diff only partially covers a tracked item (e.g. checklist has more
  unchecked sub-items than this PR addresses), note that in your summary to
  the user, but don't block on it.

## Your task

Based on the above changes:

1. Use the `/git-commit` skill to create a commit — no Co-Authored-By, no description body
2. Push the branch to origin
3. Create a pull request using `gh pr create --base develop` — title only, no description body
4. Update `docs/TODO.md`: check off / remove the item(s) this PR covers, or
   add a note that a PR is now open for it. Commit this update separately
   (small `docs:` commit) rather than folding it into step 1 — the code
   change and the tracking update are logically distinct.

Always target `develop` as the base branch. Never target `main`.

Do steps 1-3 in a single message.
