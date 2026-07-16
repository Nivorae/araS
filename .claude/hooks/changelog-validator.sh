#!/bin/bash

# Changelog Validator Hook
# Validates CHANGELOG.md format on PostToolUse for Edit/Write operations

# Read the tool input from stdin
INPUT=$(cat)

# Extract the file path from the input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only validate CHANGELOG.md
if [[ ! "$FILE_PATH" =~ CHANGELOG\.md$ ]]; then
  echo '{"decision": "allow"}'
  exit 0
fi

# Only validate on develop branch (releases ship from develop).
# Skip silently on feature/* or main so in-progress edits aren't blocked.
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [[ "$BRANCH" != "develop" ]]; then
  echo '{"decision": "allow"}'
  exit 0
fi

# Check if the file exists
if [[ ! -f "$FILE_PATH" ]]; then
  echo '{"decision": "allow"}'
  exit 0
fi

# Read the file content
CONTENT=$(cat "$FILE_PATH")

# Validation checks
ERRORS=()

# Check 1: Must start with # Changelog
if [[ ! "$CONTENT" =~ ^#\ Changelog ]]; then
  ERRORS+=("CHANGELOG must start with '# Changelog'")
fi

# Check 2: Version headers must be ## X.Y.Z (semver) or ## W.X.Y.Z (date-based, no 'v' prefix)
INVALID_VERSIONS=$(echo "$CONTENT" | grep -E "^## " | grep -vE "^## [0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?$")
if [[ -n "$INVALID_VERSIONS" ]]; then
  ERRORS+=("Invalid version format. Expected '## X.Y.Z' or '## W.X.Y.Z', found: $(echo "$INVALID_VERSIONS" | head -1)")
fi

# Check 3: No category headers (### Added, ### Fixed, etc.)
CATEGORY_HEADERS=$(echo "$CONTENT" | grep -E "^### ")
if [[ -n "$CATEGORY_HEADERS" ]]; then
  ERRORS+=("Category headers not allowed (### Added). Use flat list format")
fi

# Check 4: Entries must start with verb prefix
# Get all bullet entries
ENTRIES=$(echo "$CONTENT" | grep -E "^- " | head -20)
while IFS= read -r entry; do
  if [[ -n "$entry" ]]; then
    # Remove the "- " prefix and check if it starts with allowed verb
    TEXT="${entry#- }"
    if [[ ! "$TEXT" =~ ^(Added|Fixed|Improved|Changed|Removed|Updated) ]]; then
      ERRORS+=("Entry must start with verb prefix (Added/Fixed/Improved/Changed/Removed/Updated): \"${TEXT:0:50}...\"")
      break  # Only report first error
    fi
  fi
done <<< "$ENTRIES"

# Check 5: No nested bullets
NESTED_BULLETS=$(echo "$CONTENT" | grep -E "^  +- ")
if [[ -n "$NESTED_BULLETS" ]]; then
  ERRORS+=("Nested bullets not allowed. Use flat list format")
fi

# If errors, block the edit
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  ERROR_MSG=$(printf '%s\\n' "${ERRORS[@]}")
  echo "{\"decision\": \"block\", \"reason\": \"CHANGELOG format validation failed:\\n$ERROR_MSG\"}"
  exit 0
fi

# All checks passed
echo '{"decision": "allow"}'
