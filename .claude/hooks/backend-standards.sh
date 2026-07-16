#!/bin/bash
# backend-standards.sh - Validate backend file changes against project standards
# Works with Claude Code's .claude/settings.json hooks (PreToolUse for Write|Edit)
#
# Checks:
# 1. process.env usage (should use config/env.ts)
# 2. plain Error thrown (should use AppError subclasses)
# 3. Prisma in route files (should use service layer)
# 4. error.message exposed to UI (should use formatApiError)
# 5. Missing middleware order hints
# 6. Direct delete on soft-delete models

set -e

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // empty')

# Only check Write and Edit operations
case "$TOOL_NAME" in
  "Write"|"Edit")
    ;;
  *)
    exit 0
    ;;
esac

FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // empty')
CONTENT=$(echo "$TOOL_INPUT" | jq -r '.content // .new_string // empty')

# Only check backend and shared files
if [[ "$FILE_PATH" != *"backend/"* ]] && [[ "$FILE_PATH" != *"shared/"* ]]; then
  exit 0
fi

WARNINGS=()

# --- Check 1: process.env direct usage ---
if [[ "$CONTENT" == *"process.env."* ]] && [[ "$FILE_PATH" != *"config/env"* ]]; then
  WARNINGS+=("process.env used directly. Import env from config/env.ts instead (STD:env-validation)")
fi

# --- Check 2: plain Error thrown ---
if echo "$CONTENT" | grep -qP 'throw\s+new\s+Error\(' 2>/dev/null; then
  if [[ "$FILE_PATH" != *"constants/errors"* ]] && [[ "$FILE_PATH" != *"test"* ]] && [[ "$FILE_PATH" != *"spec"* ]]; then
    WARNINGS+=("Plain Error thrown. Use AppError subclass: NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError (STD:error-codes)")
  fi
fi

# --- Check 3: Prisma in route files ---
if [[ "$FILE_PATH" == *"routes/"* ]] && [[ "$CONTENT" == *"prisma."* ]]; then
  WARNINGS+=("Prisma called in route file. Routes must call services, not repositories/Prisma (STD:layered-architecture)")
fi

# --- Check 4: error.message exposed to response ---
if echo "$CONTENT" | grep -qP '(?:res\.json|res\.send|toast).*error\.message' 2>/dev/null; then
  WARNINGS+=("error.message may be exposed to users. Use formatApiError() or AppError classes (STD:error-masking)")
fi

# --- Check 5: Route without requireAuth ---
if [[ "$FILE_PATH" == *"routes/"* ]]; then
  if echo "$CONTENT" | grep -qP 'router\.(post|put|patch|delete)\(' 2>/dev/null; then
    if ! echo "$CONTENT" | grep -q 'requireAuth' 2>/dev/null; then
      WARNINGS+=("State-changing route may be missing requireAuth middleware. Order: requireAuth → validate* → rateLimiter → handler (STD:middleware-stack)")
    fi
  fi
fi

# --- Check 6: prisma.*.delete() on potential soft-delete models ---
if echo "$CONTENT" | grep -qP 'prisma\.\w+\.delete\(' 2>/dev/null; then
  WARNINGS+=("prisma.model.delete() used. If this model has soft deletes, use softDelete() method instead (STD:soft-deletes)")
fi

# --- Check 7: Schema defined outside shared/ ---
if [[ "$FILE_PATH" == *"backend/"* ]] && [[ "$FILE_PATH" == *"schema"* ]]; then
  if [[ "$FILE_PATH" != *"prisma/"* ]] && [[ "$FILE_PATH" != *"shared/"* ]]; then
    WARNINGS+=("Schema may be in backend only. Define Zod schemas in shared/src/schemas/ for frontend/backend type sharing (STD:request-validation)")
  fi
fi

# Output warnings if any
if [ ${#WARNINGS[@]} -gt 0 ]; then
  # Build JSON warning message
  WARNING_TEXT=""
  for w in "${WARNINGS[@]}"; do
    if [ -n "$WARNING_TEXT" ]; then
      WARNING_TEXT="${WARNING_TEXT}\n- ${w}"
    else
      WARNING_TEXT="- ${w}"
    fi
  done

  jq -n --arg reason "Backend Standards Warnings:\n${WARNING_TEXT}" \
    '{"decision": "allow", "reason": $reason}'
  exit 0
fi

exit 0
