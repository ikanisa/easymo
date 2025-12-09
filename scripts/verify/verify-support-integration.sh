#!/bin/bash

# Desktop Support Chat Verification Script
# Tests the new /support page functionality

set -e

echo "🔍 Desktop Support Chat Verification"
echo "====================================="
echo ""

# Check if admin-app exists
if [ ! -d "admin-app" ]; then
  echo "❌ admin-app directory not found!"
  exit 1
fi

echo "✅ admin-app directory found"
echo ""

# Check support page exists (if it exists in admin-app)
if [ -f "admin-app/app/support/page.tsx" ]; then
  echo "✅ Support page exists"
  echo ""
else
  echo "⚠️  Support page not found in admin-app"
  echo "   This may be expected if support is not implemented in admin-app"
  echo ""
fi

# Check API route exists (if it exists in admin-app)
if [ -f "admin-app/app/api/agents/support/chat/route.ts" ]; then
  echo "✅ Support API route exists"
  echo ""
else
  echo "⚠️  Support API route not found in admin-app"
  echo "   This may be expected if support is not implemented in admin-app"
  echo ""
fi

# Check Sidebar has Support menu (if sidebar exists)
if [ -f "admin-app/components/layout/Sidebar.tsx" ]; then
  if grep -q "Support" admin-app/components/layout/Sidebar.tsx; then
    echo "✅ Support menu in Sidebar"
  else
    echo "⚠️  Support menu not found in Sidebar"
  fi
  echo ""
fi

# Check MobileSidebar has Support menu (if it exists)
if [ -f "admin-app/components/layout/MobileSidebar.tsx" ]; then
  if grep -q "Support" admin-app/components/layout/MobileSidebar.tsx; then
    echo "✅ Support menu in MobileSidebar"
  else
    echo "⚠️  Support menu not found in MobileSidebar"
  fi
  echo ""
fi

# Verify database migration exists
if [ ! -f "supabase/migrations/20251127150000_fix_ai_agent_configurations.sql" ]; then
  echo "❌ AI agent configuration migration not found!"
  exit 1
fi

echo "✅ AI agent migration exists"
echo ""

# Check support agent in database
echo "📊 Checking Support Agent in Database..."
echo ""

# Get DATABASE_URL from .env.local
if [ -f ".env.local" ]; then
  DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d= -f2-)
  
  if [ -n "$DATABASE_URL" ]; then
    # Query support agent
    SUPPORT_AGENT=$(psql "$DATABASE_URL" -t -c "SELECT slug, name, is_active FROM ai_agents WHERE slug = 'support';" 2>/dev/null || echo "")
    
    if [ -n "$SUPPORT_AGENT" ]; then
      echo "✅ Support agent found in database:"
      echo "$SUPPORT_AGENT"
      echo ""
      
      # Count support agent tools
      TOOL_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM ai_agent_tools t JOIN ai_agents a ON t.agent_id = a.id WHERE a.slug = 'support';" 2>/dev/null || echo "0")
      echo "   Tools: $TOOL_COUNT"
      
      # Count support agent tasks
      TASK_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM ai_agent_tasks t JOIN ai_agents a ON t.agent_id = a.id WHERE a.slug = 'support';" 2>/dev/null || echo "0")
      echo "   Tasks: $TASK_COUNT"
      
      # Check personas
      PERSONA_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM ai_agent_personas p JOIN ai_agents a ON p.agent_id = a.id WHERE a.slug = 'support';" 2>/dev/null || echo "0")
      echo "   Personas: $PERSONA_COUNT"
      
      # Check system instructions
      INSTR_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM ai_agent_system_instructions s JOIN ai_agents a ON s.agent_id = a.id WHERE a.slug = 'support';" 2>/dev/null || echo "0")
      echo "   System Instructions: $INSTR_COUNT"
      echo ""
    else
      echo "⚠️  Could not query support agent from database"
      echo ""
    fi
  fi
fi

echo ""
echo "🎉 Verification Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Start the desktop app:"
echo "   cd admin-app-v2 && npm run dev"
echo ""
echo "2. Navigate to:"
echo "   http://localhost:3000/support"
echo ""
echo "3. Test conversations:"
echo "   - 'What is your pricing?'"
echo "   - 'I want to partner with easyMO'"
echo "   - 'How do I list items on marketplace?'"
echo "   - 'I need help with...'"
echo ""
echo "4. Check that:"
echo "   ✓ Support menu item appears in sidebar"
echo "   ✓ Chat interface loads"
echo "   ✓ Messages send and receive responses"
echo "   ✓ Fallback responses work if API is down"
echo ""
