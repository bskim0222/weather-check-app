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
  source: 'mock' | 'api';
  meta: WeatherProviderSnapshotMeta;
  sources: ForecastSource[];
  summaries: CompareServiceSummary[];
  differences: CompareDifference[];
  hourlyRows: CompareRow[];
  dailyRows: CompareRow[];
};

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

    if (response.ok && response.data) {
      return normalizeProviderSnapshot(response.data, searchContext);
    }
  }

  return getMockWeatherProviderSnapshot(searchContext);
}

export function normalizeProviderSnapshot(
  snapshot: ApiWeatherProviderSnapshot,
  fallbackContext: SearchContext,
): WeatherProviderSnapshot {
  const fallbackSnapshot = getMockWeatherProviderSnapshot(fallbackContext);

  return {
    context: snapshot.context ?? fallbackContext,
    generatedAt: snapshot.generatedAt ?? new Date().toISOString(),
    source: snapshot.source ?? 'api',
    meta: normalizeProviderMeta(snapshot.meta, fallbackSnapshot.meta),
    sources: hasItems(snapshot.sources) ? snapshot.sources : fallbackSnapshot.sources,
    summaries: hasItems(snapshot.summaries) ? snapshot.summaries : fallbackSnapshot.summaries,
    differences: hasItems(snapshot.differences) ? snapshot.differences : fallbackSnapshot.differences,
    hourlyRows: normalizeApiRows(snapshot.hourlyRows, fallbackSnapshot.hourlyRows),
    dailyRows: normalizeApiRows(snapshot.dailyRows, fallbackSnapshot.dailyRows),
  };
}

function hasItems<T>(value: T[] | undefined) {
  return Array.isArray(value) && value.length > 0;
}

function normalizeApiRows(rows: CompareRow[] | undefined, fallbackRows: CompareRow[]) {
  const normalized = normalizeProviderRows(rows);

  if (normalized.length === 0) return fallbackRows;

  return normalized;
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
