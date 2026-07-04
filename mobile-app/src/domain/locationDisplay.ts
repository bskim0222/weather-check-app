import type { LocationStatus } from '../types/appState';
import type { SearchContext } from '../types/weather';

export function getCurrentLocationDisplay(locationStatus: LocationStatus) {
  if (locationStatus.phase === 'granted') {
    return locationStatus.placeName ?? locationStatus.label ?? '확인됨';
  }

  if (locationStatus.phase === 'checking') return '확인 중';
  if (locationStatus.phase === 'denied') return '권한 필요';
  if (locationStatus.phase === 'unavailable') return locationStatus.label;
  if (locationStatus.phase === 'fallback') return locationStatus.placeName ?? '기본 위치';

  return locationStatus.label || '확인 중';
}

export function getFieldReportPlaceDisplay(locationStatus: LocationStatus) {
  const label = getCurrentLocationDisplay(locationStatus);

  return label.startsWith('현재 위치') ? label.replace(/^현재 위치\s*/, '') : label;
}

export function getNearbySectionTitle(searchContext: SearchContext) {
  return searchContext.target.kind === 'current' ? '내 주변 현장' : `${searchContext.place} 주변 현장`;
}
