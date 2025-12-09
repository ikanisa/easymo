#!/bin/bash
# Quick Start Script for Dev Server
# This script ensures all prerequisites are met before starting

set -e

echo "🚀 Ibimina Staff Admin - Dev Server Startup"
echo "==========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the correct directory"
    echo "   Please run from: apps/pwa/staff-admin"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js version must be >= 18"
    echo "   Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed"
    echo "   Install with: npm install -g pnpm@10.19.0"
    exit 1
fi

echo "✅ pnpm version: $(pnpm -v)"

# Check if postcss is installed
if [ ! -d "node_modules/postcss" ]; then
    echo "⚠️  PostCSS not found in node_modules"
    echo "   Installing dependencies..."
    pnpm install
fi

echo "✅ PostCSS installed"

# Check if instrumentation.ts exists (it shouldn't for dev)
if [ -f "instrumentation.ts" ]; then
    echo "⚠️  Found instrumentation.ts - renaming for dev mode"
    mv instrumentation.ts instrumentation.ts.prod
fi

echo "✅ Instrumentation disabled for dev"

# Check for .env.local
if [ ! -f "../../../.env.local" ] && [ ! -f ".env.local" ]; then
    echo "⚠️  Warning: No .env.local found"
    echo "   The server may fail without proper environment variables"
fi

# Unset NODE_ENV if it's set to avoid conflicts
if [ -n "$NODE_ENV" ]; then
    echo "⚠️  Unsetting global NODE_ENV (was: $NODE_ENV)"
    unset NODE_ENV
fi

# Clean previous build if requested
if [ "$1" == "--clean" ] || [ "$1" == "-c" ]; then
    echo "🧹 Cleaning .next directory..."
    rm -rf .next
fi

echo ""
echo "✅ All checks passed!"
echo ""
echo "Starting dev server..."
echo "📍 http://localhost:3100"
echo ""

# Start the dev server
pnpm dev
