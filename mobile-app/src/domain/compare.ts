import type { CompareForecastCell, CompareRow, SearchContext } from '../types/weather';

export type CompareMode = 'hourly' | 'daily';

type ServiceTriplet = {
  kma: CompareForecastCell;
  yr: CompareForecastCell;
  windy: CompareForecastCell;
};

const tones = {
  sun: '#f25a38',
  cloud: '#8cc9ff',
  gray: '#64748b',
  rain: '#65a6ff',
  shower: '#f6c453',
  thunder: '#3a1f4d',
};

export function getCompareFocusText(searchContext: SearchContext) {
  if (searchContext.detectedWeather === '천둥번개') {
    return `${searchContext.place}의 ${searchContext.timeLabel} 천둥 가능성은 강수량보다 대기 불안정 신호가 더 중요해요. FMI ECMWF의 구름량과 현장 소리 제보를 같이 봅니다.`;
  }

  if (searchContext.detectedWeather === '눈') {
    return `${searchContext.place}의 ${searchContext.timeLabel} 눈 가능성은 기온 경계가 핵심이에요. 같은 강수라도 서비스마다 비와 눈 판단이 갈릴 수 있어요.`;
  }

  if (searchContext.detectedWeather === '안개') {
    return `${searchContext.place}의 ${searchContext.timeLabel} 안개는 강수보다 습도, 바람 약함, 시야 제보를 우선해서 봐야 해요.`;
  }

  if (searchContext.detectedWeather === '맑음' || searchContext.detectedWeather === '흐림') {
    return `${searchContext.place}의 ${searchContext.timeLabel} 하늘 상태는 강수 신호보다 구름량과 현장 체감이 더 중요해요.`;
  }

  return `${searchContext.place}의 ${searchContext.timeLabel} 비 가능성은 강수확률, 예상 강수량, 비구름 이동 방향이 서로 맞는지 보는 게 핵심이에요.`;
}

export function getContextualCompareRows(weather: string, mode: CompareMode): CompareRow[] {
  return mode === 'daily' ? getDailyCompareRows(weather) : getHourlyCompareRows(weather);
}

function getHourlyCompareRows(weather: string): CompareRow[] {
  if (weather === '천둥번개') {
    return createRows(['지금', '1시간 뒤', '3시간 뒤'], [
      thunderCells('소나기', '흐림', '대기 불안정', '24° · 45%', '23° · 0.4mm', '24° · 접근'),
      thunderCells('천둥 가능', '약한 비', '강한 구름대', '24° · 55%', '23° · 0.8mm', '24° · 접근'),
      thunderCells('흐림', '비 약함', '구름 통과', '23° · 35%', '22° · 0.5mm', '23° · 동쪽 이동'),
    ]);
  }

  if (weather === '눈') {
    return createRows(['지금', '1시간 뒤', '3시간 뒤'], [
      snowCells('진눈깨비', '약한 눈', '비눈 경계', '1° · 40%', '0° · 0.6mm', '1° · 약함'),
      snowCells('눈 가능', '눈', '진눈깨비', '0° · 55%', '-1° · 1.1mm', '0° · 약함'),
      snowCells('흐림', '눈 약함', '구름 많음', '1° · 25%', '0° · 0.3mm', '1° · 정체'),
    ]);
  }

  if (weather === '안개') {
    return createRows(['지금', '1시간 뒤', '3시간 뒤'], [
      fogCells('안개', '흐림', '바람 약함', '19° · 습도 높음', '18° · 약풍', '19° · 정체'),
      fogCells('안개 유지', '박무', '정체 지속', '19° · 시야 낮음', '19° · 습함', '19° · 약풍'),
      fogCells('흐림', '흐림', '구름', '21° · 완화', '20° · 시야 회복', '21° · 이동'),
    ]);
  }

  return createRows(['지금', '1시간 뒤', '3시간 뒤', '6시간 뒤', '9시간 뒤', '12시간 뒤', '15시간 뒤', '18시간 뒤'], [
    rainCells('흐림', '비 없음', '구름 약함', '27° · 20%', '26° · 0.1mm', '27° · 북동풍'),
    rainCells('흐림', '흐림', '구름', '27° · 30%', '27° · 0.2mm', '26° · 동풍'),
    rainCells('소나기', '약한 비', '비구름 접근', '25° · 50%', '24° · 0.8mm', '25° · 이동'),
    rainCells('흐림', '비 약함', '흐림', '24° · 40%', '23° · 0.4mm', '24° · 약함'),
    rainCells('비', '흐림', '비 약함', '23° · 55%', '22° · 0.2mm', '23° · 남풍'),
    rainCells('구름', '비 없음', '구름', '22° · 20%', '21° · 0mm', '22° · 약풍'),
    rainCells('맑음', '맑음', '구름 약함', '25° · 10%', '24° · 0mm', '25° · 약풍'),
    rainCells('흐림', '비 없음', '맑음', '26° · 25%', '25° · 0mm', '26° · 북풍'),
  ]);
}

