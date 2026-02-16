#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# security-scan.sh — Scan a git repo for common web3/fullstack security issues
# Usage: ./security-scan.sh [path-to-repo]
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

REPO="${1:-.}"
cd "$REPO"

RED='\033[0;31m'; YEL='\033[0;33m'; GRN='\033[0;32m'; DIM='\033[2m'; RST='\033[0m'
ISSUES=0; WARNINGS=0

header() { printf "\n${YEL}━━━ %s ━━━${RST}\n" "$1"; }
fail()   { printf "  ${RED}✗${RST} %s\n" "$1"; ((ISSUES++)); }
warn()   { printf "  ${YEL}!${RST} %s\n" "$1"; ((WARNINGS++)); }
pass()   { printf "  ${GRN}✓${RST} %s\n" "$1"; }
indent() { sed 's/^/    /'; }

SRC_INCLUDES="--include=*.ts --include=*.tsx --include=*.js --include=*.jsx --include=*.sh --include=*.py"
SRC_EXCLUDES="--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=artifacts --exclude-dir=dist --exclude-dir=build"

printf "${YEL}🔒 Security Scan${RST} — %s\n" "$(basename "$(pwd)")"
printf "${DIM}%s${RST}\n" "$(date -u '+%Y-%m-%d %H:%M UTC')"

# ─── 1. Private keys in working tree ─────────────────────────────────────────
header "Private keys in working tree"
RESULT=$(grep -rnE $SRC_INCLUDES $SRC_EXCLUDES \
  "private.?key.*[=:].*['\"]?0x[a-fA-F0-9]{64}" . 2>/dev/null \
  | grep -v "process\.env\|env\.\|getenv\|\.example\|REMOVED\|placeholder" \
  | sed -E 's/(0x[a-fA-F0-9]{6})[a-fA-F0-9]{52}([a-fA-F0-9]{6})/\1…\2/g' \
  | head -10 || true)
[ -n "$RESULT" ] && { fail "Embedded private keys found:"; echo "$RESULT" | indent; } || pass "No embedded private keys"

# ─── 2. Private keys in git history ──────────────────────────────────────────
header "Private keys in git history"
if git rev-parse --git-dir &>/dev/null; then
  RESULT=$(git log --all -p -- '*.ts' '*.tsx' '*.js' '*.sh' '*.py' '*.sol' '*.env*' 2>/dev/null \
    | grep -E "^\+" \
    | grep -iE "private.?key.*[=:].*['\"]?(0x)?[a-fA-F0-9]{64}" \
    | grep -v "process\.env\|env\.\|getenv\|\.example" \
    | sed -E 's/(0x[a-fA-F0-9]{6})[a-fA-F0-9]{52}([a-fA-F0-9]{6})/\1…\2/g' \
    | head -10 || true)
  if [ -n "$RESULT" ]; then
    fail "Keys in git history (persist even after deletion!):"
    echo "$RESULT" | indent
    warn "Scrub with 'git filter-repo --replace-text'. Rotate keys regardless."
  else
    pass "No private keys in history"
  fi
else
  warn "Not a git repo — skipping"
fi

# ─── 3. .env files committed ─────────────────────────────────────────────────
header "Committed .env files"
if git rev-parse --git-dir &>/dev/null; then
  RESULT=$(git ls-files | grep -E '\.env$|\.env\.local$|\.env\.production$|\.env\.development$' || true)
  [ -n "$RESULT" ] && { fail "Env files in git:"; echo "$RESULT" | indent; } || pass "No .env files committed"
  [ -f .gitignore ] && grep -q '\.env' .gitignore && pass ".gitignore covers .env" || warn "No .env in .gitignore"
fi

# ─── 4. API keys & secrets in source ─────────────────────────────────────────
header "API keys & secrets in source"
FOUND=0
check_pattern() {
  local label="$1" pattern="$2"
  local hits
  hits=$(grep -rn $SRC_INCLUDES $SRC_EXCLUDES --exclude='*.lock' --exclude='*.example' \
    -E "$pattern" . 2>/dev/null \
    | grep -v "process\.env\|env\.\|getenv\|example\|mock\|placeholder" \
    | head -5 || true)
  if [ -n "$hits" ]; then
    fail "$label"
    echo "$hits" | indent
    FOUND=1
  fi
}
check_pattern "OpenAI key"       "sk-[a-zA-Z0-9]{20,}"
check_pattern "Anthropic key"    "sk-ant-[a-zA-Z0-9-]{20,}"
check_pattern "Google key"       "AIza[a-zA-Z0-9_-]{35}"
check_pattern "GitHub PAT"       "ghp_[a-zA-Z0-9]{36}"
check_pattern "AWS Access Key"   "AKIA[A-Z0-9]{16}"
check_pattern "Slack token"      "xox[baprs]-[a-zA-Z0-9-]+"
check_pattern "MongoDB URI"      "mongodb(\+srv)?://[^@]+@"
[ $FOUND -eq 0 ] && pass "No API keys in source"

# ─── 5. JWT / Auth weaknesses ────────────────────────────────────────────────
header "Auth configuration"

