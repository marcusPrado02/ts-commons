#!/usr/bin/env bash
# validate-all.sh — Build + Test + Lint for the ts-commons monorepo
#
# Runs all three validation phases and prints a per-package status table.
# Exits with code 1 if any phase fails.
#
# Usage:
#   ./scripts/validate-all.sh            # full validation
#   ./scripts/validate-all.sh --no-build # skip build step (faster, requires prior build)
#   ./scripts/validate-all.sh --no-lint  # skip lint step

set -euo pipefail

# ── Parse flags ───────────────────────────────────────────────────────────────
RUN_BUILD=true
RUN_TEST=true
RUN_LINT=true

for arg in "$@"; do
  case "$arg" in
    --no-build) RUN_BUILD=false ;;
    --no-test)  RUN_TEST=false  ;;
    --no-lint)  RUN_LINT=false  ;;
    *) echo "Unknown flag: $arg. Valid flags: --no-build --no-test --no-lint" >&2; exit 1 ;;
  esac
done

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
PASS="${GREEN}PASS${NC}"
FAIL="${RED}FAIL${NC}"
SKIP="${YELLOW}SKIP${NC}"

log_section() { echo -e "\n${BLUE}${BOLD}── $1 ──────────────────────────────────────────────────${NC}"; }

# Track results: associative arrays keyed by phase
declare -A BUILD_STATUS
declare -A TEST_STATUS
declare -A LINT_STATUS

OVERALL=0

# ── Collect package list ──────────────────────────────────────────────────────
PACKAGES=()
while IFS= read -r -d '' dir; do
  pkg=$(basename "$dir")
  PACKAGES+=("$pkg")
done < <(find packages -maxdepth 1 -mindepth 1 -type d -print0 | sort -z)

echo -e "${BOLD}ts-commons monorepo validation${NC}"
echo "Packages found: ${#PACKAGES[@]}"
echo "Phases: build=$RUN_BUILD  test=$RUN_TEST  lint=$RUN_LINT"

# ── Phase 1: Build ────────────────────────────────────────────────────────────
if $RUN_BUILD; then
  log_section "BUILD (pnpm -r run build)"
  for pkg in "${PACKAGES[@]}"; do
    dir="packages/$pkg"
    if [ ! -f "$dir/package.json" ]; then
      BUILD_STATUS[$pkg]="skip"
      continue
    fi
    # Only build packages that have a build script
    if ! grep -q '"build"' "$dir/package.json" 2>/dev/null; then
      BUILD_STATUS[$pkg]="skip"
      continue
    fi
    printf "  %-40s" "@acme/$pkg"
    if NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter "@acme/$pkg" run build >/dev/null 2>&1; then
      echo -e "$PASS"
      BUILD_STATUS[$pkg]="pass"
    else
      echo -e "$FAIL"
      BUILD_STATUS[$pkg]="fail"
      OVERALL=1
    fi
  done
else
  for pkg in "${PACKAGES[@]}"; do BUILD_STATUS[$pkg]="skip"; done
fi

# ── Phase 2: Test ─────────────────────────────────────────────────────────────
if $RUN_TEST; then
  log_section "TEST (vitest run)"
  for pkg in "${PACKAGES[@]}"; do
    dir="packages/$pkg"
    if [ ! -f "$dir/package.json" ]; then
      TEST_STATUS[$pkg]="skip"
      continue
    fi
    if ! grep -q '"test"' "$dir/package.json" 2>/dev/null; then
      TEST_STATUS[$pkg]="skip"
      continue
    fi
    printf "  %-40s" "@acme/$pkg"
    if pnpm --filter "@acme/$pkg" exec vitest run >/dev/null 2>&1; then
      echo -e "$PASS"
      TEST_STATUS[$pkg]="pass"
    else
      echo -e "$FAIL"
      TEST_STATUS[$pkg]="fail"
      OVERALL=1
    fi
  done
else
  for pkg in "${PACKAGES[@]}"; do TEST_STATUS[$pkg]="skip"; done
fi

# ── Phase 3: Lint ─────────────────────────────────────────────────────────────
if $RUN_LINT; then
  log_section "LINT (ESLint + Prettier)"
  printf "  %-40s" "ESLint (all packages)"
  if NODE_OPTIONS=--max-old-space-size=4096 pnpm lint >/dev/null 2>&1; then
    echo -e "$PASS"
    LINT_STATUS["eslint"]="pass"
  else
    echo -e "$FAIL"
    LINT_STATUS["eslint"]="fail"
    OVERALL=1
  fi
  printf "  %-40s" "Prettier format check"
  if pnpm format --check >/dev/null 2>&1; then
    echo -e "$PASS"
    LINT_STATUS["prettier"]="pass"
  else
    echo -e "$FAIL"
    LINT_STATUS["prettier"]="fail"
    OVERALL=1
  fi
else
  LINT_STATUS["eslint"]="skip"
  LINT_STATUS["prettier"]="skip"
fi

# ── Summary table ─────────────────────────────────────────────────────────────
log_section "SUMMARY"
printf "${BOLD}%-40s  %-8s  %-8s  %-8s${NC}\n" "Package" "Build" "Test" "Lint"
printf "%-40s  %-8s  %-8s  %-8s\n" "$(printf '%0.s─' {1..40})" "────────" "────────" "────────"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

for pkg in "${PACKAGES[@]}"; do
  b=${BUILD_STATUS[$pkg]:-skip}
  t=${TEST_STATUS[$pkg]:-skip}
  l=${LINT_STATUS["eslint"]:-skip}

  colorize() {
    case "$1" in
      pass) echo -e "${GREEN}$1${NC}" ;;
      fail) echo -e "${RED}$1${NC}" ;;
      *)    echo -e "${YELLOW}$1${NC}" ;;
    esac
  }

  printf "  %-40s  %-18s  %-18s  %-18s\n" \
    "@acme/$pkg" \
    "$(colorize "$b")" \
    "$(colorize "$t")" \
    "$(colorize "$l")"

  for status in "$b" "$t"; do
    case "$status" in
      pass) ((PASS_COUNT++)) || true ;;
      fail) ((FAIL_COUNT++)) || true ;;
      skip) ((SKIP_COUNT++)) || true ;;
    esac
  done
done

echo ""
echo -e "Totals: ${GREEN}${PASS_COUNT} passed${NC}  ${RED}${FAIL_COUNT} failed${NC}  ${YELLOW}${SKIP_COUNT} skipped${NC}"

if [ $OVERALL -eq 0 ]; then
  echo -e "\n${GREEN}${BOLD}✓ All validations passed.${NC}"
else
  echo -e "\n${RED}${BOLD}✗ One or more validations failed.${NC}"
fi

exit $OVERALL