function getDailyCompareRows(weather: string): CompareRow[] {
  const labels = createDailyLabels();

  if (weather === '눈') {
    return createRows(labels.slice(0, 5), [
      snowCells('진눈깨비', '약한 눈', '비눈 경계', '0/3° · 45%', '-1/2° · 1.2mm', '0/3° · 약함'),
      snowCells('눈', '눈 약함', '흐림', '-2/2° · 60%', '-3/1° · 0.9mm', '-1/2° · 약풍'),
      snowCells('맑음', '맑음', '맑음', '-2/5° · 10%', '-3/4° · 0mm', '-2/5° · 북풍'),
      snowCells('흐림', '구름', '구름', '-1/4° · 20%', '-2/3° · 0mm', '-1/4° · 약풍'),
      snowCells('비눈 경계', '진눈깨비', '흐림', '1/5° · 35%', '0/4° · 0.4mm', '1/5° · 정체'),
    ]);
  }

  return createRows(labels, [
    rainCells(weather === '천둥번개' ? '소나기' : '흐림', '구름', weather === '안개' ? '정체' : '구름 약함', '24/28° · 30%', '23/27° · 0.3mm', '24/28° · 약함'),
    rainCells(weather === '천둥번개' ? '천둥 가능' : '비', '약한 비', '비구름', '23/26° · 60%', '22/25° · 1.4mm', '23/26° · 통과'),
    rainCells('소나기', '흐림', '대기 불안정', '25/31° · 45%', '24/30° · 0.6mm', '25/31° · 구름'),
    rainCells('맑음', '맑음', '구름 약함', '23/29° · 10%', '22/28° · 0mm', '23/29° · 약풍'),
    rainCells('흐림', '구름', '비구름 접근', '24/30° · 30%', '23/29° · 0.2mm', '24/30° · 남서풍'),
    rainCells('비', '약한 비', '흐림', '23/27° · 55%', '22/26° · 1.0mm', '23/27° · 서풍'),
    rainCells('맑음', '맑음', '맑음', '22/29° · 10%', '21/28° · 0mm', '22/29° · 약풍'),
    rainCells('구름', '맑음', '구름 약함', '23/30° · 20%', '22/29° · 0mm', '23/30° · 약풍'),
  ]);
}

function createRows(labels: string[], cells: ServiceTriplet[]): CompareRow[] {
  return labels.map((label, index) => ({
    label,
    ...(cells[index] ?? cells[cells.length - 1]),
  }));
}

function rainCells(kmaWeather: string, yrWeather: string, windyWeather: string, kmaDetail: string, yrDetail: string, windyDetail: string): ServiceTriplet {
  return {
    kma: { mark: 'K', weather: kmaWeather, detail: kmaDetail, tone: pickTone(kmaWeather) },
    yr: { mark: 'Yr', weather: yrWeather, detail: yrDetail, tone: pickTone(yrWeather) },
    windy: { mark: 'FMI', weather: windyWeather, detail: windyDetail, tone: pickTone(windyWeather) },
  };
}

function thunderCells(kmaWeather: string, yrWeather: string, windyWeather: string, kmaDetail: string, yrDetail: string, windyDetail: string) {
  return rainCells(kmaWeather, yrWeather, windyWeather, kmaDetail, yrDetail, windyDetail);
}

function snowCells(kmaWeather: string, yrWeather: string, windyWeather: string, kmaDetail: string, yrDetail: string, windyDetail: string) {
  return rainCells(kmaWeather, yrWeather, windyWeather, kmaDetail, yrDetail, windyDetail);
}

function fogCells(kmaWeather: string, yrWeather: string, windyWeather: string, kmaDetail: string, yrDetail: string, windyDetail: string) {
  return rainCells(kmaWeather, yrWeather, windyWeather, kmaDetail, yrDetail, windyDetail);
}

function pickTone(weather: string) {
  if (weather.includes('천둥') || weather.includes('불안정')) return tones.thunder;
  if (weather.includes('비') || weather.includes('강수')) return tones.rain;
  if (weather.includes('소나기')) return tones.shower;
  if (weather.includes('맑') || weather.includes('비 없음')) return tones.sun;
  if (weather.includes('흐') || weather.includes('정체')) return tones.gray;
  return tones.cloud;
}

function createDailyLabels() {
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  const today = new Date();

  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
    const day = names[date.getDay()];

    if (index === 0) return `오늘\n${monthDay}(${day})`;
    if (index === 1) return `내일\n${monthDay}(${day})`;
    if (index === 2) return `모레\n${monthDay}(${day})`;

    return `${monthDay}\n${day}요일`;
  });
}
