#!/bin/bash
# PreToolUse hook - validates commit message format
# Blocks scoped commits like feat(ui): or fix(api):

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check git commit commands
[[ ! "$COMMAND" =~ ^git\ commit ]] && exit 0

# Extract commit message from -m flag
MESSAGE=$(echo "$COMMAND" | grep -oP '(?<=-m\s")[^"]+' | head -1)
[[ -z "$MESSAGE" ]] && MESSAGE=$(echo "$COMMAND" | grep -oP "(?<=-m\s')[^']+" | head -1)

# Check for scoped format like feat(scope): or fix(api):
if [[ "$MESSAGE" =~ ^[a-z]+\([a-z0-9_-]+\): ]]; then
  jq -n --arg msg "$MESSAGE" \
    '{"decision": "block", "reason": ("Scoped commit format not allowed.\nFound: " + $msg + "\nUse: <type>: <description> (no parentheses)\nExample: feat: add user authentication")}'
  exit 0
fi

exit 0
