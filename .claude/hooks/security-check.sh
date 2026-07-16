#!/bin/bash
# security-check.sh - Protect sensitive files
# Mirrors .agent/hooks/security.hooks.ts

set -e

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // empty')

# Get file path based on tool
case "$TOOL_NAME" in
  "Read"|"Write"|"Edit")
    FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // empty')
    ;;
  *)
    exit 0
    ;;
esac

# Blocked files (require explicit approval)
BLOCKED_FILES=(
  ".env.production"
  "src/core/security/constantTimeCompare.ts"
)

for blocked in "${BLOCKED_FILES[@]}"; do
  if [[ "$FILE_PATH" == *"$blocked"* ]]; then
    echo '{"decision": "block", "reason": "Cannot modify protected file: '"$blocked"'"}'
    exit 0
  fi
done

# Protected files (warn but allow)
PROTECTED_PATTERNS=(
  "src/core/security/"
  "src/core/auth/"
  ".env"
)

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo '{"decision": "ask", "reason": "Modifying security-sensitive file: '"$FILE_PATH"'. Are you sure?"}'
    exit 0
  fi
done

exit 0
