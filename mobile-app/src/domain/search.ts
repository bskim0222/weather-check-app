import type { SearchContext, WeatherKey } from '../types/weather';
import { currentLocationReference, findKnownLocation } from './location';

export const defaultQuestionSuggestions = [
  '광화문',
  '잠실운동장',
  '부산 해운대',
  '설악산',
  '제주공항',
];

export const defaultSearchContext: SearchContext = {
  raw: '현재 위치 기준',
  place: '현재 위치',
  target: currentLocationReference,
  timeLabel: '지금',
  detectedWeather: '비',
  interpretationNote: '현재 위치의 지금 날씨를 비 가능성 기준으로 보고 있어요.',
  needsClarification: false,
};

const weatherHintWords = [
  '천둥',
  '번개',
  '눈',
  '안개',
  '미세먼지',
  '비',
  '날씨',
  '기온',
  '우산',
  '소나기',
  '흐림',
  '구름',
  '맑',
  '해',
];

export function inferWeatherFromQuestion(question: string): WeatherKey {
  const clean = question.replace(/\s/g, '');

  if (clean.includes('태풍') || clean.includes('강풍')) return 'typhoon';
  if (clean.includes('폭염') || clean.includes('무더위') || clean.includes('더워')) return 'heat';
  if (clean.includes('황사') || clean.includes('미세먼지') || clean.includes('먼지')) return 'dust';
  if (clean.includes('무지개')) return 'rainbow';
  if (clean.includes('밤') && (clean.includes('맑') || clean.includes('별'))) return 'night';
  if (clean.includes('소나기')) return 'shower';
  if (clean.includes('천둥') || clean.includes('번개')) return 'thunder';
  if (clean.includes('눈') || clean.includes('진눈')) return 'snow';
  if (clean.includes('안개') || clean.includes('시야')) return 'fog';
  if (clean.includes('비안') || clean.includes('안와') || clean.includes('안오')) return 'sunny';
  if (clean.includes('비') || clean.includes('우산') || clean.includes('소나기')) return 'rain';
  if (clean.includes('흐림') || clean.includes('흐려') || clean.includes('구름')) return 'cloudy';
  if (clean.includes('맑') || clean.includes('해')) return 'sunny';

  return 'rain';
}

export function getDetectedWeatherLabel(weatherKey: WeatherKey) {
  const labels: Record<WeatherKey, string> = {
    sunny: '맑음',
    cloudy: '흐림',
    rain: '비',
    thunder: '천둥번개',
    snow: '눈',
    fog: '안개',
    shower: '소나기',
    dust: '황사',
    heat: '폭염',
    typhoon: '태풍',
    night: '맑은 밤',
    rainbow: '무지개',
  };

  return labels[weatherKey];
}

export function inferSearchContext(question: string, weatherKey: WeatherKey): SearchContext {
  const clean = question.trim();
  const matchedLocation = findKnownLocation(clean);
  const locationQuery = matchedLocation?.label ?? extractLocationCandidate(clean);
  const hasPlaceCandidate = Boolean(locationQuery);
  const isCurrentLocationQuery = isExplicitCurrentLocationQuery(clean);
  const place = matchedLocation?.label ?? locationQuery ?? (isCurrentLocationQuery ? '현재 위치' : '');
  const target = matchedLocation ?? (
    locationQuery
      ? {
          id: `pending-${locationQuery.replace(/\s+/g, '-')}`,
          label: locationQuery,
          kind: 'pending-place' as const,
          radiusMeters: 1200,
        }
      : isCurrentLocationQuery
        ? currentLocationReference
        : {
            id: 'missing-place',
            label: '',
            kind: 'pending-place' as const,
            radiusMeters: 1200,
          }
  );
  const timeLabel = inferTimeLabel(clean);
  const weatherHintFound = hasWeatherHint(clean);
  const weatherLabel = getDetectedWeatherLabel(weatherKey);
  const interpretationNote = matchedLocation
    ? !weatherHintFound
      ? '날씨 단어가 뚜렷하지 않아 비 가능성을 먼저 확인했어요.'
      : `${place}의 ${timeLabel} 날씨를 ${weatherLabel} 기준으로 봤어요.`
    : hasPlaceCandidate
      ? `${place} 위치를 먼저 확인하고 있어요. 장소가 확인되면 그 위치 기준으로 판정할게요.`
      : isCurrentLocationQuery
        ? '현재 위치 기준으로 봤어요.'
        : '장소명을 먼저 입력해주세요.';

  return {
    raw: clean,
    place: place || '장소 미입력',
    target,
    locationQuery: locationQuery || undefined,
    timeLabel,
    detectedWeather: weatherLabel,
    interpretationNote,
    needsClarification: !hasPlaceCandidate || !weatherHintFound,
  };
}

