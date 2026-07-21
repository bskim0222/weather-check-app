import { createDeviceId, deviceIdStorageKey } from './deviceIdentityShared';

let deviceId: string | null = null;

export async function getClientDeviceId() {
  if (deviceId) return deviceId;

  try {
    const stored = globalThis.localStorage?.getItem(deviceIdStorageKey);
    if (stored) {
      deviceId = stored;
      return stored;
    }

    deviceId = createDeviceId();
    globalThis.localStorage?.setItem(deviceIdStorageKey, deviceId);
    return deviceId;
  } catch {
    deviceId = createDeviceId();
    return deviceId;
  }
}
