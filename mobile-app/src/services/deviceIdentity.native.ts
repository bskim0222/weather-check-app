import { createDeviceId, deviceIdStorageKey } from './deviceIdentityShared';
import { getPersistentStorage } from './persistentStorage';

let deviceIdPromise: Promise<string> | null = null;

export function getClientDeviceId() {
  if (!deviceIdPromise) deviceIdPromise = resolveClientDeviceId();
  return deviceIdPromise;
}

async function resolveClientDeviceId() {
  const storage = getPersistentStorage();

  try {
    const stored = await storage?.getItem(deviceIdStorageKey);
    if (stored) return stored;

    const created = createDeviceId();
    await storage?.setItem(deviceIdStorageKey, created);
    return created;
  } catch {
    return createDeviceId();
  }
}
