import type { Metadata, Viewport } from 'next';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PWAInstallPrompt } from '@/components/layout/PWAInstallPrompt';
import './globals.css';
import './view-transitions.css';

export const metadata: Metadata = {
  title: 'EasyMO Client Portal',
  description: 'Scan, browse, order, and pay at your favorite bars and restaurants',
  manifest: '/manifest.webmanifest',
  applicationName: 'EasyMO',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'EasyMO',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0ea5e9',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="EasyMO" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <ErrorBoundary>
          {children}
          <PWAInstallPrompt />
        </ErrorBoundary>
      </body>
    </html>
  );
}
