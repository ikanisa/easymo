#!/bin/bash
# Verify Kinyarwanda UI Translation Block Implementation

echo "🔍 Verifying Kinyarwanda UI Translation Block..."
echo ""

ERRORS=0

# Check 1: Verify 'rw' removed from SupportedLanguage types
echo "✓ Checking SupportedLanguage type definitions..."
RW_IN_TYPES=$(grep -r "SupportedLanguage.*'rw'" packages/ supabase/functions/ 2>/dev/null || true)
if [ ! -z "$RW_IN_TYPES" ]; then
  echo "  ❌ FAIL: Found 'rw' in SupportedLanguage types:"
  echo "$RW_IN_TYPES"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASS: No 'rw' in SupportedLanguage types"
fi

# Check 2: Verify BLOCKED_UI_LANGUAGES constant exists
echo ""
echo "✓ Checking BLOCKED_UI_LANGUAGES constant..."
BLOCKED_CONST=$(grep -r "BLOCKED_UI_LANGUAGES" supabase/functions/_shared/ 2>/dev/null || true)
if [ -z "$BLOCKED_CONST" ]; then
  echo "  ❌ FAIL: BLOCKED_UI_LANGUAGES constant not found"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASS: BLOCKED_UI_LANGUAGES constant found"
fi

# Check 3: Verify blocking logic in translator
echo ""
echo "✓ Checking translator blocking logic..."
TRANSLATOR_BLOCK=$(grep -A 2 "BLOCKED_UI_LANGUAGES" supabase/functions/_shared/i18n/translator.ts 2>/dev/null || true)
if [ -z "$TRANSLATOR_BLOCK" ]; then
  echo "  ❌ FAIL: Blocking logic not found in translator"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASS: Blocking logic found in translator"
fi

# Check 4: Verify language detection blocks 'rw'
echo ""
echo "✓ Checking language detection blocking..."
DETECT_BLOCK=$(grep -A 2 "BLOCKED_UI_LANGUAGES" supabase/functions/_shared/wa-webhook-shared/i18n/language.ts 2>/dev/null || true)
if [ -z "$DETECT_BLOCK" ]; then
  echo "  ❌ FAIL: Language detection blocking not found"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASS: Language detection blocking found"
fi

# Check 5: Verify README has critical rule
echo ""
echo "✓ Checking README critical rule section..."
README_RULE=$(grep -i "CRITICAL RULE.*KINYARWANDA" README.md 2>/dev/null || true)
if [ -z "$README_RULE" ]; then
  echo "  ❌ FAIL: Critical rule not found in README"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASS: Critical rule found in README"
fi

# Check 6: Verify documentation file exists
echo ""
echo "✓ Checking documentation file..."
if [ ! -f "KINYARWANDA_UI_TRANSLATION_BLOCKED.md" ]; then
  echo "  ❌ FAIL: Documentation file not found"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASS: Documentation file exists"
fi

# Check 7: Verify constants.ts updated
echo ""
echo "✓ Checking constants.ts..."
CONST_RW=$(grep "RW.*\"rw\"" supabase/functions/_shared/config/constants.ts 2>/dev/null || true)
if [ ! -z "$CONST_RW" ]; then
  echo "  ❌ FAIL: 'rw' still in LANGUAGES enum"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASS: 'rw' removed from LANGUAGES enum"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo "✅ ALL CHECKS PASSED"
  echo "   Kinyarwanda UI translation is successfully blocked!"
  exit 0
else
  echo "❌ $ERRORS CHECK(S) FAILED"
  echo "   Review the errors above and fix them."
  exit 1
fi
