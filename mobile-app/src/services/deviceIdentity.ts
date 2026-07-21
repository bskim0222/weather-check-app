import { createDeviceId } from './deviceIdentityShared';

let deviceId: string | null = null;

export async function getClientDeviceId() {
  if (!deviceId) deviceId = createDeviceId();
  return deviceId;
}
