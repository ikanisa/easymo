'use client';

import { invoke } from '@tauri-apps/api/core';

import { isDesktop } from './platform';

export class FileManager {
  /**
   * Open a file dialog
   */
  static async openFile(): Promise<string | null> {
    if (!isDesktop()) {
      console.warn('File operations not supported in web');
      return null;
    }

    try {
      const path = await invoke<string | null>('open_file_dialog');
      return path;
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      return null;
    }
  }

  /**
   * Save file dialog
   */
  static async saveFile(defaultName?: string): Promise<string | null> {
    if (!isDesktop()) {
      console.warn('File operations not supported in web');
      return null;
    }

    try {
      const path = await invoke<string | null>('save_file_dialog', { defaultName });
      return path;
    } catch (error) {
      console.error('Failed to open save dialog:', error);
      return null;
    }
  }

  /**
   * Read file contents
   */
  static async readFile(path: string): Promise<string | null> {
    if (!isDesktop()) {
      return null;
    }

    try {
      return await invoke<string>('read_file', { path });
    } catch (error) {
      console.error('Failed to read file:', error);
      return null;
    }
  }

  /**
   * Write file contents
   */
  static async writeFile(path: string, contents: string): Promise<boolean> {
    if (!isDesktop()) {
      return false;
    }

    try {
      await invoke('write_file', { path, contents });
      return true;
    } catch (error) {
      console.error('Failed to write file:', error);
      return false;
    }
  }

  /**
   * Export data to file
   */
  static async exportData(data: any, filename: string = 'export.easymo'): Promise<boolean> {
    const path = await this.saveFile(filename);
    if (!path) return false;

    const contents = JSON.stringify(data, null, 2);
    return await this.writeFile(path, contents);
  }

  /**
   * Import data from file
   */
  static async importData(): Promise<any | null> {
    const path = await this.openFile();
    if (!path) return null;

    const contents = await this.readFile(path);
    if (!contents) return null;

    try {
      return JSON.parse(contents);
    } catch (error) {
      console.error('Failed to parse file:', error);
      return null;
    }
  }
}
