---
description: Interactive feature spec interview for ad-hoc requirements
argument-hint: '[name] "requirement"'
allowed-tools: Read, Write
---

# Feature Spec

Create a build-ready feature specification through an interactive interview.

## Instructions

### Parse Arguments

1. Extract `[name]` — first argument (kebab-case, no spaces)
2. Extract `"requirement"` — quoted string describing the requirement
3. Check for `--quick` flag anywhere in the arguments
4. If name or requirement is missing, show usage and stop

### Pre-Write Check

1. Compute output path: `specs/feature-[name].md`
2. If the file already exists, ask: "specs/feature-[name].md already exists. Overwrite? (yes/no)"
3. If no, stop with message: "Aborted. Rename or delete the existing spec first."

### Quick Mode (--quick flag provided)

1. Read `templates/FEATURE_SPEC.md` for the canonical structure
2. Auto-generate a minimal spec:
   - **Section 1 (Overview)**: Fill user story from the requirement description, estimate as "TBD"
   - **Section 2 (Requirements)**: Infer 2-4 MUST-have requirements from the requirement description
   - **Sections 3-15**: Keep the template placeholders with HTML comments intact
3. Replace `[FEATURE_NAME]` throughout with the provided name (Title Case)
4. Create `specs/` directory if it doesn't exist
5. Write to `specs/feature-[name].md`
6. Show post-write message (see below)

### Full Mode (no --quick flag)

Read `templates/FEATURE_SPEC.md` to understand the target structure, then guide the user through a progressive interview. Each step maps to a section in the template.

**Step 1 — User Story + Estimate (Section 1)**
Ask: "You described: '[requirement]'. What's the user story? (As a [role], I want [capability] so that [benefit]) And rough effort estimate?"

**Step 2 — Requirements (Section 2)**
Ask: "List the requirements, prefixed with MUST/SHOULD/NICE:"
Example: "MUST: users can toggle dark mode, SHOULD: persist preference, NICE: animated transition"

**Step 3 — API Endpoints (Section 3)**
Ask: "Any API endpoints? List as METHOD /path - description. Type 'skip' for none."

**Step 4 — Database Schema (Section 4)**
Ask: "Any new or modified database models? Describe fields and relationships. Type 'skip' for none."

**Step 5 — Frontend Components (Section 5)**
Ask: "What frontend components, hooks, and services are needed? Type 'skip' for none."

**Step 6 — Business Logic (Section 6)**
Ask: "Describe the business logic as numbered steps per operation. Type 'skip' for none."

**Step 7 — Validation Rules (Section 7)**
Ask: "What validation rules? List as: field, type, constraints. Type 'skip' for none."

**Step 8 — Security (Section 8)**
Ask: "Any OWASP security concerns? (A01-A10 categories) Type 'skip' for none."

**Step 9 — Error Handling (Section 9)**
Ask: "What error scenarios and codes should be handled? Type 'skip' for none."

**Step 10 — Testing (Section 10)**
Ask: "What test cases should be covered? What's the coverage target?"

**Step 11 — Dependencies (Section 11)**
Ask: "Any external packages or internal services needed? Type 'skip' for none."

**Step 12 — File Ownership (Section 12)**
Ask: "List all files this feature creates, modifies, or shares with other tasks."

**Step 13 — Performance (Section 13)**
Ask: "Any performance targets per endpoint? Type 'skip' for none."

**Step 14 — Acceptance Criteria (Section 14)**
Ask: "List specific, testable acceptance criteria for this feature."

**Step 15 — Out of Scope (Section 15)**
Ask: "What is explicitly out of scope for this feature? Type 'skip' for none."

### Generate Output

1. Read `templates/FEATURE_SPEC.md` for the exact structure
2. Build `specs/feature-[name].md` using the **exact same structure** as the template — all 15 sections plus the Standards Reference table at the bottom
3. Fill sections with interview answers
4. For skipped sections, keep the template placeholders with HTML comments intact (so they're easy to fill in later)
5. Replace `[FEATURE_NAME]` throughout with the provided name (Title Case)
6. Create `templates/` directory if it doesn't exist
7. Write the file

### Post-Write Message

Show:

```
Feature spec written to specs/feature-[name].md

Next steps:
1. Review and refine the spec
2. Run the ad-hoc orchestrator pipeline:
   npm run agent:orchestrate -- --adhoc specs/feature-[name].md
   This creates task-config.json and state.json, then continue with:
   - /superpowers:write-plan (Phase 1.6 — generates tasks/task-1-plan.md)
   - /planning:review tasks/task-1-plan.md (Phase 1.7 — review the plan)
   - npm run agent:orchestrate -- --worktrees (Phase 2)
   - npm run agent:orchestrate -- --build (Phase 3)
3. Or include in multi-task planning: npm run agent:orchestrate -- --plan
4. Or implement directly following the spec
```

## Format Rules

- Output file: `specs/feature-[name].md` (kebab-case name)
- Structure must match `templates/FEATURE_SPEC.md` exactly (all 15 sections + Standards Reference)
- Skipped sections retain template placeholders with HTML comments
- Feature name in Title Case within the document, kebab-case in filename
- The `specs/` directory holds all feature specs; `templates/` holds only base templates
