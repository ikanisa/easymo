#!/usr/bin/env bash
# Start EasyMO Admin Desktop App
#
# This script manages the Next.js server and Electron app together
# Usage: ./start-desktop.sh [--prod]

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROD_MODE=false
if [[ "${1:-}" == "--prod" ]]; then
    PROD_MODE=true
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  EasyMO Admin Desktop App${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Kill any existing Next.js or Electron processes
pkill -f "next dev" 2>/dev/null || true
pkill -f "electron ." 2>/dev/null || true
sleep 1

# Check dependencies
if [[ ! -d "node_modules" ]]; then
    echo -e "${YELLOW}⚠️  Installing dependencies...${NC}"
    npm ci
    echo ""
fi

# Check .env file
if [[ ! -f ".env" ]]; then
    echo -e "${YELLOW}⚠️  No .env file found${NC}"
    if [[ -f ".env.example" ]]; then
        echo -e "${YELLOW}   Creating from .env.example...${NC}"
        cp .env.example .env
        echo -e "${RED}   ⚠️  Please configure .env before continuing${NC}"
        echo ""
        exit 1
    fi
fi

if [[ "$PROD_MODE" == true ]]; then
    echo -e "${GREEN}📦 Production mode: Building Next.js...${NC}"
    npm run build
    echo ""
    
    echo -e "${GREEN}🚀 Starting production server...${NC}"
    npm run start > /tmp/easymo-next-prod.log 2>&1 &
    NEXT_PID=$!
    LOG_FILE="/tmp/easymo-next-prod.log"
else
    echo -e "${GREEN}🔧 Development mode: Starting Next.js dev server...${NC}"
    echo -e "${YELLOW}   (First start may take 20-30 seconds)${NC}"
    echo ""
    
    # Clear Next.js cache for clean start
    rm -rf .next
    
    # Start Next.js dev server
    NODE_ENV=development npm run dev > /tmp/easymo-next-dev.log 2>&1 &
    NEXT_PID=$!
    LOG_FILE="/tmp/easymo-next-dev.log"
fi

echo -e "${YELLOW}   Next.js PID: $NEXT_PID${NC}"

# Wait for Next.js to be ready
echo -e "${YELLOW}   Waiting for server to be ready...${NC}"
MAX_WAIT=90
WAITED=0

while ! curl -sf http://localhost:3000 > /dev/null 2>&1; do
    sleep 1
    WAITED=$((WAITED + 1))
    
    # Check if process is still running
    if ! kill -0 $NEXT_PID 2>/dev/null; then
        echo -e "${RED}❌ Next.js process died unexpectedly${NC}"
        echo -e "${RED}   Last 20 lines of log:${NC}"
        tail -20 "$LOG_FILE"
        exit 1
    fi
    
    if [[ $WAITED -gt $MAX_WAIT ]]; then
        echo -e "${RED}❌ Server didn't start after ${MAX_WAIT}s${NC}"
        echo -e "${RED}   Check logs: tail -f $LOG_FILE${NC}"
        kill $NEXT_PID 2>/dev/null || true
        exit 1
    fi
    
    # Show progress
    if [[ $((WAITED % 10)) -eq 0 ]]; then
        echo -e "${YELLOW}   Still waiting... (${WAITED}s)${NC}"
    fi
done

echo -e "${GREEN}✅ Next.js server is ready!${NC}"
echo ""

# Give it a moment to settle
sleep 2

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  Shutting down...${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if kill -0 $NEXT_PID 2>/dev/null; then
        echo -e "${YELLOW}   Stopping Next.js server (PID: $NEXT_PID)${NC}"
        kill $NEXT_PID 2>/dev/null || true
        wait $NEXT_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "electron ." 2>/dev/null || true
    
    echo -e "${GREEN}✅ Shutdown complete${NC}"
}

trap cleanup EXIT INT TERM

# Launch Electron
echo -e "${GREEN}🚀 Launching Electron desktop app...${NC}"
echo -e "${YELLOW}   Close the window or press Ctrl+C to exit${NC}"
echo ""

# Set environment
export NODE_ENV=development
export PORT=3000

# Start Electron (blocks until window is closed)
npm run desktop 2>&1 | grep -v "Autofill\|WidgetHost" || true

# Cleanup runs automatically via trap
