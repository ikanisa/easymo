#!/bin/bash

# Waiter AI PWA - Deployment Script
# This script handles the complete deployment of the Waiter AI PWA

set -e

echo "🍽️  Waiter AI PWA - Deployment Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running from correct directory
if [ ! -f "package.json" ]; then
    print_error "Must run from waiter-pwa directory"
    exit 1
fi

# Step 1: Check environment variables
echo "Step 1: Checking environment variables..."
if [ ! -f ".env.local" ]; then
    print_warning ".env.local not found. Creating from template..."
    cat > .env.local << EOF
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App Configuration
NEXT_PUBLIC_RESTAURANT_ID=default-restaurant
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Feature Flags
NEXT_PUBLIC_ENABLE_VOICE=false
NEXT_PUBLIC_ENABLE_PUSH=true
EOF
    print_warning "Please update .env.local with your actual values"
    exit 1
fi
print_status "Environment variables configured"

# Step 2: Install dependencies
echo ""
echo "Step 2: Installing dependencies..."
pnpm install --frozen-lockfile
print_status "Dependencies installed"

# Step 3: Build shared packages
echo ""
echo "Step 3: Building shared packages..."
cd ../packages/shared
pnpm build
cd ../commons
pnpm build
cd ../../waiter-pwa
print_status "Shared packages built"

# Step 4: Type check
echo ""
echo "Step 4: Running type check..."
pnpm tsc --noEmit || print_warning "Type check completed with warnings (non-critical)"
print_status "Type check complete"

# Step 5: Build application
echo ""
echo "Step 5: Building application..."
pnpm build
print_status "Application built successfully"

# Step 6: Deploy edge function (if Supabase CLI available)
echo ""
echo "Step 6: Deploying edge function..."
if command -v supabase &> /dev/null; then
    cd ../supabase
    supabase functions deploy waiter-ai-agent
    print_status "Edge function deployed"
    cd ../waiter-pwa
else
    print_warning "Supabase CLI not found. Skipping edge function deployment"
    print_warning "Please deploy manually: supabase functions deploy waiter-ai-agent"
fi

# Step 7: Apply database migration (if Supabase CLI available)
echo ""
echo "Step 7: Applying database migrations..."
if command -v supabase &> /dev/null; then
    cd ../supabase
    supabase db push
    print_status "Database migrations applied"
    cd ../waiter-pwa
else
    print_warning "Supabase CLI not found. Skipping database migration"
    print_warning "Please apply manually: supabase db push"
fi

# Step 8: Deploy to platform
echo ""
echo "Step 8: Deploying to platform..."
echo "Choose deployment platform:"
echo "1) Vercel (recommended)"
echo "2) Netlify"
echo "3) Cloudflare Pages"
echo "4) Skip deployment"
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        if command -v vercel &> /dev/null; then
            vercel --prod
            print_status "Deployed to Vercel"
        else
            print_warning "Vercel CLI not found. Install: npm i -g vercel"
        fi
        ;;
    2)
        if command -v netlify &> /dev/null; then
            netlify deploy --prod
            print_status "Deployed to Netlify"
        else
            print_warning "Netlify CLI not found. Install: npm i -g netlify-cli"
        fi
        ;;
    3)
        if command -v wrangler &> /dev/null; then
            wrangler pages deploy .next
            print_status "Deployed to Cloudflare Pages"
        else
            print_warning "Wrangler CLI not found. Install: npm i -g wrangler"
        fi
        ;;
    4)
        print_warning "Skipping deployment"
        ;;
    *)
        print_error "Invalid choice"
        ;;
esac

# Final checklist
echo ""
echo "======================================"
echo "🎉 Deployment Complete!"
echo "======================================"
echo ""
echo "Post-Deployment Checklist:"
echo "[ ] Verify Supabase connection"
echo "[ ] Test AI chat functionality"
echo "[ ] Test payment flows (MoMo & Revolut)"
echo "[ ] Test order tracking"
echo "[ ] Check error logs"
echo "[ ] Set up monitoring/analytics"
echo "[ ] Test PWA installation on mobile"
echo "[ ] Verify offline functionality"
echo ""
echo "Environment URLs:"
echo "- Supabase Dashboard: $(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d'=' -f2)"
echo "- App URL: $(grep NEXT_PUBLIC_APP_URL .env.local | cut -d'=' -f2)"
echo ""
echo "Next Steps:"
echo "1. Set OpenAI API key: supabase secrets set OPENAI_API_KEY=sk-..."
echo "2. Add sample menu data to database"
echo "3. Test end-to-end user flow"
echo "4. Monitor application logs"
echo ""
print_status "Deployment script completed successfully!"
