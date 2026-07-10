import { appConfig, isBackendConfigured } from '../config/appConfig';

export type ApiClientResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

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
    const response = await fetch(buildApiUrl(path));

    if (!response.ok) {
      return {
        ok: false,
        error: `API request failed with status ${response.status}.`,
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
    const response = await fetch(buildApiUrl(path), {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `API request failed with status ${response.status}.`,
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
