---
description: Apply review recommendations to a plan, producing a confident, commit-free update
argument-hint: [plan-path]
model: claude-sonnet-4-6
allowed-tools: Read, Edit, Glob, Bash(git:*)
---

# Apply Review to Plan

Update an existing plan by applying only the recommendations produced by `/planning:review`. The result must be a confident, commit-free plan — no maybes, no git steps.

## Instructions

### 1. Locate the Plan

- If a path is provided as an argument: read that file
- Otherwise: look for `PLAN.md` in the project root, then `.claude/plans/` for the most recent `.md` file

Read the plan in full.

### 2. Identify the Review Output

The review output is the `/planning:review` result visible in this conversation. Extract:

- Every item marked **FAIL** or **WARN** under any section
- The **Gaps Found** list
- The **Recommendations** list

If no review output is present in the conversation, stop and tell the user to run `/planning:review` first.

### 3. Determine Changes

For each recommendation or gap:

- Decide the **minimum edit** that resolves it — no speculative additions (YAGNI)
- If a recommendation is vague ("consider X"), convert it to a concrete, testable step before applying it
- If you cannot make a step 100% confident and actionable, **skip it** and list it as "deferred — needs clarification"

**Hard rules — never add these to the plan:**

- `git commit` / `git push` / any commit invocation
- `/git:commit` / `/create-pr` / `gh pr create` or any equivalent
- Any step whose sole purpose is version control

### 4. Apply Changes In-Place

Edit the plan file with surgical precision:

- Fix each FAIL and WARN item
- Add missing error scenarios or edge cases from Gaps Found
- Remove any commit/push steps already present
- Replace ambiguous language ("should", "might", "could consider") with concrete directives
- Do not restructure sections that are not affected by the review

### 5. Output Summary

After editing, print a compact diff summary:

```
## Plan Updated

### Applied
- [short description of each change made]

### Skipped (needs clarification)
- [any recommendation that could not be made confident]

### Removed
- [any commit/push steps that were stripped]
```

Do not reprint the full plan. Do not recommend creating a PR or committing.
