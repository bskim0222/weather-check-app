import type { LocationReference } from '../types/weather';

export const currentLocationReference: LocationReference = {
  id: 'current-location',
  label: '현재 위치',
  kind: 'current',
  radiusMeters: 1200,
};

export const knownLocationReferences: LocationReference[] = [
  { id: 'seoul', label: '서울', kind: 'known-place', latitude: 37.5665, longitude: 126.978, radiusMeters: 5000 },
  { id: 'busan', label: '부산', kind: 'known-place', latitude: 35.1796, longitude: 129.0756, radiusMeters: 6000 },
  { id: 'haeundae', label: '해운대', kind: 'known-place', latitude: 35.1631, longitude: 129.1635, radiusMeters: 2500 },
  { id: 'seomyeon', label: '서면', kind: 'known-place', latitude: 35.1577, longitude: 129.0592, radiusMeters: 2200 },
  { id: 'gwangalli', label: '광안리', kind: 'known-place', latitude: 35.1532, longitude: 129.1186, radiusMeters: 2200 },
  { id: 'daegu', label: '대구', kind: 'known-place', latitude: 35.8714, longitude: 128.6014, radiusMeters: 5000 },
  { id: 'incheon', label: '인천', kind: 'known-place', latitude: 37.4563, longitude: 126.7052, radiusMeters: 5000 },
  { id: 'daejeon', label: '대전', kind: 'known-place', latitude: 36.3504, longitude: 127.3845, radiusMeters: 5000 },
  { id: 'gwangju', label: '광주', kind: 'known-place', latitude: 35.1595, longitude: 126.8526, radiusMeters: 5000 },
  { id: 'ulsan', label: '울산', kind: 'known-place', latitude: 35.5384, longitude: 129.3114, radiusMeters: 5000 },
  { id: 'jeju', label: '제주', kind: 'known-place', latitude: 33.4996, longitude: 126.5312, radiusMeters: 5000 },
  { id: 'gimpo', label: '김포시', kind: 'known-place', latitude: 37.615, longitude: 126.7158, radiusMeters: 5000 },
  { id: 'seoraksan', label: '설악산', kind: 'known-place', latitude: 38.1195, longitude: 128.4656, radiusMeters: 5000 },
  { id: 'cheongwadae', label: '청와대', kind: 'known-place', latitude: 37.5866, longitude: 126.9748, radiusMeters: 900 },
  { id: 'gwanghwamun', label: '광화문', kind: 'known-place', latitude: 37.5759, longitude: 126.9768, radiusMeters: 900 },
  { id: 'hongdae', label: '홍대앞', kind: 'known-place', latitude: 37.5563, longitude: 126.9236, radiusMeters: 900 },
  { id: 'dumulmeori', label: '두물머리', kind: 'known-place', latitude: 37.5303, longitude: 127.3115, radiusMeters: 1200 },
  { id: 'kyobo-jongno', label: '종로 교보빌딩', kind: 'known-place', latitude: 37.5707, longitude: 126.9779, radiusMeters: 500 },
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
