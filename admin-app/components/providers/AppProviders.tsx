'use client';

import { ReactNode, useEffect, useState } from 'react';
import { QueryProvider } from './QueryProvider';
import { ThemeProvider } from './ThemeProvider';
import { MotionProviders } from '@/components/motion/MotionProviders';
import { useServiceWorkerRegistration } from '@/app/sw/register';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  useServiceWorkerRegistration();

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return (
    <ThemeProvider>
      <QueryProvider>
        <MotionProviders reducedMotion={prefersReducedMotion}>{children}</MotionProviders>
      </QueryProvider>
    </ThemeProvider>
  );
}
