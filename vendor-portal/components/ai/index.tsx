"use client";

import React from 'react';
import { AIErrorBoundary } from '@/components/ui/error-boundary';
import { AIAssistantPanel } from './ai-assistant-panel';

interface SafeAIAssistantPanelProps {
  onClose: () => void;
}

/**
 * AI Assistant Panel wrapped with error boundary
 * This prevents the entire app from crashing if the AI assistant fails
 */
export function SafeAIAssistantPanel({ onClose }: SafeAIAssistantPanelProps) {
  const handleError = (error: Error) => {
    // Log to error tracking service
    console.error('AI Assistant Panel Error:', error);
    
    // TODO: Send to Sentry/PostHog
    // Sentry.captureException(error, {
    //   tags: { component: 'ai-assistant' },
    // });
  };

  return (
    <AIErrorBoundary onError={handleError} resetKeys={[]}>
      <AIAssistantPanel onClose={onClose} />
    </AIErrorBoundary>
  );
}

// Re-export for convenience
export { AIAssistantPanel };
