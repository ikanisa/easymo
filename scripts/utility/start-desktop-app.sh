#!/usr/bin/env bash
# Quick Start Desktop App
# Automatically starts Next.js server and Electron app

set -euo pipefail

cd "$(dirname "$0")/admin-app"

echo "🚀 Starting EasyMO Desktop App..."
echo ""

# Check if port 3000 is in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 3000 is already in use. Killing existing process..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Start Next.js in background
echo "📦 Starting Next.js dev server on port 3000..."
NODE_ENV=development PORT=3000 npm run dev > /tmp/easymo-nextjs.log 2>&1 &
NEXTJS_PID=$!

# Wait for Next.js to be ready
echo "⏳ Waiting for Next.js server to be ready..."
max_attempts=30
attempt=0
while ! curl -s http://localhost:3000 > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -gt $max_attempts ]; then
        echo "❌ Next.js server failed to start after 30 seconds"
        echo "📄 Check logs: tail -f /tmp/easymo-nextjs.log"
        kill $NEXTJS_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
    echo -n "."
done

echo ""
echo "✅ Next.js server is ready!"
echo ""

# Start Electron
echo "🖥️  Launching Electron desktop app..."
NODE_ENV=development PORT=3000 npm run desktop

# Cleanup on exit
echo ""
echo "🛑 Cleaning up..."
kill $NEXTJS_PID 2>/dev/null || true
echo "✅ Done!"
