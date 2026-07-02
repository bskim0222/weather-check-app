import type { LocationReference } from '../types/weather';

export const currentLocationReference: LocationReference = {
  id: 'current-location',
  label: '현재 위치',
  kind: 'current',
  radiusMeters: 1200,
};

export const knownLocationReferences: LocationReference[] = [
  { id: 'jamsil-stadium', label: '잠실운동장', kind: 'known-place', latitude: 37.5146, longitude: 127.0736, radiusMeters: 900 },
  { id: 'jamsil-sae-nae', label: '잠실새내역', kind: 'known-place', latitude: 37.5116, longitude: 127.0863, radiusMeters: 800 },
  { id: 'jamsil-baseball-stadium', label: '잠실야구장', kind: 'known-place', latitude: 37.5122, longitude: 127.0719, radiusMeters: 700 },
  { id: 'seokchon-lake', label: '석촌호수', kind: 'known-place', latitude: 37.5094, longitude: 127.1047, radiusMeters: 1100 },
  { id: 'sports-complex-station', label: '종합운동장역', kind: 'known-place', latitude: 37.511, longitude: 127.0738, radiusMeters: 800 },
  { id: 'jamsil', label: '잠실', kind: 'known-place', latitude: 37.5133, longitude: 127.1001, radiusMeters: 1800 },
  { id: 'songpa', label: '송파', kind: 'known-place', latitude: 37.5145, longitude: 127.1059, radiusMeters: 2500 },
];

export function findKnownLocation(question: string) {
  return knownLocationReferences.find((item) => question.includes(item.label));
}

export function resolveLocationReference(place: string): LocationReference {
  return knownLocationReferences.find((item) => item.label === place) ?? currentLocationReference;
}

export function formatRadius(reference: LocationReference) {
  if (reference.radiusMeters >= 1000) {
    return `${(reference.radiusMeters / 1000).toFixed(1)}km`;
  }

  return `${reference.radiusMeters}m`;
}
