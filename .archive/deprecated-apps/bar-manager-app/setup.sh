#!/bin/bash
# Bar Manager App - Quick Setup Script

echo "🍹 EasyMO Bar Manager - Quick Setup"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "Please run this script from the bar-manager-app directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo ""
    echo "📝 Creating .env.local file..."
    cp .env.example .env.local
    
    echo "⚠️  IMPORTANT: Edit .env.local with your credentials:"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   - GEMINI_API_KEY"
    echo ""
fi

# Success
echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Next steps:"
echo "   1. Edit .env.local with your API keys"
echo "   2. Run: npm run dev"
echo "   3. Open: http://localhost:3001"
echo ""
echo "📖 See README.md for full documentation"
echo ""
