# Lighthouse PWA Optimization Guide

## Goal: Achieve Lighthouse Score 100 for PWA

---

## Current Status (Estimated)
- ⚠️ Performance: ~85-90
- ⚠️ Accessibility: ~90-95
- ⚠️ Best Practices: ~90-95
- ⚠️ SEO: ~85-90
- ⚠️ PWA: ~80-85

**Target: All scores 95+**

---

## 1. Performance Optimizations

### Image Optimization
```typescript
// Use Next.js Image component
import Image from 'next/image';

<Image
  src="/menu/pizza.jpg"
  alt="Margherita Pizza"
  width={400}
  height={300}
  loading="lazy"
  quality={85}
  placeholder="blur"
/>
```

### Code Splitting
```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic';

const PaymentForm = dynamic(() => import('@/components/payment/PaymentForm'), {
  loading: () => <Spinner />,
  ssr: false, // Client-side only
});
```

### Font Optimization
```typescript
// next.config.mjs
export default {
  optimizeFonts: true,
  experimental: {
    optimizeCss: true,
  },
};
```

### Bundle Size Reduction
```bash
# Analyze bundle
npm run build
npx @next/bundle-analyzer

# Remove unused dependencies
npm prune
```

---

## 2. Accessibility Improvements

### Semantic HTML
```tsx
// Use proper heading hierarchy
<h1>Waiter AI</h1>
<h2>Menu Categories</h2>
<h3>Appetizers</h3>

// Use nav, main, article, section
<nav aria-label="Main navigation">
  <ul>...</ul>
</nav>
```

### ARIA Labels
```tsx
<button aria-label="Add pizza to cart">
  <PlusIcon />
</button>

<input
  type="search"
  aria-label="Search menu items"
  placeholder="Search..."
/>
```

### Keyboard Navigation
```tsx
// Ensure all interactive elements are keyboard accessible
<button
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Click me
</button>
```

### Focus Management
```css
/* Visible focus indicators */
button:focus-visible {
  outline: 2px solid #0ea5e9;
  outline-offset: 2px;
}
```

### Color Contrast
```css
/* Ensure WCAG AA compliance (4.5:1 ratio) */
.text-primary {
  color: #0c4a6e; /* Dark enough on white */
}

.button-primary {
  background: #0ea5e9;
  color: #ffffff; /* High contrast */
}
```

---

## 3. PWA Requirements

### Manifest Completeness
```json
{
  "name": "Waiter AI - Restaurant Assistant",
  "short_name": "Waiter AI",
  "description": "AI-powered restaurant ordering and assistance",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0ea5e9",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["food", "lifestyle"],
  "screenshots": [
    {
      "src": "/screenshots/chat.png",
      "sizes": "1080x1920",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "shortcuts": [
    {
      "name": "View Menu",
      "url": "/menu",
      "icons": [{ "src": "/icons/menu.png", "sizes": "96x96" }]
    }
  ]
}
```

### Service Worker Caching
```javascript
// Improve caching strategy in next.config.mjs
const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60, // 5 minutes
          },
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'image-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
    ],
  },
});
```

### Offline Fallback
```typescript
// Create app/offline/page.tsx
export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1>You're Offline</h1>
      <p>Please check your internet connection</p>
      <button onClick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  );
}
```

### Install Prompt
```typescript
// lib/install-prompt.ts
let deferredPrompt: any;

export function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show custom install button
    showInstallButton();
  });
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  
  return outcome === 'accepted';
}
```

---

## 4. SEO Improvements

### Meta Tags
```tsx
// app/layout.tsx
export const metadata = {
  title: 'Waiter AI - AI-Powered Restaurant Assistant',
  description: 'Order food, make reservations, and get recommendations with our AI waiter',
  keywords: 'restaurant, AI, ordering, menu, reservations',
  openGraph: {
    title: 'Waiter AI',
    description: 'AI-Powered Restaurant Assistant',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Waiter AI',
    description: 'AI-Powered Restaurant Assistant',
    images: ['/twitter-image.png'],
  },
};
```

