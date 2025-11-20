#!/bin/bash

# EasyMo AI - Implementation Verification Script
# Checks that all required files and configurations are in place

echo "🔍 EasyMo AI - Implementation Verification"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0

# Check function
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $1"
        ((PASS++))
    else
        echo -e "${RED}❌${NC} $1 - MISSING"
        ((FAIL++))
    fi
}

check_whatsapp_config() {
    if grep -q "561637583695258" "$1"; then
        echo -e "${GREEN}✅${NC} WhatsApp Phone ID configured in $1"
        ((PASS++))
    else
        echo -e "${RED}❌${NC} WhatsApp Phone ID not found in $1"
        ((FAIL++))
    fi
}

echo "📁 Checking Backend Files..."
check_file "backend/app/main.py"
check_file "backend/app/whatsapp.py"
check_file "backend/app/tools.py"
check_file "backend/app/requirements.txt"
check_file "backend/app/Dockerfile"
echo ""

echo "📁 Checking Admin API..."
check_file "backend/admin_api/main.py"
check_file "backend/admin_api/requirements.txt"
check_file "backend/admin_api/Dockerfile"
echo ""

echo "📁 Checking Indexer Service..."
check_file "backend/indexer/main.py"
check_file "backend/indexer/requirements.txt"
check_file "backend/indexer/Dockerfile"
echo ""

echo "📁 Checking Infrastructure..."
check_file "backend/terraform/main.tf"
check_file "backend/scripts/setup_gcp.sh"
echo ""

echo "📁 Checking Configuration..."
check_file "backend/database/firestore_schema.json"
check_file "backend/dialogflow/flow_map.md"
check_file ".env.example"
echo ""

echo "📁 Checking Documentation..."
check_file "README.md"
check_file "DEPLOYMENT_COMMANDS.md"
check_file "IMPLEMENTATION_STATUS.md"
check_file "WHATSAPP_SETUP.md"
check_file "DEEP_REVIEW_SUMMARY.md"
echo ""

echo "🔧 Checking WhatsApp Configuration..."
check_whatsapp_config "backend/app/main.py"
echo ""

echo "🔍 Checking Code Quality..."

# Check for TODO or FIXME
TODO_COUNT=$(grep -r "TODO\|FIXME" backend/ --include="*.py" 2>/dev/null | wc -l)
if [ "$TODO_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅${NC} No TODO/FIXME comments found"
    ((PASS++))
else
    echo -e "${YELLOW}⚠️${NC}  Found $TODO_COUNT TODO/FIXME comments"
fi

# Check Python syntax
echo ""
echo "🐍 Checking Python Syntax..."
for file in backend/app/*.py backend/admin_api/*.py backend/indexer/*.py; do
    if [ -f "$file" ]; then
        if python3 -m py_compile "$file" 2>/dev/null; then
            echo -e "${GREEN}✅${NC} $file - Valid Python"
            ((PASS++))
        else
            echo -e "${RED}❌${NC} $file - Syntax Error"
            ((FAIL++))
        fi
    fi
done

echo ""
echo "=========================================="
echo "📊 Verification Summary"
echo "=========================================="
echo -e "${GREEN}✅ Passed: $PASS${NC}"
echo -e "${RED}❌ Failed: $FAIL${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Repository is ready for deployment.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some checks failed. Please review the issues above.${NC}"
    exit 1
fi
