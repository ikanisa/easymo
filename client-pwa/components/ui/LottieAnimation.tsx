'use client';

import { useRef, useEffect, memo } from 'react';

interface LottieAnimationProps {
  animationData: object;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  onComplete?: () => void;
}

export const LottieAnimation = memo(function LottieAnimation({
  animationData,
  loop = true,
  autoplay = true,
  className,
  onComplete,
}: LottieAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<any | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Lazy load lottie-web only when needed
    import('lottie-web').then((lottie) => {
      if (!containerRef.current) return;

      animationRef.current = lottie.default.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop,
        autoplay,
        animationData,
      });

      if (onComplete) {
        animationRef.current.addEventListener('complete', onComplete);
      }
    });

    return () => {
      animationRef.current?.destroy();
    };
  }, [animationData, loop, autoplay, onComplete]);

  return <div ref={containerRef} className={className} />;
});

// Simple fallback loading spinner
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={`animate-spin rounded-full border-4 border-primary border-t-transparent ${className || 'w-12 h-12'}`} />
  );
}

// Success animation fallback
export function SuccessCheckmark({ className, onComplete }: { className?: string; onComplete?: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`text-green-500 ${className}`}>
      <svg className="w-full h-full" viewBox="0 0 52 52">
        <circle className="opacity-20" cx="26" cy="26" r="25" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path fill="none" stroke="currentColor" strokeWidth="3" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
      </svg>
    </div>
  );
}

// Empty state animation
export function EmptyCart({ className }: { className?: string }) {
  return (
    <div className={`text-muted-foreground ${className}`}>
      <svg className="w-full h-full" viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="4" opacity="0.2"/>
        <path d="M70 80h60M70 100h60M70 120h40" stroke="currentColor" strokeWidth="3" opacity="0.3"/>
      </svg>
    </div>
  );
}