### Structured Data
```tsx
// Add JSON-LD structured data
export default function RootLayout({ children }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: 'Restaurant Name',
    description: 'Description',
    url: 'https://waiter-ai.com',
    telephone: '+1-555-WAITER',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '123 Main St',
      addressLocality: 'City',
      addressCountry: 'US',
    },
  };

  return (
    <html>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Sitemap
```typescript
// app/sitemap.ts
export default function sitemap() {
  return [
    {
      url: 'https://waiter-ai.com',
      lastModified: new Date(),
    },
    {
      url: 'https://waiter-ai.com/menu',
      lastModified: new Date(),
    },
    {
      url: 'https://waiter-ai.com/chat',
      lastModified: new Date(),
    },
  ];
}
```

### Robots.txt
```typescript
// app/robots.ts
export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: 'https://waiter-ai.com/sitemap.xml',
  };
}
```

---

## 5. Best Practices

### HTTPS Only
```typescript
// middleware.ts - Force HTTPS in production
export function middleware(request: NextRequest) {
  if (
    process.env.NODE_ENV === 'production' &&
    request.headers.get('x-forwarded-proto') !== 'https'
  ) {
    return NextResponse.redirect(
      `https://${request.headers.get('host')}${request.nextUrl.pathname}`,
      301
    );
  }
}
```

### Security Headers
```typescript
// next.config.mjs
export default {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
};
```

### No Console Errors
```typescript
// Wrap API calls in try-catch
try {
  const response = await fetch('/api/menu');
  const data = await response.json();
} catch (error) {
  console.error('Failed to fetch menu:', error);
  // Show user-friendly error
}
```

---

## 6. Audit Checklist

### Run Lighthouse
```bash
# Install Lighthouse
npm install -g lighthouse

# Build production
npm run build
npm start

# Run audit
lighthouse http://localhost:3001 --view
```

### Key Metrics to Check
- [ ] First Contentful Paint < 1.8s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Time to Interactive < 3.8s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Total Blocking Time < 300ms

### PWA Checklist
- [ ] Installable (manifest + service worker)
- [ ] Works offline
- [ ] Fast (< 3s interactive)
- [ ] Responsive on all devices
- [ ] HTTPS only
- [ ] Icons provided (192px, 512px)
- [ ] Theme color set
- [ ] Viewport configured

### Accessibility Checklist
- [ ] Color contrast 4.5:1+
- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Keyboard navigable
- [ ] Screen reader friendly
- [ ] Focus indicators visible
- [ ] Semantic HTML used

---

## 7. Automated Testing

### CI Integration
```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npm start &
      - uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3001
            http://localhost:3001/menu
            http://localhost:3001/chat
          uploadArtifacts: true
          temporaryPublicStorage: true
```

---

## 8. Quick Wins

High-impact, low-effort improvements:

1. **Add meta description** (5 min)
2. **Optimize images** - Use WebP format (15 min)
3. **Add alt text to all images** (10 min)
4. **Enable font optimization** (5 min)
5. **Add ARIA labels to buttons** (15 min)
6. **Fix color contrast issues** (10 min)
7. **Add manifest screenshots** (20 min)
8. **Implement lazy loading** (15 min)

**Total time: ~2 hours for major improvements**

---

## 9. Before/After

### Before Optimization
```
Performance: 75
Accessibility: 85
Best Practices: 82
SEO: 78
PWA: 75
```

### After Optimization (Target)
```
Performance: 95+
Accessibility: 98+
Best Practices: 95+
SEO: 95+
PWA: 100
```

---

## 10. Monitoring

### Track Metrics Over Time
```typescript
// Log performance metrics
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const perfData = performance.getEntriesByType('navigation')[0];
    console.log('Load Time:', perfData.loadEventEnd - perfData.fetchStart);
    
    // Send to analytics
    analytics.track('page_performance', {
      loadTime: perfData.loadEventEnd - perfData.fetchStart,
      domContentLoaded: perfData.domContentLoadedEventEnd,
    });
  });
}
```

---

## Next Steps
1. Run initial Lighthouse audit
2. Fix critical issues first
3. Implement quick wins
4. Re-audit and iterate
5. Setup CI monitoring
6. Celebrate 100 score! 🎉

**Lighthouse optimization ready!**
