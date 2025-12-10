#!/bin/bash
# Insurance OCR Fix Deployment Script
# Fixes critical issues preventing OCR processing from working

set -e

echo "🔧 Insurance OCR Fix Deployment"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we have the required environment variables
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo -e "${RED}❌ Error: SUPABASE_ACCESS_TOKEN is not set${NC}"
  echo "Please set it with: export SUPABASE_ACCESS_TOKEN='your-token'"
  exit 1
fi

# Project ref (update this to your actual project ref)
PROJECT_REF="${SUPABASE_PROJECT_REF:-rweobwuwzswudbgjpdcc}"

echo "📋 Summary of Fixes Applied:"
echo "----------------------------"
echo "✅ 1. Removed duplicate imports in ocr-processor/index.ts (lines 4, 6)"
echo "✅ 2. Fixed logStructuredEvent syntax error on line 558"
echo ""

echo "🔍 Checking Current Secrets..."
echo "-------------------------------"
supabase secrets list --project-ref "$PROJECT_REF" | grep -E "OPENAI|GEMINI" || echo "No OCR provider keys found"
echo ""

echo "⚠️  CRITICAL: OCR Provider API Keys Required"
echo "--------------------------------------------"
echo "The insurance-ocr function requires at least ONE of these API keys:"
echo "  • OPENAI_API_KEY - for OpenAI GPT-4o-mini Vision API"
echo "  • GEMINI_API_KEY - for Google Gemini Vision API"
echo ""
echo "Without these keys, OCR processing will fail with 'no_ocr_provider' error."
echo ""

read -p "Do you have the required API keys to set now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "Setting API Keys..."
  echo "-------------------"
  
  read -p "Enter OPENAI_API_KEY (or press Enter to skip): " openai_key
  if [ -n "$openai_key" ]; then
    echo "Setting OPENAI_API_KEY..."
    supabase secrets set OPENAI_API_KEY="$openai_key" --project-ref "$PROJECT_REF"
    echo -e "${GREEN}✅ OPENAI_API_KEY set${NC}"
  fi
  
  read -p "Enter GEMINI_API_KEY (or press Enter to skip): " gemini_key
  if [ -n "$gemini_key" ]; then
    echo "Setting GEMINI_API_KEY..."
    supabase secrets set GEMINI_API_KEY="$gemini_key" --project-ref "$PROJECT_REF"
    echo -e "${GREEN}✅ GEMINI_API_KEY set${NC}"
  fi
  
  if [ -z "$openai_key" ] && [ -z "$gemini_key" ]; then
    echo -e "${YELLOW}⚠️  No API keys were set. OCR will not work without them.${NC}"
  fi
fi

echo ""
echo "🚀 Deploying Fixed Functions..."
echo "--------------------------------"

# Deploy ocr-processor with fixes
echo "Deploying ocr-processor..."
supabase functions deploy ocr-processor --no-verify-jwt --project-ref "$PROJECT_REF"
echo -e "${GREEN}✅ ocr-processor deployed${NC}"

# Deploy insurance-ocr 
echo "Deploying insurance-ocr..."
supabase functions deploy insurance-ocr --no-verify-jwt --project-ref "$PROJECT_REF"
echo -e "${GREEN}✅ insurance-ocr deployed${NC}"

# Optional: Deploy wa-webhook-insurance if changes were made
read -p "Deploy wa-webhook-insurance as well? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Deploying wa-webhook-insurance..."
  supabase functions deploy wa-webhook-insurance --no-verify-jwt --project-ref "$PROJECT_REF"
  echo -e "${GREEN}✅ wa-webhook-insurance deployed${NC}"
fi

echo ""
echo "🧪 Testing Deployment..."
echo "------------------------"
echo "Checking function logs for errors..."
supabase functions logs insurance-ocr --project-ref "$PROJECT_REF" --limit 10

echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "📝 Next Steps:"
echo "-------------"
echo "1. Test via WhatsApp: Send an insurance certificate image to your bot"
echo "2. Check logs: supabase functions logs insurance-ocr --tail"
echo "3. Expected success log: {\"event\": \"INS_OCR_OK\", \"leadId\": \"...\"}"
echo ""
echo "4. If you see INS_INLINE_OCR_FAIL:"
echo "   - Verify API keys are set: supabase secrets list"
echo "   - Check circuit breaker hasn't tripped (wait 60s after 5 failures)"
echo "   - View detailed logs: supabase functions logs insurance-ocr --tail"
echo ""
echo "📚 Documentation:"
echo "   - OCR_PROCESSOR_KNOWN_ISSUE.md - Known issues and fixes"
echo "   - Issue #455 - Missing OCR provider API keys"
echo ""
