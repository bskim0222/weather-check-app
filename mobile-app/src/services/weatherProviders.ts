import { isApiModeEnabled } from '../config/appConfig';
import { compareDifferences, compareServiceSummaries, weatherPresets } from '../data/mockWeather';
import { getContextualCompareRows, type CompareMode } from '../domain/compare';
import { normalizeProviderRows } from '../domain/providerRows';
import { writeApiJson } from './apiClient';
import type {
  ApiWeatherProviderSnapshot,
  ApiWeatherProviderSnapshotRequest,
  WeatherProviderSnapshotMeta,
} from '../types/api';
import type {
  CompareDifference,
  CompareRow,
  CompareServiceSummary,
  ForecastSource,
  SearchContext,
} from '../types/weather';

export type WeatherProviderSnapshot = {
  context: SearchContext;
  generatedAt: string;
  source: 'mock' | 'api' | 'unavailable';
  meta: WeatherProviderSnapshotMeta;
  sources: ForecastSource[];
  summaries: CompareServiceSummary[];
  differences: CompareDifference[];
  hourlyRows: CompareRow[];
  dailyRows: CompareRow[];
};

export function getUnavailableWeatherProviderSnapshot(searchContext: SearchContext): WeatherProviderSnapshot {
  return {
    context: searchContext,
    generatedAt: new Date().toISOString(),
    source: 'unavailable',
    meta: {
      providerMode: 'unavailable',
      liveProviderIds: [],
      fallbackProviderIds: [],
      thirdProviderId: 'fmi',
    },
    sources: [],
    summaries: [],
    differences: [],
    hourlyRows: [],
    dailyRows: [],
  };
}

export function getMockWeatherProviderSnapshot(searchContext: SearchContext): WeatherProviderSnapshot {
  const preset = Object.values(weatherPresets).find((item) => item.condition === searchContext.detectedWeather);

  return {
    context: searchContext,
    generatedAt: new Date().toISOString(),
    source: 'mock',
    meta: {
      providerMode: 'mock',
      liveProviderIds: [],
      fallbackProviderIds: ['kma', 'yr', 'fmi'],
      thirdProviderId: 'fmi',
    },
    sources: preset?.sources ?? weatherPresets.rain.sources,
    summaries: compareServiceSummaries,
    differences: compareDifferences,
    hourlyRows: normalizeProviderRows(getContextualCompareRows(searchContext.detectedWeather, 'hourly')),
    dailyRows: normalizeProviderRows(getContextualCompareRows(searchContext.detectedWeather, 'daily')),
  };
}

export function getMockProviderCompareRows(searchContext: SearchContext, mode: CompareMode) {
  const snapshot = getMockWeatherProviderSnapshot(searchContext);

  return mode === 'daily' ? snapshot.dailyRows : snapshot.hourlyRows;
}

export async function fetchProviderSnapshot(searchContext: SearchContext): Promise<WeatherProviderSnapshot> {
  if (isApiModeEnabled()) {
    const response = await writeApiJson<ApiWeatherProviderSnapshot, ApiWeatherProviderSnapshotRequest>(
      '/weather/provider-snapshot',
      { context: searchContext },
    );

    if (response.ok && response.data && response.data.source === 'api') {
      return normalizeProviderSnapshot(response.data, searchContext);
    }

    return getUnavailableWeatherProviderSnapshot(searchContext);
  }

  return getMockWeatherProviderSnapshot(searchContext);
}

export function normalizeProviderSnapshot(
  snapshot: ApiWeatherProviderSnapshot,
  fallbackContext: SearchContext,
): WeatherProviderSnapshot {
  const unavailableSnapshot = getUnavailableWeatherProviderSnapshot(fallbackContext);
  const hourlyRows = normalizeApiRows(snapshot.hourlyRows);
  const dailyRows = normalizeApiRows(snapshot.dailyRows);
  const hasForecastData = snapshot.source === 'api' && hourlyRows.length > 0;

  return {
    context: snapshot.context ?? fallbackContext,
    generatedAt: snapshot.generatedAt ?? new Date().toISOString(),
    source: hasForecastData ? 'api' : 'unavailable',
    meta: normalizeProviderMeta(snapshot.meta, unavailableSnapshot.meta),
    sources: hasItems(snapshot.sources) ? snapshot.sources : [],
    summaries: hasItems(snapshot.summaries) ? snapshot.summaries : [],
    differences: hasItems(snapshot.differences) ? snapshot.differences : [],
    hourlyRows,
    dailyRows,
  };
}

function hasItems<T>(value: T[] | undefined) {
  return Array.isArray(value) && value.length > 0;
}

function normalizeApiRows(rows: CompareRow[] | undefined) {
  return normalizeProviderRows(rows);
}

function normalizeProviderMeta(
  meta: ApiWeatherProviderSnapshot['meta'],
  fallback: WeatherProviderSnapshotMeta,
): WeatherProviderSnapshotMeta {
  if (!meta) return fallback;

  return {
    providerMode: meta.providerMode || fallback.providerMode,
    liveProviderIds: hasItems(meta.liveProviderIds) ? meta.liveProviderIds : [],
    fallbackProviderIds: Array.isArray(meta.fallbackProviderIds) ? meta.fallbackProviderIds : fallback.fallbackProviderIds,
    thirdProviderId: meta.thirdProviderId ?? fallback.thirdProviderId,
  };
}
