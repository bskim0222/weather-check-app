type ExpoPublicEnv = Record<string, string | undefined>;

const env =
  (globalThis as unknown as { process?: { env?: ExpoPublicEnv } }).process?.env ?? {};
const defaultWebApiBaseUrl = 'https://weather-check-backend-hvfs.onrender.com';
const isBrowserRuntime = typeof globalThis.document !== 'undefined';
const webApiBaseUrl = isBrowserRuntime ? defaultWebApiBaseUrl : '';

export type DataMode = 'mock' | 'api';

export const appConfig = {
  dataMode: normalizeDataMode(env.EXPO_PUBLIC_DATA_MODE ?? (isBrowserRuntime ? 'api' : undefined)),
  apiBaseUrl: env.EXPO_PUBLIC_API_BASE_URL ?? webApiBaseUrl,
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
