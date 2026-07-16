# Commit Format Review Reference

Detailed review checklist, violation examples, and split guidance for this project's commit conventions.

## Review Checklist

For each commit message, check each rule in order. Fail fast on the first violation.

| #   | Rule                              | Check                                                        | Severity |
| --- | --------------------------------- | ------------------------------------------------------------ | -------- |
| 1   | Format is `<type>: <description>` | No parenthesized scope present                               | FAIL     |
| 2   | Type is a valid keyword           | One of: feat, fix, docs, style, refactor, perf, test, chore  | FAIL     |
| 3   | Colon + space after type          | `feat: ` not `feat -` or `feat:description`                  | FAIL     |
| 4   | Description in imperative mood    | "add" not "added", "fix" not "fixed", "update" not "updated" | FAIL     |
| 5   | First line < 72 characters        | Count characters including `type: ` prefix                   | FAIL     |
| 6   | No Claude signature               | No `Co-Authored-By: Claude` line present                     | FAIL     |
| 7   | Single logical concern            | Message doesn't combine unrelated changes                    | WARN     |
| 8   | Description is meaningful         | Not "misc", "wip", "updates", or empty                       | WARN     |

## Common Violations

### Scoped Format (Most Common Violation)

```
❌ feat(auth): add login page
❌ fix(api): correct status codes
❌ chore(deps): update packages
❌ refactor(ui): extract button component

✅ feat: add login page
✅ fix: correct status codes
✅ chore: update packages
✅ refactor: extract button component
```

### Wrong Tense

```
❌ feat: added hero section
❌ fix: fixed null pointer in user service
❌ docs: updated README

✅ feat: add hero section
✅ fix: resolve null pointer in user service
✅ docs: update README
```

### Invalid Type

```
❌ update: user profile page
❌ wip: auth flow
❌ misc: various fixes
❌ enhancement: search bar

✅ feat: add search bar to user profile page
✅ fix: resolve auth flow redirect loop
```

### Too Long

```
❌ feat: add comprehensive user authentication system with JWT tokens and refresh logic (82 chars)

✅ feat: add JWT-based user authentication with refresh logic (58 chars)
```

### Claude Signature

```
❌ feat: add dashboard

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

✅ feat: add dashboard
```

### Multiple Concerns (Warn → Suggest Split)

```
⚠️ feat: add login page and fix broken logout and update README
```

Suggest split:

```
✅ feat: add login page
✅ fix: resolve broken logout redirect
✅ docs: update README with auth setup
```

## Split Decision Guide

Split into separate commits when:

1. **Mixed types**: A change introduces a feature AND fixes a bug → `feat:` + `fix:`
2. **Unrelated files**: Feature code in `src/` + unrelated `docs/` change → separate commits
3. **Multiple logical units**: Two independent features in one commit → one commit per feature

Do **not** split when:

- A feature and its test are in the same commit (`feat:` + test file = still one `feat:`)
- A bug fix touches multiple files that are all part of the same fix
- Documentation update is directly about the feature being committed

## Automated Review Prompt

To review a batch of commit messages, apply this process to each:

1. Parse `<type>(<optional-scope>): <description>` pattern
2. If scope captured → FAIL rule 1
3. Check type against valid list → FAIL if not found
4. Check description first word for past tense (ends in "ed" or "ing") → FAIL if so
5. Count total length → FAIL if ≥ 72
6. Scan for "Co-Authored-By: Claude" → FAIL if found
7. Check for conjunctions ("and", "also", "&") suggesting multiple concerns → WARN if found
8. Summarize: total checked, passed, failed, warnings

## Valid Commit Examples

```
feat: add role-based authorization middleware
fix: resolve token expiry edge case in refresh handler
docs: add API authentication guide to README
style: normalize import order across service files
refactor: extract validation logic into shared utility
perf: cache user permissions to reduce DB queries
test: add integration tests for auth middleware
chore: upgrade TypeScript to 5.4
```
