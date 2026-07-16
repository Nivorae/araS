#!/bin/bash
# skill-usage-logger.sh - Logs skill file reads for usage measurement
# Article ref: "Measuring Skills" — PreToolUse hook that logs skill invocations
#
# Tracks which skills are triggered and how often, enabling teams to:
# - Find popular skills
# - Detect undertriggering compared to expectations
# - Identify skills that need better descriptions

INPUT=$(cat) || exit 0

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null) || exit 0
SKILL_NAME=""

if [ "$TOOL_NAME" = "Skill" ]; then
  # Skill tool: skill name is in tool_input.skill
  SKILL_NAME=$(echo "$INPUT" | jq -r '.tool_input.skill // empty' 2>/dev/null)
elif [ "$TOOL_NAME" = "Read" ]; then
  # Legacy: reads of .claude/skills/<name>/SKILL.md
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
  if [[ "$FILE_PATH" == *".claude/skills/"*"/SKILL.md" ]]; then
    SKILL_NAME=$(echo "$FILE_PATH" | sed -n 's|.*\.claude/skills/\([^/]*\)/SKILL\.md|\1|p')
  fi
fi

if [ -z "$SKILL_NAME" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
LOG_DIR="$PROJECT_DIR/.claude/skills"
LOG_FILE="$LOG_DIR/usage.log"

# Ensure log directory exists
[ -d "$LOG_DIR" ] || exit 0

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Append structured log entry (one line per invocation, tab-separated)
printf '%s\t%s\n' "$TIMESTAMP" "$SKILL_NAME" >> "$LOG_FILE"

# Silent — don't interfere with the Read operation
exit 0
