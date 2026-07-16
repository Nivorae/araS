#!/bin/bash
# design-context.sh - Inject design system context for commands
# Provides design tokens and style preferences context

set -e

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // empty')

case "$TOOL_NAME" in
  "Read")
    FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .path // empty')
    ;;
  *)
    exit 0
    ;;
esac

# When reading design screenshots, remind about style guide
if [[ "$FILE_PATH" =~ \.(png|jpg|jpeg|webp)$ ]] && [[ "$FILE_PATH" =~ docs/designs/screenshots/ ]]; then
  echo '{"decision": "allow", "message": "📐 Design context: Check docs/designs/STYLE-GUIDE.md or SETUP.md Section 12 for style preferences. Use tokens from src/styles/tokens/"}'
  exit 0
fi

exit 0
