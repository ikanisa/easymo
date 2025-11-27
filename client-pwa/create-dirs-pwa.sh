#!/usr/bin/env bash
set -e

cd /Users/jeanbosco/workspace/easymo-/client-pwa

# Create app route directories
mkdir -p "app/[venueSlug]/cart"
mkdir -p "app/[venueSlug]/checkout"
mkdir -p "app/[venueSlug]/order/[orderId]"

# Create API route directories
mkdir -p "app/api/venue/[slug]"
mkdir -p "app/api/order/create"
mkdir -p "app/api/order/[orderId]"
mkdir -p "app/api/payment/momo/initiate"
mkdir -p "app/api/payment/revolut/create"
mkdir -p "app/api/payment/revolut/webhook"

echo "✅ Directories created successfully"
