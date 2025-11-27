/**
 * View Transitions API Integration
 * Enables native-like page transitions between routes
 */

import { useRouter } from 'next/navigation';
import { useCallback, useTransition } from 'react';

interface ViewTransitionOptions {
  type?: 'slide-left' | 'slide-right' | 'fade' | 'zoom' | 'shared-axis';
}

export function useViewTransition() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string, options: ViewTransitionOptions = {}) => {
      const { type = 'slide-left' } = options;

      // Set transition type for CSS
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.transition = type;
      }

      // Check if View Transitions API is supported
      if (typeof document !== 'undefined' && 'startViewTransition' in document) {
        (document as any).startViewTransition(() => {
          startTransition(() => {
            router.push(href);
          });
        });
      } else {
        // Fallback for unsupported browsers
        startTransition(() => {
          router.push(href);
        });
      }
    },
    [router]
  );

  const back = useCallback((options: ViewTransitionOptions = { type: 'slide-right' }) => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.transition = options.type;
    }

    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as any).startViewTransition(() => {
        startTransition(() => {
          router.back();
        });
      });
    } else {
      router.back();
    }
  }, [router]);

  return { navigate, back, isPending };
}
