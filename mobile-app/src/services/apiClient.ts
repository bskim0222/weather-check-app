import { appConfig, isBackendConfigured } from '../config/appConfig';
import { getClientDeviceId } from './deviceIdentity';

export type ApiClientResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type ApiErrorPayload = {
  error?: unknown;
};

const apiTimeoutMs = 25000;

export function buildApiUrl(path: string) {
  const cleanBase = appConfig.apiBaseUrl.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  return `${cleanBase}${cleanPath}`;
}

export async function readApiJson<T>(path: string): Promise<ApiClientResult<T>> {
  if (!isBackendConfigured()) {
    return {
      ok: false,
      error: 'API base URL is not configured.',
    };
  }

  try {
    const deviceId = await getClientDeviceId();
    const response = await fetchWithTimeout(buildApiUrl(path), {
      headers: { 'X-WeatherCheck-Device-Id': deviceId },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: await getApiErrorMessage(response),
      };
    }

    return {
      ok: true,
      data: (await response.json()) as T,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown API error.',
    };
  }
}

export async function writeApiJson<TResponse, TBody>(
  path: string,
  body: TBody,
): Promise<ApiClientResult<TResponse>> {
  return sendApiJson<TResponse, TBody>(path, 'POST', body);
}

export async function sendApiJson<TResponse, TBody = undefined>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: TBody,
): Promise<ApiClientResult<TResponse>> {
  if (!isBackendConfigured()) {
    return {
      ok: false,
      error: 'API base URL is not configured.',
    };
  }

  try {
    const deviceId = await getClientDeviceId();
    const response = await fetchWithTimeout(buildApiUrl(path), {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-WeatherCheck-Device-Id': deviceId,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: await getApiErrorMessage(response),
      };
    }

    return {
      ok: true,
      data: (await response.json()) as TResponse,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown API error.',
    };
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), apiTimeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getApiErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
  } catch {
    // Keep a stable fallback when the server response is not JSON.
  }

  return `API request failed with status ${response.status}.`;
}
