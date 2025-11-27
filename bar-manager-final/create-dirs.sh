#!/bin/bash

# Create all missing directories for Bar Manager Desktop App

cd /Users/jeanbosco/workspace/easymo-/bar-manager-final

# Create directory structure
mkdir -p "app/orders/[id]"
mkdir -p "app/menu/[id]/edit"
mkdir -p "app/promos/new"

echo "✅ Created all directories:"
echo "  - app/orders/[id]"
echo "  - app/menu/[id]/edit"
echo "  - app/promos/new"
