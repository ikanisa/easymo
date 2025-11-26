'use client';

import { invoke } from '@tauri-apps/api/core';
import { isDesktop } from './platform';

export interface WindowConfig {
  label: string;
  url: string;
  title: string;
  width?: number;
  height?: number;
}

export class WindowManager {
  /**
   * Create a new window
   */
  static async createWindow(config: WindowConfig): Promise<void> {
    if (!isDesktop()) {
      console.warn('Multi-window not supported in web');
      return;
    }

    try {
      await invoke('create_window', { config });
    } catch (error) {
      console.error('Failed to create window:', error);
      throw error;
    }
  }

  /**
   * Get all open windows
   */
  static async getAllWindows(): Promise<string[]> {
    if (!isDesktop()) {
      return [];
    }

    try {
      return await invoke<string[]>('get_all_windows');
    } catch (error) {
      console.error('Failed to get windows:', error);
      return [];
    }
  }

  /**
   * Close a window by label
   */
  static async closeWindow(label: string): Promise<void> {
    if (!isDesktop()) {
      return;
    }

    try {
      await invoke('close_window', { label });
    } catch (error) {
      console.error('Failed to close window:', error);
      throw error;
    }
  }

  /**
   * Focus a window by label
   */
  static async focusWindow(label: string): Promise<void> {
    if (!isDesktop()) {
      return;
    }

    try {
      await invoke('focus_window', { label });
    } catch (error) {
      console.error('Failed to focus window:', error);
      throw error;
    }
  }

  /**
   * Broadcast an event to all windows
   */
  static async broadcast(event: string, payload: any): Promise<void> {
    if (!isDesktop()) {
      return;
    }

    try {
      await invoke('broadcast_event', { event, payload });
    } catch (error) {
      console.error('Failed to broadcast event:', error);
      throw error;
    }
  }

  /**
   * Create a detached panel window
   */
  static async detachPanel(panelId: string, title: string): Promise<void> {
    const config: WindowConfig = {
      label: `panel-${panelId}`,
      url: `/panel/${panelId}`,
      title: `Panel: ${title}`,
      width: 600,
      height: 800,
    };

    await this.createWindow(config);
  }

  /**
   * Create an analytics window
   */
  static async openAnalytics(): Promise<void> {
    const config: WindowConfig = {
      label: 'analytics',
      url: '/analytics',
      title: 'Analytics Dashboard',
      width: 1200,
      height: 800,
    };

    await this.createWindow(config);
  }

  /**
   * Create a floating notification center
   */
  static async openNotifications(): Promise<void> {
    const config: WindowConfig = {
      label: 'notifications',
      url: '/notifications',
      title: 'Notifications',
      width: 400,
      height: 600,
    };

    await this.createWindow(config);
  }
}
