export const deviceIdStorageKey = 'weather-check-device-id-v1';

export type DeviceIdStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export function createDeviceId() {
  const cryptoHost = globalThis.crypto as { randomUUID?: () => string } | undefined;
  const randomPart = cryptoHost?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `device-${randomPart}`;
}

export async function loadOrCreateDeviceId(storage: DeviceIdStorage | null) {
  if (!storage) return createDeviceId();

  try {
    const stored = await storage.getItem(deviceIdStorageKey);
    if (stored?.trim()) return stored;

    const created = createDeviceId();
    await storage.setItem(deviceIdStorageKey, created);
    return created;
  } catch {
    return createDeviceId();
  }
}
