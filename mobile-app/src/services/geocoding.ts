import { isApiModeEnabled } from '../config/appConfig';
import { writeApiJson } from './apiClient';
import type { LocationReference, SearchContext } from '../types/weather';

export type GeocodeLocationResponse = {
  ok: boolean;
  query: string;
  location?: LocationReference;
  source?: 'alias' | 'nominatim';
  displayName?: string;
};

export async function resolveRemoteLocation(searchContext: SearchContext) {
  const query = searchContext.locationQuery?.trim();

  if (!isApiModeEnabled() || !query || searchContext.target.kind !== 'current') {
    return null;
  }

  const response = await writeApiJson<GeocodeLocationResponse, { query: string; raw?: string }>(
    '/geocode',
    { query, raw: searchContext.raw },
  );

  if (!response.ok || !response.data?.location) return null;

  return response.data.location;
}
