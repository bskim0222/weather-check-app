type ExpoPublicEnv = Record<string, string | undefined>;

declare const process: { env: ExpoPublicEnv };
const defaultWebApiBaseUrl = 'https://weather-check-backend-hvfs.onrender.com';
const isBrowserRuntime = typeof globalThis.document !== 'undefined';
const webApiBaseUrl = isBrowserRuntime ? defaultWebApiBaseUrl : '';

export type DataMode = 'mock' | 'api';

export const appConfig = {
  dataMode: normalizeDataMode(process.env.EXPO_PUBLIC_DATA_MODE ?? (isBrowserRuntime ? 'api' : undefined)),
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? webApiBaseUrl,
  kmaApiKey: process.env.EXPO_PUBLIC_KMA_API_KEY ?? '',
  windyApiKey: process.env.EXPO_PUBLIC_WINDY_API_KEY ?? '',
  kakaoJavaScriptKey: process.env.EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY ?? '',
  yrUserAgent: process.env.EXPO_PUBLIC_YR_USER_AGENT ?? '',
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
