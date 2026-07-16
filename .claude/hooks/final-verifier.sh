#!/usr/bin/env bash
# final-verifier.sh — lightweight Stop hook replacement (no LLM tokens)
# Runs lint/type-check/tests and checks security patterns on modified files.

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$PROJECT_DIR"

# ── 1. Get modified files ────────────────────────────────────────────────────
MODIFIED=$(git diff --name-only HEAD~1 2>/dev/null || git diff --cached --name-only 2>/dev/null || true)

if [[ -z "$MODIFIED" ]]; then
  echo "✅ APPROVED: No modified files detected." >&2
  exit 0
fi

ERRORS=()
WARNINGS=()

# ── 2. Tooling checks (scoped to changed workspaces; tests are CI's job) ──────
# Only lint/type-check the packages that actually changed. The full test suite
# is intentionally NOT run here — CI owns it — so the per-turn Stop hook stays fast.
CHANGED_PKGS=()
grep -q '^frontend/' <<< "$MODIFIED" && CHANGED_PKGS+=("@repo/frontend")
grep -q '^backend/'  <<< "$MODIFIED" && CHANGED_PKGS+=("@repo/backend")
grep -q '^shared/'   <<< "$MODIFIED" && CHANGED_PKGS+=("@repo/shared")

if ! command -v pnpm &>/dev/null; then
  WARNINGS+=("pnpm not available — tooling checks skipped")
elif [[ ${#CHANGED_PKGS[@]} -gt 0 ]]; then
  FILTERS=()
  for p in "${CHANGED_PKGS[@]}"; do FILTERS+=("--filter=$p"); done

  # lint is independent per package
  if ! pnpm "${FILTERS[@]}" --if-present lint >/dev/null 2>&1; then
    ERRORS+=("lint failed in ${CHANGED_PKGS[*]} — run 'pnpm ${FILTERS[*]} lint'")
  fi

  # type-check needs @repo/shared built first (frontend/backend import it)
  pnpm --filter=@repo/shared build >/dev/null 2>&1 || true
  if ! pnpm "${FILTERS[@]}" --if-present type-check >/dev/null 2>&1; then
    ERRORS+=("type-check failed in ${CHANGED_PKGS[*]} — run 'pnpm ${FILTERS[*]} type-check'")
  fi
fi

# ── 3. Security pattern checks ───────────────────────────────────────────────
while IFS= read -r file; do
  # Only check existing .ts/.tsx files (skip tests, skip deleted)
  [[ "$file" =~ \.(ts|tsx)$ ]] || continue
  [[ "$file" =~ \.(test|spec)\. ]] && continue
  [[ ! -f "$PROJECT_DIR/$file" ]] && continue

  content=$(cat "$PROJECT_DIR/$file")

  # API calls without whitelist check
  if echo "$content" | grep -qE 'apiClient\.(get|post|put|delete)\(' && \
     ! echo "$content" | grep -qE 'isPathAllowed\('; then
    WARNINGS+=("$file: API call without isPathAllowed()")
  fi

  # Password comparison without constantTimeCompare
  if echo "$content" | grep -qE 'password\s*===' && \
     ! echo "$content" | grep -qE 'constantTimeCompare\('; then
    WARNINGS+=("$file: password comparison without constantTimeCompare()")
  fi

  # Raw throw in catch without formatApiError
  if echo "$content" | grep -qE 'catch\s*\(' && \
     echo "$content" | grep -qE 'throw\s+error' && \
     ! echo "$content" | grep -qE 'formatApiError\('; then
    WARNINGS+=("$file: raw throw in catch without formatApiError()")
  fi

  # Service files missing whitelist definition
  if [[ "$file" =~ services/[^/]+\.ts$ ]] && \
     ! echo "$content" | grep -qiE '(WHITELIST|whitelist)\s*='; then
    WARNINGS+=("$file: service file missing WHITELIST definition")
  fi
done <<< "$MODIFIED"

# ── 4. Report ────────────────────────────────────────────────────────────────
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo "🚫 BLOCKED:" >&2
  for e in "${ERRORS[@]}"; do echo "  - $e" >&2; done
  exit 2
fi

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo "⚠️  WARN:" >&2
  for w in "${WARNINGS[@]}"; do echo "  - $w" >&2; done
  exit 0
fi

echo "✅ APPROVED: tooling passed, no pattern issues." >&2
exit 0
