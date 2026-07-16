#!/bin/bash
# design-validator.sh - Validate design system patterns
# Mirrors .agent/hooks/design-system.hooks.ts

set -e

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // empty')

# Only check Write/Edit on component files
case "$TOOL_NAME" in
  "Write"|"Edit")
    FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // empty')
    CONTENT=$(echo "$TOOL_INPUT" | jq -r '.content // .new_string // empty')
    ;;
  *)
    exit 0
    ;;
esac

# Only validate component files
if [[ ! "$FILE_PATH" =~ src/(features/[^/]+/components|components)/.*\.tsx$ ]]; then
  exit 0
fi

# Block: var() in JavaScript string contexts (causes runtime errors)
if echo "$CONTENT" | grep -qE "style=\{\{[^}]*['\"]var\(--[^)]+\)['\"]" || \
   echo "$CONTENT" | grep -qE "className=\"[^\"]*\[var\(--"; then
  echo '{"decision": "block", "reason": "var() in JS string context will fail at runtime. Use Tailwind tokens instead: className=\"w-sidebar\" not style={{ width: \"var(--sidebar-width)\" }}"}'
  exit 0
fi

# Warn: Hardcoded CSS values (informational)
HARDCODED=""
if echo "$CONTENT" | grep -qE "text-\[\d+(\.\d+)?(px|rem|em)\]"; then
  HARDCODED="text-[Npx]"
fi
if echo "$CONTENT" | grep -qE "(gap|p|m)-\[\d+(\.\d+)?(px|rem|em)\]"; then
  HARDCODED="${HARDCODED:+$HARDCODED, }spacing-[Npx]"
fi
if echo "$CONTENT" | grep -qE "(bg|text|border)-\[#[0-9a-fA-F]+\]"; then
  HARDCODED="${HARDCODED:+$HARDCODED, }color-[#hex]"
fi

if [[ -n "$HARDCODED" ]]; then
  echo "{\"decision\": \"allow\", \"message\": \"⚠️ Hardcoded CSS values detected ($HARDCODED). Consider design tokens from src/styles/tokens/\"}"
  exit 0
fi

exit 0
