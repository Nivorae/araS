---
description: Add changelog entries for a mobile release (OTA or App Store), keyed to apps/mobile/app.json version
argument-hint: [--ota | --release]
allowed-tools: Bash(git:*), Read, Edit, Write, AskUserQuestion
---

# Changelog

Record what shipped, keyed to the **mobile app version** in `apps/mobile/app.json`.

This project is primarily a mobile app; the web app is its backend. So the
changelog tracks App Store versions, **not** the root `package.json` version.

## What this command does NOT do

- **Does not bump `package.json`.** Root `package.json` `version` is scaffold
  residue — nothing consumes it (the root package is private and never
  published). Leave it alone.
- **Does not create git tags.** EAS already records the exact commit hash for
  every build and every OTA update (visible in the `eas update`/`eas build`
  output and on expo.dev). A tag would be a third, hand-maintained copy of that
  same fact — the kind that silently goes stale.
- **Does not bump `apps/mobile/app.json`.** That belongs to `/mobile-release`
  (Step 0.5), which bumps it only on a native rebuild.

## Instructions

### 1. Branch check + sync

- Run `git branch --show-current`. If not `develop`, stop and print:
  > ❌ `/git:changelog` must run on `develop`. Current: `<branch>`.
- Abort if the working tree is dirty (`git status --porcelain` non-empty).
- `git pull --ff-only origin develop`. Stop on failure.

### 1.5. Read docs/TODO.md in full

Read the entire `docs/TODO.md`, not just the "進行中" section — cross-check
it against what this run will cover:

- Use it to write accurate, specific changelog entries: if a commit's
  one-line message is terse but `docs/TODO.md` describes the feature it
  belongs to in more detail, prefer the fuller context when phrasing the
  user-facing entry.
- Note which `docs/TODO.md` items the commits in this range actually
  complete (a task there may span multiple commits, or a commit may only
  partially finish one).
- If a commit references work that `docs/TODO.md` has no record of at all,
  don't block — just flag it in your report at the end so the user knows
  the file may be missing something.

### 2. Determine the mode

| Argument    | Mode                                                                |
| ----------- | ------------------------------------------------------------------- |
| `--ota`     | Entries go under the current version's `### OTA` subsection         |
| `--release` | Start a new `## X.Y` section for an App Store submission            |
| _(none)_    | Infer: ask the user which one, showing the current app.json version |

Read the current version from `apps/mobile/app.json` (`version` field).

### 3. Find commits since the last changelog entry

```bash
git log --format="%s" $(git log --format="%H" --grep="^docs: update changelog" -1)..HEAD
```

**Bootstrap case:** if that returns empty (no prior changelog commit), collect
all commits since the last `## ` heading's shipped work — when in doubt, ask the
user for the cutoff rather than guessing.

### 4. Parse and filter

Map conventional commit types to Chinese entries. **Write for the user, not the
developer** — these entries become the App Store 「此版本新增功能」 text, so they
must describe visible behaviour, not implementation.

| Commit                                        | ❌ Don't write              | ✅ Write                             |
| --------------------------------------------- | --------------------------- | ------------------------------------ |
| `feat: show app version in settings`          | 「新增 version display」    | 「設定頁底部顯示版號與更新時間」     |
| `fix: friendly zh message on network failure` | 「Fixed ApiError handling」 | 「網路中斷時顯示中文提示，不再閃退」 |

**Skip entirely:**

- `docs:`, `test:`, `chore:`, `style:`, `ci:`, `build:` — no user-visible effect
- Merge commits
- Commits touching only `apps/web/**` with no mobile impact
- Commits with no conventional prefix

If a commit's user-facing effect is unclear, **ask** rather than inventing one.

### 5. Write `CHANGELOG.md`

**`--ota` mode** — prepend a dated bullet to the current version's `### OTA`
subsection (newest first). Create the `### OTA` subsection if absent:

```markdown
## 1.1（已上架）

### OTA

- 2026/07/20 重新設計設定頁，底部顯示版號與更新時間
```

**`--release` mode** — insert a new section above the previous version. Mark it
`（審核中）` until it is live, and leave the previous version's OTA history in
place:

```markdown
## 1.2（審核中）

- 新增 XXX 功能

## 1.1（已上架）

...
```

Date format `YYYY/MM/DD`. Newest version at the top.

### 6. Commit

```bash
git add CHANGELOG.md
git commit -m "docs: update changelog"
```

Only stage `CHANGELOG.md`. Never `git add .` or `-A`.

### 6.5. Update docs/TODO.md

For each item identified in step 1.5 as fully completed by this range,
check it off or remove it from `docs/TODO.md` (per that file's own "how to
use" rules). Leave partially-completed items as-is. Commit this as its own
`docs:` commit — don't fold it into step 6's commit, they're different
concerns.

### 6.6. Mirror the entries into `app.json`'s `extra.whatsNew`

The App shows a 「本次更新」 sheet on the first launch after an update applies,
reading `expo.extra.whatsNew` out of `apps/mobile/app.json`. That field is the
**only** place those user-facing lines live at runtime — `CHANGELOG.md` is not
bundled — so it has to be updated here, alongside the changelog, or the sheet
shows nothing.

Reuse the bullets just written. Do not compose separate copy.

```json
"extra": {
  "whatsNew": {
    "id": "2026-08-18-ipad",
    "lines": ["適配 iPad 與大螢幕：表單改為置中欄，圖表使用較寬的版面"]
  }
}
```

Two rules:

- **`id` must change whenever `lines` changes.** The sheet is shown once per
  `id`; an unchanged `id` means users who already saw the previous sheet see
  nothing. Date-plus-topic (`2026-08-18-ipad`) is enough.
- **`version` stays untouched.** `extra` is read from JS, not a native config
  field, so editing it ships over OTA and does **not** require a rebuild. See
  `/mobile-release` Step 0.5 for why bumping `version` on an OTA is destructive.

Failing to update this is fail-safe by design: a stale or missing `id` shows
**nothing** rather than last release's notes. Silence is the intended failure.

Commit with the changelog in step 6 — they are one concern.

### 7. Report

Print the entries added, and for `--release` mode remind the user:

> 這段文字可以直接貼進 App Store Connect 的「此版本新增功能」。

## Format rules

**DO:**

- Flat bullet list under each heading (`### OTA` is the only allowed subsection)
- Describe user-visible behaviour in Chinese
- Prefix OTA entries with the date
- Newest version at top, newest OTA at top

**DON'T:**

- Nested category sections (`### Added` / `### Fixed`)
- Internal refactor / tooling / docs entries
- Vague entries like 「各項優化」
- Touch `package.json`, `app.json`, or git tags
