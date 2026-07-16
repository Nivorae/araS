---
name: security-runbook
description: Use when user mentions "security error", "whitelist blocked", "OWASP", "debug auth", "timing attack", "error masking not working", "403", "401", or "path not allowed". Diagnoses symptom, maps to OWASP category, walks through targeted fix.
allowed-tools: Read, Grep, Bash
---

Diagnose security errors by mapping symptoms to OWASP categories and walking through fixes.

## On activation

Read these files now — keep in context:

- `references/owasp-map.md` — symptom to OWASP to fix location
- `gotchas/false-positives.md` — common misdiagnoses

## Diagnosis flow

1. Identify the symptom — ask user for exact error or behavior if not provided.
2. Look up in `references/owasp-map.md`. Identify OWASP category and fix location.
3. Load the detailed reference:
   - Whitelist errors → `references/whitelist-debug.md`
   - Auth 401/403 → `references/auth-debug.md`
   - Raw error shown → `references/error-masking.md`
4. Walk through reference steps. Read relevant source files to confirm diagnosis.
5. Apply fix at the identified location.
6. Verify — ask user to reproduce. Confirm symptom is gone.

## Quick reference

| Symptom                    | Reference                    |
| -------------------------- | ---------------------------- |
| `Path not in whitelist`    | whitelist-debug.md           |
| 401/403 on protected route | auth-debug.md                |
| Raw error.message in UI    | error-masking.md             |
| Timing-safe compare issues | owasp-map.md → CWE-208 entry |
| CORS blocking calls        | owasp-map.md → CORS entry    |
