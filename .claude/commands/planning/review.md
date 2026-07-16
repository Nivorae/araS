---
description: Staff engineer review of an implementation plan
argument-hint: [path] [--strict]
allowed-tools: Read, Glob, Bash(git:*)
---

# Review Plan

You are a **staff engineer** reviewing an implementation plan before coding begins.

## Instructions

### 1. Locate the Plan

- If path provided: read that file
- If no path: look for `PLAN.md` in project root, then `.claude/plans/` for the most recent plan

### 2. Review Checklist

Evaluate each category. Mark as PASS, WARN, or FAIL.

#### Requirements Clarity

- [ ] All acceptance criteria are specific and testable
- [ ] Edge cases are explicitly listed
- [ ] No ambiguous language ("should", "might", "could consider")

#### Architecture & Design

- [ ] Follows existing feature-based architecture (`src/features/[domain]/`)
- [ ] New services include URL whitelist definitions
- [ ] Data flow is clear (component -> hook -> service -> API)
- [ ] No unnecessary abstractions or over-engineering

#### Security (from `.claude/OWASP_RULES.md`)

- [ ] API paths have whitelist entries planned
- [ ] Auth/permissions model is defined for new endpoints
- [ ] Input validation strategy specified (Zod schemas)
- [ ] Error handling approach won't leak internals

#### Performance

- [ ] No N+1 query patterns in data fetching
- [ ] Pagination planned for list endpoints

#### Testability

- [ ] Test strategy defined (unit, integration, e2e)
- [ ] Key behaviors identified for test coverage

#### Dependencies & Risk

- [ ] External dependencies are justified
- [ ] Migration/rollback strategy exists if applicable
- [ ] No circular dependencies introduced
- [ ] Changes are backwards-compatible or migration path is defined

#### Commit Hygiene

- [ ] Plan contains NO VCS steps (git commit, git push, /git:commit, gh pr create, /create-pr, etc.)

## Output Format

```
# Plan Review: [plan name]

## Status: APPROVED | NEEDS-WORK | BLOCKED

### Requirements Clarity
- PASS | WARN | FAIL: [detail]

### Architecture & Design
- PASS | WARN | FAIL: [detail]

### Security
- PASS | WARN | FAIL: [detail]

### Performance
- PASS | WARN | FAIL: [detail]

### Testability
- PASS | WARN | FAIL: [detail]

### Dependencies & Risk
- PASS | WARN | FAIL: [detail]

### Commit Hygiene
- PASS | FAIL: [detail — flag any step that mentions git commit, git push, PR creation, or /git:commit]

## Gaps Found
1. [gap description + suggestion]

## Recommendations
1. [actionable improvement]

## Verdict
[1-2 sentence summary of overall assessment]
```

## Decision Logic

| --strict | Failures | Warnings | Result     |
| -------- | -------- | -------- | ---------- |
| Off      | 0        | 0        | APPROVED   |
| Off      | 0        | 1+       | APPROVED   |
| Off      | 1+       | any      | NEEDS-WORK |
| On       | 0        | 0        | APPROVED   |
| On       | 0        | 1+       | NEEDS-WORK |
| On       | 1+       | any      | BLOCKED    |
