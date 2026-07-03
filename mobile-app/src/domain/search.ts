import type { SearchContext, WeatherKey } from '../types/weather';
import { currentLocationReference, findKnownLocation } from './location';

export const defaultQuestionSuggestions = [
  '잠실운동장 지금 비 와?',
  '부산 내일 오후에 비 올 것 같아?',
  '석촌호수 내일 눈 와?',
  '잠실새내역 퇴근길 천둥번개 들려?',
  '송파 지금 안개 심해?',
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
  '뿌옇',
  '비',
  '우산',
  '소나기',
  '흐',
  '구름',
  '맑',
  '해',
];

export function inferWeatherFromQuestion(question: string): WeatherKey {
  const clean = question.replace(/\s/g, '');

  if (clean.includes('천둥') || clean.includes('번개')) return 'thunder';
  if (clean.includes('눈')) return 'snow';
  if (clean.includes('안개') || clean.includes('뿌옇')) return 'fog';
  if (clean.includes('비안') || clean.includes('안와') || clean.includes('안오')) return 'sunny';
  if (clean.includes('비') || clean.includes('우산') || clean.includes('소나기')) return 'rain';
  if (clean.includes('흐') || clean.includes('구름')) return 'cloudy';
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
  };

  return labels[weatherKey];
}

export function inferSearchContext(question: string, weatherKey: WeatherKey): SearchContext {
  const clean = question.trim();
  const matchedLocation = findKnownLocation(clean);
  const place = matchedLocation?.label ?? '현재 위치';
  const target = matchedLocation ?? currentLocationReference;
  const timeLabel = inferTimeLabel(clean);
  const weatherHintFound = hasWeatherHint(clean);
  const weatherLabel = getDetectedWeatherLabel(weatherKey);
  const interpretationNote = !matchedLocation
    ? '장소 단어를 찾지 못해서 현재 위치 기준으로 봤어요.'
    : !weatherHintFound
      ? '날씨 단어가 뚜렷하지 않아 비 가능성을 먼저 확인했어요.'
      : `${place}의 ${timeLabel} 날씨를 ${weatherLabel} 기준으로 봤어요.`;

  return {
    raw: clean,
    place,
    target,
    timeLabel,
    detectedWeather: weatherLabel,
    interpretationNote,
    needsClarification: !matchedLocation || !weatherHintFound,
  };
}

export function resolveReportPlace(place: string) {
  return place === '현재 위치' ? '내 주변' : place;
}

function hasWeatherHint(question: string) {
  return weatherHintWords.some((word) => question.includes(word));
}

function inferTimeLabel(question: string) {
  const dayLabel = inferDayLabel(question);
  const dayPartLabel = inferDayPartLabel(question);

  if (dayLabel && dayPartLabel) return `${dayLabel} ${dayPartLabel}`;
  if (dayLabel) return dayLabel;
  if (dayPartLabel) return dayPartLabel;
  if (question.includes('저녁')) return '저녁';
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
