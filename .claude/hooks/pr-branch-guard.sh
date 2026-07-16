#!/bin/bash
# pr-branch-guard.sh - Block PR creation from main or develop
# Enforces: any working branch → develop (staging) → main (manual merge by user)

INPUT=$(cat) || exit 0

TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // empty' 2>/dev/null) || exit 0
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null) || exit 0

# Only check gh pr create commands
if ! echo "$COMMAND" | grep -q "gh pr create"; then
  exit 0
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null) || exit 0

# Block PR creation from main or develop
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "develop" ]; then
  echo "{\"decision\": \"block\", \"reason\": \"PR blocked: you're on '$CURRENT_BRANCH'. PRs should be created from a working branch, not main or develop.\"}"
  exit 0
fi

# Must target develop (require --base develop)
if ! echo "$COMMAND" | grep -qE -- "--base[= ]develop|--base develop"; then
  echo "{\"decision\": \"block\", \"reason\": \"PR blocked: PRs must target develop. Use: gh pr create --base develop\"}"
  exit 0
fi

exit 0
