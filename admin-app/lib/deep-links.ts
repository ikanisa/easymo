'use client';

import { invoke } from '@tauri-apps/api/core';
import { isDesktop } from './platform';

export interface DeepLink {
  action: string;
  params: Record<string, string>;
}

export class DeepLinkHandler {
  private static handlers: Map<string, (params: Record<string, string>) => void> = new Map();

  /**
   * Register a deep link handler
   */
  static register(action: string, handler: (params: Record<string, string>) => void): void {
    this.handlers.set(action, handler);
  }

  /**
   * Handle a deep link
   */
  static async handle(link: DeepLink): Promise<void> {
    const handler = this.handlers.get(link.action);
    if (handler) {
      handler(link.params);
    } else {
      console.warn(`No handler registered for action: ${link.action}`);
    }
  }

  /**
   * Parse a deep link URL
   */
  static async parse(url: string): Promise<DeepLink | null> {
    if (!isDesktop()) {
      return null;
    }

    try {
      return await invoke<DeepLink>('parse_deep_link_url', { url });
    } catch (error) {
      console.error('Failed to parse deep link:', error);
      return null;
    }
  }

  /**
   * Navigate to a specific page via deep link
   */
  static createNavigateHandler(router: any) {
    return (params: Record<string, string>) => {
      const path = params.path || '/';
      router.push(path);
    };
  }

  /**
   * Open a specific feature via deep link
   */
  static createFeatureHandler(featureName: string, onOpen: () => void) {
    return () => {
      console.log(`Opening feature: ${featureName}`);
      onOpen();
    };
  }
}

// Example usage:
// DeepLinkHandler.register('navigate', DeepLinkHandler.createNavigateHandler(router));
// DeepLinkHandler.register('analytics', () => WindowManager.openAnalytics());
// easymo://navigate?path=/dashboard
// easymo://analytics
