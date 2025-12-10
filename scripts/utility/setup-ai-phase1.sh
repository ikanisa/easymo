#!/bin/bash
# AI Architecture Phase 1 - Setup Script
# Run this after reviewing AI_PHASE1_COMPLETE.md

set -e

echo "🚀 EasyMO AI Architecture - Phase 1 Setup"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "admin-app/package.json" ]; then
    echo "❌ Error: Run this script from the easymo root directory"
    exit 1
fi

echo "📦 Step 1: Installing dependencies..."
pnpm install --no-frozen-lockfile

echo ""
echo "✅ Dependencies installed"
echo ""

# Check for environment variables
echo "🔐 Step 2: Checking environment variables..."

if [ ! -f "admin-app/.env.local" ]; then
    echo "⚠️  admin-app/.env.local not found"
    echo "Creating from .env.example..."
    
    if [ -f "admin-app/.env.example" ]; then
        cp admin-app/.env.example admin-app/.env.local
        echo "✅ Created admin-app/.env.local"
    else
        echo "⚠️  No .env.example found. Creating minimal .env.local..."
        cat > admin-app/.env.local << 'EOF'
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_ORG_ID=your-org-id-here

# Google AI Configuration
GOOGLE_AI_API_KEY=your-google-ai-api-key-here

# Feature Flags
ENABLE_GEMINI=true
EOF
        echo "✅ Created admin-app/.env.local"
    fi
fi

echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Edit admin-app/.env.local and add your API keys:"
echo "   - OPENAI_API_KEY=sk-..."
echo "   - GOOGLE_AI_API_KEY=AIza..."
echo ""
echo "2. Get API keys:"
echo "   - OpenAI: https://platform.openai.com/api-keys"
echo "   - Google AI: https://makersuite.google.com/app/apikey"
echo ""
echo "3. Start the dev server:"
echo "   cd admin-app && npm run dev"
echo ""
echo "4. Test the health endpoint:"
echo "   curl http://localhost:3000/api/ai/health"
echo ""
echo "5. Test the chat endpoint:"
echo '   curl -X POST http://localhost:3000/api/ai/chat \'
echo '     -H "Content-Type: application/json" \'
echo '     -d '"'"'{"messages":[{"role":"user","content":"Hello!"}]}'"'"
echo ""
echo "📚 Full documentation: AI_PHASE1_COMPLETE.md"
echo ""
echo "✅ Phase 1 setup complete!"
