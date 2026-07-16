#!/bin/bash
# bash-validator.sh - Block dangerous bash commands
# Mirrors .agent/hooks/security.hooks.ts

set -e

# Read JSON input from stdin
INPUT=$(cat)

# Extract tool input
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // empty')
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // empty')

# Blocked patterns (same as Agent SDK)
BLOCKED_PATTERNS=(
  "rm -rf /"
  "rm -rf /*"
  "sudo rm"
  "chmod 777"
  "curl.*\|.*sh"
  "wget.*\|.*sh"
  "> /dev/sda"
  "mkfs"
  "dd if=.* of=/dev"
  ":(){:|:&};:"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo '{"decision": "block", "reason": "Blocked dangerous command pattern: '"$pattern"'"}'
    exit 0
  fi
done

# Allow the command
exit 0
