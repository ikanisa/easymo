import type { StorageAdapter } from '@ibimina/admin-core/adapters';
import { Preferences } from '@capacitor/preferences';

export class CapacitorStorage implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    const { value } = await Preferences.get({ key });
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    await Preferences.set({ key, value: stringValue });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }

  async clear(): Promise<void> {
    await Preferences.clear();
  }

  async keys(): Promise<string[]> {
    const { keys } = await Preferences.keys();
    return keys;
  }

  secure = {
    get: async (key: string): Promise<string | null> => {
      // Capacitor Preferences is encrypted on device
      const { value } = await Preferences.get({ key: `secure_${key}` });
      return value;
    },

    set: async (key: string, value: string): Promise<void> => {
      await Preferences.set({ key: `secure_${key}`, value });
    },

    remove: async (key: string): Promise<void> => {
      await Preferences.remove({ key: `secure_${key}` });
    },
  };
}
