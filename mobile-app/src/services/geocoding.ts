import { isApiModeEnabled } from '../config/appConfig';
import { writeApiJson } from './apiClient';
import type { LocationReference, SearchContext } from '../types/weather';

export type GeocodeLocationResponse = {
  ok: boolean;
  query: string;
  location?: LocationReference;
  source?: 'alias' | 'kakao' | 'nominatim';
  displayName?: string;
};

export type ReverseGeocodeLocationResponse = GeocodeLocationResponse & {
  latitude?: number;
  longitude?: number;
};

export type PlaceCandidate = {
  source?: 'alias' | 'kakao' | 'nominatim';
  displayName?: string;
  subtitle?: string;
  location: LocationReference;
};

export type PlaceSearchResponse = {
  ok: boolean;
  query: string;
  candidates: PlaceCandidate[];
};

export async function searchRemotePlaces(query: string, raw?: string) {
  const clean = query.trim();

  if (!isApiModeEnabled() || !clean) return [];

  const response = await writeApiJson<PlaceSearchResponse, { query: string; raw?: string }>(
    '/places/search',
    { query: clean, raw },
  );

  if (!response.ok || !Array.isArray(response.data?.candidates)) return [];

  return response.data.candidates;
}

export async function resolveRemoteLocation(searchContext: SearchContext) {
  const query = searchContext.locationQuery?.trim();

  if (
    !isApiModeEnabled() ||
    !query ||
    (searchContext.target.kind !== 'current' && searchContext.target.kind !== 'pending-place')
  ) {
    return null;
  }

  const response = await writeApiJson<GeocodeLocationResponse, { query: string; raw?: string }>(
    '/geocode',
    { query, raw: searchContext.raw },
  );

  if (!response.ok || !response.data?.location) return null;

  return response.data.location;
}

export async function resolveRemotePlaceName(latitude: number, longitude: number) {
  if (!isApiModeEnabled()) return null;

  const response = await writeApiJson<
    ReverseGeocodeLocationResponse,
    { latitude: number; longitude: number }
  >('/reverse-geocode', { latitude, longitude });

  if (!response.ok || !response.data?.location?.label) return null;

  return response.data.location.label;
}
