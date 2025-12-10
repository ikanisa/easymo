#!/bin/bash

echo "🚀 Starting Ibimina Vendor Portal"
echo "=================================="
echo ""

# Check environment
if [ ! -f "vendor-portal/.env" ]; then
  echo "❌ Error: vendor-portal/.env not found!"
  echo "   Run: cp vendor-portal/.env.example vendor-portal/.env"
  echo "   Then edit with your Supabase credentials"
  exit 1
fi

echo "✅ Environment configured"
echo ""

# Check if we're in the right directory
if [ ! -f "pnpm-workspace.yaml" ]; then
  echo "❌ Error: Run this from easymo root directory"
  exit 1
fi

echo "📦 Building vendor portal dependencies..."
pnpm --filter @easymo/vendor-portal install || exit 1

echo ""
echo "🚀 Starting Vendor Portal..."
echo ""
echo "   URL: http://localhost:3100"
echo "   Routes:"
echo "     - /staff          (Staff dashboard)"
echo "     - /staff/onboarding"
echo "     - /member         (Member portal)"
echo "     - /auth           (Login)"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

pnpm --filter @easymo/vendor-portal dev
