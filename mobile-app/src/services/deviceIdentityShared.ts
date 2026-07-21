export const deviceIdStorageKey = 'weather-check-device-id-v1';

export function createDeviceId() {
  const cryptoHost = globalThis.crypto as { randomUUID?: () => string } | undefined;
  const randomPart = cryptoHost?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `device-${randomPart}`;
}
