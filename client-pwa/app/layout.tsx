import type { Metadata, Viewport } from 'next';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PWAInstallPrompt } from '@/components/layout/PWAInstallPrompt';
import './globals.css';

export const metadata: Metadata = {
  title: 'EasyMO - Order Food & Drinks',
  description: 'Scan, browse, order, and pay at your favorite bars and restaurants',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'EasyMO',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#f9a825',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          {children}
          <PWAInstallPrompt />
        </ErrorBoundary>
      </body>
    </html>
  );
}
