import type { LocationStatus } from '../types/appState';

export function createFallbackLocationStatus(
  message = '현재 위치를 확인할 수 없어 날씨를 불러오지 않았어요. 위치 설정을 확인한 뒤 다시 시도해주세요.',
): LocationStatus {
  return {
    phase: 'fallback',
    label: '위치 확인 실패',
    message,
    source: 'fallback',
  };
}
