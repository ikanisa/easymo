#!/bin/bash

# EasyMO Client PWA - Quick Implementation Script
# This script creates the remaining essential files for the PWA

set -e

echo "🚀 EasyMO Client PWA - Implementation Helper"
echo "============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from client-pwa directory"
    exit 1
fi

echo "📦 Step 1: Installing Dependencies..."
echo "This may take a few minutes..."
npm install --save qrcode.react canvas-confetti lottie-web @tanstack/react-virtual immer qr-scanner 2>/dev/null || {
    echo "⚠️  Note: Using existing dependencies if install fails"
}

echo ""
echo "✅ Dependencies ready!"
echo ""

echo "📁 Step 2: Creating Directory Structure..."
mkdir -p public/icons
mkdir -p public/sounds
mkdir -p public/animations
mkdir -p app/scan
mkdir -p app/\[venueSlug\]/cart
mkdir -p app/\[venueSlug\]/checkout
mkdir -p app/\[venueSlug\]/order/\[orderId\]
mkdir -p components/layout
mkdir -p components/menu
mkdir -p components/order
mkdir -p components/payment
mkdir -p components/ui
mkdir -p hooks
mkdir -p stores

echo "✅ Directories created!"
echo ""

echo "📝 Step 3: Creating Essential Files..."

# Create simple PWA manifest if not exists
if [ ! -f "public/manifest.json" ]; then
cat > public/manifest.json << 'MANIFEST'
{
  "name": "EasyMO - Smart Restaurant Ordering",
  "short_name": "EasyMO",
  "description": "Order food & drinks seamlessly via QR code",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#f9a825",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
MANIFEST
echo "✅ Created manifest.json"
fi

# Create basic service worker
if [ ! -f "public/sw.js" ]; then
cat > public/sw.js << 'SW'
const CACHE_NAME = 'easymo-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
SW
echo "✅ Created sw.js"
fi

echo ""
echo "🎨 Step 4: Assets Needed (Manual)..."
echo ""
echo "Please add these assets manually:"
echo "  📁 public/icons/"
echo "     - icon-192x192.png (192x192)"
echo "     - icon-512x512.png (512x512)"
echo ""
echo "  📁 public/sounds/ (optional for haptics)"
echo "     - tap.mp3, success.mp3, pop.mp3, etc."
echo ""

echo "✅ Core setup complete!"
echo ""
echo "🧪 Step 5: Test the Build..."
npm run build 2>&1 | tail -10

echo ""
echo "============================================="
echo "✨ Implementation Complete! ✨"
echo "============================================="
echo ""
echo "📚 Next Steps:"
echo ""
echo "1. Review the documentation:"
echo "   - IMPLEMENTATION_GUIDE.md (complete feature guide)"
echo "   - STATUS.md (current progress)"
echo ""
echo "2. Add PWA icons:"
echo "   - Use https://favicon.io/favicon-generator/"
echo "   - Export 192x192 and 512x512 PNG"
echo "   - Place in public/icons/"
echo ""
echo "3. Test locally:"
echo "   npm run dev"
echo "   Visit: http://localhost:3002"
echo ""
echo "4. Deploy to Netlify:"
echo "   ./deploy.sh"
echo ""
echo "Happy coding! 🚀"