export function resolveReportPlace(place: string) {
  return place === '현재 위치' ? '내 주변' : place;
}

function hasWeatherHint(question: string) {
  return weatherHintWords.some((word) => question.includes(word));
}

function extractLocationCandidate(question: string) {
  const normalized = question
    .replace(/[?!,。]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const beforeWeather = normalized.match(
    /(.+?)(?:오늘|내일|모레|주말|아침|오전|오후|저녁|밤|새벽|\d{1,2}\s*시)?\s*(?:날씨|비|눈|안개|기온|우산|소나기|천둥|번개)/,
  )?.[1];
  const cleanedBeforeWeather = cleanLocationCandidate(beforeWeather ?? '');
  if (cleanedBeforeWeather) return cleanedBeforeWeather;

  const placeWithParticle = normalized.match(/([가-힣A-Za-z0-9·.\-\s]{2,40}?)(?:에서|근처|주변)\s*(?:날씨|비|눈|안개|기온|우산|소나기|천둥|번개)/)?.[1];
  const cleanedPlace = cleanLocationCandidate(placeWithParticle ?? '');
  if (cleanedPlace) return cleanedPlace;

  const directPlace = cleanLocationCandidate(normalized);

  return isLikelyPlaceCandidate(directPlace) ? directPlace : '';
}

function cleanLocationCandidate(value: string) {
  return value
    .replace(/.*(?:근데|그런데|이면|라면|하고|그리고|,)/, '')
    .replace(/(오늘|내일|모레|주말|아침|오전|오후|저녁|밤|새벽|점심|낮|지금|퇴근길|\d{1,2}\s*시)/g, ' ')
    .replace(/\s*(날씨|비|눈|안개|기온|우산|소나기|천둥|번개|흐림|구름|맑음|바람).*$/, '')
    .replace(/\s+(날씨|비|눈|안개|기온|우산|소나기|천둥|번개|흐림|구름|맑음|바람)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyPlaceCandidate(value: string) {
  if (value.length < 2) return false;
  if (weatherHintWords.some((word) => value === word)) return false;
  if (/^(오늘|내일|모레|주말|아침|오전|오후|저녁|밤|새벽|지금)$/.test(value)) return false;

  return /[가-힣A-Za-z0-9]/.test(value);
}

export function isExplicitCurrentLocationQuery(question: string) {
  const clean = question.replace(/\s/g, '');

  return clean.includes('현재위치') || clean.includes('내위치') || clean.includes('내주변') || clean.includes('여기');
}

function inferTimeLabel(question: string) {
  const dayLabel = inferDayLabel(question);
  const exactHourLabel = inferExactHourLabel(question);
  const dayPartLabel = inferDayPartLabel(question);

  if (dayLabel && exactHourLabel) return `${dayLabel} ${exactHourLabel}`;
  if (exactHourLabel) return exactHourLabel;
  if (dayLabel && dayPartLabel) return `${dayLabel} ${dayPartLabel}`;
  if (dayLabel) return dayLabel;
  if (dayPartLabel) return dayPartLabel;
  if (question.includes('지금')) return '지금';
  if (question.includes('오늘')) return '오늘';

  return '지금';
}

function inferDayLabel(question: string) {
  if (question.includes('내일')) return '내일';
  if (question.includes('모레')) return '모레';
  if (question.includes('주말')) return '주말';
  if (question.includes('오늘')) return '오늘';

  return '';
}

function inferExactHourLabel(question: string) {
  const match = question.match(/(\d{1,2})\s*시/);
  if (!match) return '';

  const hour = normalizeQuestionHour(question, Number(match[1]));

  return Number.isFinite(hour) ? `${String(hour).padStart(2, '0')}시` : '';
}

function normalizeQuestionHour(question: string, rawHour: number) {
  if (rawHour < 0 || rawHour > 24) return NaN;

  if ((question.includes('오후') || question.includes('저녁') || question.includes('밤')) && rawHour < 12) {
    return rawHour + 12;
  }

  if (question.includes('새벽') && rawHour === 12) return 0;
  if ((question.includes('오전') || question.includes('아침')) && rawHour === 12) return 0;

  return rawHour === 24 ? 0 : rawHour;
}

function inferDayPartLabel(question: string) {
  if (question.includes('퇴근')) return '퇴근길';
  if (question.includes('오전') || question.includes('아침')) return '오전';
  if (question.includes('점심') || question.includes('낮')) return '낮';
  if (question.includes('오후')) return '오후';
  if (question.includes('저녁')) return '저녁';
  if (question.includes('밤')) return '밤';
  if (question.includes('새벽')) return '새벽';

  return '';
}
