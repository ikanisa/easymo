'use client';

import { useState, useEffect } from 'react';
import { getAppVersion, getPlatformInfo, type PlatformInfo } from '@/lib/platform';

export default function AboutPage() {
  const [version, setVersion] = useState('1.0.0');
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>({
    platform: 'web',
    arch: 'unknown',
    version: 'web',
  });

  useEffect(() => {
    async function loadInfo() {
      try {
        const [ver, plat] = await Promise.all([
          getAppVersion(),
          getPlatformInfo(),
        ]);
        setVersion(ver);
        setPlatformInfo(plat);
      } catch (error) {
        console.error('Failed to load app info:', error);
      }
    }
    loadInfo();
  }, []);

  return (
    <div className="container max-w-2xl py-8">
      <div className="rounded-lg border bg-card p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="h-24 w-24 rounded-lg bg-primary/10 flex items-center justify-center">
            <svg
              className="h-16 w-16 text-primary"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2">EasyMO Admin</h1>
        <p className="text-center text-muted-foreground mb-8">
          WhatsApp Mobility Platform Administration
        </p>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Version</span>
            <span className="text-sm text-muted-foreground">{version}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Platform</span>
            <span className="text-sm text-muted-foreground capitalize">{platformInfo.platform}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Architecture</span>
            <span className="text-sm text-muted-foreground">{platformInfo.arch}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">Copyright</span>
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} EasyMO Platform</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium">License</span>
            <span className="text-sm text-muted-foreground">MIT</span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t">
          <h3 className="text-sm font-medium mb-3">Features</h3>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            {[
              'System Tray',
              'Global Shortcuts',
              'Native Menus',
              'Notifications',
              'Multi-Window',
              'Auto-Update',
            ].map((feature) => (
              <li key={feature} className="flex items-center">
                <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 pt-6 border-t text-center">
          <p className="text-xs text-muted-foreground">
            Built with Tauri 2.0 + Next.js 15
          </p>
        </div>
      </div>
    </div>
  );
}
