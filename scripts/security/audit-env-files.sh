#!/bin/bash
set -euo pipefail

echo "🔐 Auditing environment files for security issues..."

ERRORS=0
WARNINGS=0

# Check .env.example for real secrets
check_for_secrets() {
  local file="$1"
  
  # Patterns that might indicate real secrets
  SECRET_PATTERNS=(
    'sk-[a-zA-Z0-9]{48}'  # OpenAI API key
    'eyJ[a-zA-Z0-9_-]{100,}'  # JWT tokens (real ones are long)
    'xoxb-[0-9]{10,}'  # Slack tokens
    'ghp_[a-zA-Z0-9]{36}'  # GitHub tokens
    'AKIA[A-Z0-9]{16}'  # AWS access keys
  )
  
  for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -qE "$pattern" "$file" 2>/dev/null; then
      echo "❌ CRITICAL: Potential real secret found in $file matching pattern: $pattern"
      ERRORS=$((ERRORS + 1))
    fi
  done
}

# Check for NEXT_PUBLIC_ or VITE_ with sensitive names
check_client_exposure() {
  local file="$1"
  
  SENSITIVE_NAMES=(
    "SERVICE_ROLE"
    "SECRET"
    "PRIVATE"
  )
  
  for name in "${SENSITIVE_NAMES[@]}"; do
    if grep -qE "^(NEXT_PUBLIC_|VITE_).*${name}" "$file" 2>/dev/null; then
      MATCH=$(grep -E "^(NEXT_PUBLIC_|VITE_).*${name}" "$file")
      echo "❌ CRITICAL: Sensitive variable exposed to client in $file:"
      echo "   $MATCH"
      ERRORS=$((ERRORS + 1))
    fi
  done
}

# Check .env files
ENV_FILES=(.env.example .env.local .env.development .env.production .env)

for file in "${ENV_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "📄 Checking $file..."
    check_for_secrets "$file"
    check_client_exposure "$file"
  fi
done

# Check if .env.local is in .gitignore
if [ -f ".gitignore" ]; then
  if ! grep -q "^\.env\.local$" .gitignore; then
    echo "⚠️  WARNING: .env.local not found in .gitignore"
    WARNINGS=$((WARNINGS + 1))
  fi
  if ! grep -q "^\.env$" .gitignore; then
    echo "⚠️  WARNING: .env not found in .gitignore"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

echo ""
echo "=========================================="
if [ $ERRORS -gt 0 ]; then
  echo "❌ Audit FAILED: $ERRORS critical issues, $WARNINGS warnings"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo "⚠️  Audit passed with $WARNINGS warnings"
  exit 0
else
  echo "✅ Audit PASSED: No security issues found"
  exit 0
fi
