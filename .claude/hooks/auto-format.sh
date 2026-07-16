#!/bin/bash
# auto-format.sh - PostToolUse hook for Write|Edit
# Runs prettier on the file that was just written/edited

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/' | head -1)

# Skip if no file path
[[ -z "$FILE_PATH" ]] && exit 0

# Only format source files (ts, tsx, js, jsx, css, json, md)
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.css|*.json|*.md) ;;
  *) exit 0 ;;
esac

# Skip files outside the project (node_modules, .next, dist, etc.)
[[ "$FILE_PATH" =~ node_modules|\.next|dist|\.git ]] && exit 0

# Run prettier if available
if command -v prettier &> /dev/null; then
  prettier --write "$FILE_PATH" 2>/dev/null
elif [ -f "node_modules/.bin/prettier" ]; then
  node_modules/.bin/prettier --write "$FILE_PATH" 2>/dev/null
fi

exit 0
