#!/bin/bash

# Make deployment scripts executable
chmod +x /Users/jeanbosco/workspace/easymo-/client-pwa/deploy-now.sh
chmod +x /Users/jeanbosco/workspace/easymo-/client-pwa/push-to-main.sh

echo "✅ Scripts are now executable"
echo ""
echo "To deploy:"
echo "1. cd client-pwa"
echo "2. ./push-to-main.sh  # Push to GitHub"
echo "3. ./deploy-now.sh    # Deploy to Netlify"
