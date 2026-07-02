type ExpoPublicEnv = Record<string, string | undefined>;

const env =
  (globalThis as unknown as { process?: { env?: ExpoPublicEnv } }).process?.env ?? {};

export type DataMode = 'mock' | 'api';

export const appConfig = {
  dataMode: normalizeDataMode(env.EXPO_PUBLIC_DATA_MODE),
  apiBaseUrl: env.EXPO_PUBLIC_API_BASE_URL ?? '',
  kmaApiKey: env.EXPO_PUBLIC_KMA_API_KEY ?? '',
  windyApiKey: env.EXPO_PUBLIC_WINDY_API_KEY ?? '',
  yrUserAgent: env.EXPO_PUBLIC_YR_USER_AGENT ?? '',
};

export function isApiModeEnabled() {
  return appConfig.dataMode === 'api';
}

export function isBackendConfigured() {
  return appConfig.apiBaseUrl.trim().length > 0;
}

function normalizeDataMode(value: string | undefined): DataMode {
  return value === 'api' ? 'api' : 'mock';
}
