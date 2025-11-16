#!/bin/bash
# Format all code with Prettier

echo "💅 Formatting Code..."
echo "===================="

cd "$(dirname "$0")/../.."

cd admin-app
pnpm exec prettier --write "**/*.{ts,tsx,js,jsx,json,css,md}" --ignore-path .gitignore
cd ..

echo "✅ Code formatting complete"
