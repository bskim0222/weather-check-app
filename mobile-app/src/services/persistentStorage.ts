import { Platform } from 'react-native';

export type PersistentStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

type WebStorageHost = {
  localStorage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  };
};

export function getPersistentStorage(): PersistentStorage | null {
  if (Platform.OS !== 'web') {
    return {
      async getItem(key: string) {
        const storage = await getNativeStorage();

        return storage.getItem(key);
      },
      async setItem(key: string, value: string) {
        const storage = await getNativeStorage();

        await storage.setItem(key, value);
      },
    };
  }

  const webStorage = (globalThis as WebStorageHost).localStorage;

  if (!webStorage) return null;

  return {
    async getItem(key: string) {
      return webStorage.getItem(key);
    },
    async setItem(key: string, value: string) {
      webStorage.setItem(key, value);
    },
  };
}

async function getNativeStorage() {
  const module = await import('@react-native-async-storage/async-storage');

  return module.default;
}
