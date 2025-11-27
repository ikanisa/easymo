#!/bin/sh
cd /Users/jeanbosco/workspace/easymo-/client-pwa
mkdir -p "app/api/venue/[slug]/menu"
mkdir -p "app/api/order/create"
mkdir -p "app/api/order/[orderId]"
mkdir -p "app/api/payment/momo/initiate"
mkdir -p "app/api/payment/revolut/create"
mkdir -p "app/api/payment/revolut/webhook"
mkdir -p "app/[venueSlug]/cart"
mkdir -p "app/[venueSlug]/checkout"
mkdir -p "app/[venueSlug]/order/[orderId]"
echo "Directories created successfully"
