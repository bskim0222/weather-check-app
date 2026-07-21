import type { LocationStatus } from '../types/appState';
import type { SearchContext } from '../types/weather';

export function getCurrentLocationDisplay(locationStatus: LocationStatus) {
  if (locationStatus.phase === 'granted') {
    return getPrivacySafePlaceName(locationStatus.placeName ?? locationStatus.label ?? '확인됨');
  }

  if (locationStatus.phase === 'checking') return '확인 중';
  if (locationStatus.phase === 'denied') return '권한 필요';
  if (locationStatus.phase === 'unavailable') return locationStatus.label;
  if (locationStatus.phase === 'fallback') {
    return getPrivacySafePlaceName(locationStatus.placeName ?? '기본 위치');
  }

  return locationStatus.label || '확인 중';
}

export function getPrivacySafePlaceName(place: string) {
  const clean = place
    .replace(/\d+(?:동|호|층)/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = clean.split(/\s+/).filter(Boolean);
  const administrativeTokens = tokens.filter((token) => (
    /(?:특별시|광역시|특별자치시|특별자치도|도|시|군|구|읍|면|동)$/.test(token)
    && !/^\d+동$/.test(token)
  ));

  if (administrativeTokens.length >= 2) {
    return administrativeTokens.slice(-3).join(' ');
  }

  const hasPrivateBuildingName = tokens.some((token) => (
    /(?:아파트|빌라|오피스텔|타워|빌딩|센터|블루힐|주상복합)/.test(token)
  ));
  if (hasPrivateBuildingName) return '현재 위치 근처';

  return administrativeTokens.join(' ') || clean || '현재 위치 근처';
}

export function getFieldReportPlaceDisplay(locationStatus: LocationStatus) {
  const label = getCurrentLocationDisplay(locationStatus);

  return label.startsWith('현재 위치') ? label.replace(/^현재 위치\s*/, '') : label;
}

export function getNearbySectionTitle(searchContext: SearchContext) {
  return searchContext.target.kind === 'current' ? '내 주변 현장' : `${searchContext.place} 주변 현장`;
}
