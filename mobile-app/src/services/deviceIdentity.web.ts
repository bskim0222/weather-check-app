import { loadOrCreateDeviceId } from './deviceIdentityShared';
import { getPersistentStorage } from './persistentStorage';

let deviceIdPromise: Promise<string> | null = null;

export async function getClientDeviceId() {
  if (!deviceIdPromise) deviceIdPromise = loadOrCreateDeviceId(getPersistentStorage());
  return deviceIdPromise;
}