RESULT=$(grep -rn --include='*.ts' --include='*.js' $SRC_EXCLUDES \
  -E "JWT_SECRET.*=.*['\"][a-zA-Z0-9_-]{5,}['\"]" . 2>/dev/null \
  | grep -v "process\.env\|env\.\|example\|test\|\.d\.ts" | head -5 || true)
[ -n "$RESULT" ] && { fail "Hardcoded JWT secrets:"; echo "$RESULT" | indent; } || pass "No hardcoded JWT secrets"

FALLBACK=$(timeout 10 grep -rn --include='*.ts' --include='*.js' \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next \
  -E '(JWT|SECRET|PRIVATE_KEY).+(\|\||\?\?)' . 2>/dev/null \
  | grep -v 'example\|test\|\.d\.ts' | head -5) || true
if [ -n "$FALLBACK" ]; then
  warn "Fallback secrets (prefer throwing):"
  while IFS= read -r line; do echo "    $line"; done <<< "$FALLBACK"
fi

# ─── 6. Unprotected API routes ───────────────────────────────────────────────
header "API route auth coverage"
API_DIR=""
[ -d "src/app/api" ] && API_DIR="src/app/api"
[ -d "app/api" ] && API_DIR="app/api"
[ -d "pages/api" ] && API_DIR="pages/api"

if [ -n "$API_DIR" ]; then
  TOTAL=0; UNPROTECTED=""
  for file in $(find "$API_DIR" \( -name 'route.ts' -o -name 'route.js' \) | sort); do
    if grep -qE "export.*(POST|PUT|PATCH|DELETE)" "$file" 2>/dev/null; then
      ((TOTAL++))
      if ! grep -qE "getServerSession|getSession|auth\(|verify.*token|requireAuth|getAuth|jwt\.verify|agentAuth|x-agent-secret|NextAuth|cookies" "$file" 2>/dev/null; then
        UNPROTECTED="$UNPROTECTED\n    $file"
      fi
    fi
  done
  if [ -n "$UNPROTECTED" ]; then
    fail "Mutating routes without auth:"
    printf "$UNPROTECTED\n"
  elif [ $TOTAL -gt 0 ]; then
    pass "All $TOTAL mutating routes have auth"
  else
    pass "No mutating API routes found"
  fi
else
  warn "No API routes directory"
fi

# ─── 7. Address spoofing risk ────────────────────────────────────────────────
header "Address spoofing risk"
if [ -n "$API_DIR" ]; then
  RESULT=$(grep -rn --include='*.ts' --include='*.js' \
    -E "body\.(address|wallet|sender|from)" "$API_DIR" 2>/dev/null \
    | grep -v "session\|match\|===\|!=" | head -5 || true)
  [ -n "$RESULT" ] && { warn "Address from body without verification:"; echo "$RESULT" | indent; } || pass "No obvious spoofing vectors"
fi

# ─── 8. Token leakage in responses ───────────────────────────────────────────
header "Token leakage in responses"
RESULT=$(grep -rn --include='*.ts' --include='*.js' $SRC_EXCLUDES \
  -E "json\(\s*\{[^}]*(token|jwt|secret|password|private)" . 2>/dev/null \
  | grep -v "test\|example\|\.d\.ts\|error\|invalid\|missing" | head -5 || true)
[ -n "$RESULT" ] && { warn "Possible secrets in responses:"; echo "$RESULT" | indent; } || pass "No credential leakage"

# ─── 9. Dependency audit ─────────────────────────────────────────────────────
header "Dependency audit"
if [ -f "package.json" ] && command -v npm &>/dev/null; then
  TMPAUDIT=$(mktemp)
  if timeout 20 npm audit --json > "$TMPAUDIT" 2>/dev/null; then
    :
  fi
  if [ -s "$TMPAUDIT" ]; then
    VULN=$(node -e "
      const d=JSON.parse(require('fs').readFileSync('$TMPAUDIT','utf8'));
      const v=d.metadata?.vulnerabilities||{};
      console.log((v.critical||0)+':'+(v.high||0)+':'+(v.moderate||0));
    " 2>/dev/null || echo "skip")
    if [ "$VULN" != "skip" ]; then
      IFS=: read -r crit high mod <<< "$VULN"
      if [ "${crit:-0}" -gt 0 ] || [ "${high:-0}" -gt 0 ]; then
        fail "npm: $crit critical, $high high, $mod moderate"
      elif [ "${mod:-0}" -gt 0 ]; then
        warn "npm: $mod moderate vulnerabilities"
      else
        pass "npm audit clean"
      fi
    else
      warn "npm audit parse failed"
    fi
  else
    warn "npm audit timed out or unavailable"
  fi
  rm -f "$TMPAUDIT"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
printf "\n${YEL}━━━ Summary ━━━${RST}\n"
if [ $ISSUES -gt 0 ]; then
  printf "  ${RED}✗ %d issue(s)${RST} | ${YEL}%d warning(s)${RST}\n\n" $ISSUES $WARNINGS
  printf "  ${DIM}Fix issues before deploying. Rotate any exposed keys.${RST}\n"
  exit 1
else
  printf "  ${GRN}✓ No critical issues${RST} | ${YEL}%d warning(s)${RST}\n" $WARNINGS
  exit 0
fi
