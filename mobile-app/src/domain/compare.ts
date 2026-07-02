import type { CompareRow, SearchContext } from '../types/weather';

export type CompareMode = 'hourly' | 'daily';

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
  if (mode === 'daily') return getDailyCompareRows(weather);

  if (weather === '천둥번개') {
    return [
      {
        label: '지금',
        kma: { mark: '비', weather: '소나기', detail: '24도 · 45%', tone: '#f6c453' },
        yr: { mark: '흐', weather: '흐림', detail: '23도 · 0.4mm', tone: '#64748b' },
        windy: { mark: '번', weather: '대기 불안정', detail: '24도 · 남서풍', tone: '#3a1f4d' },
      },
      {
        label: '1시간 뒤',
        kma: { mark: '번', weather: '천둥 가능', detail: '24도 · 55%', tone: '#3a1f4d' },
        yr: { mark: '비', weather: '약한 비', detail: '23도 · 0.8mm', tone: '#65a6ff' },
        windy: { mark: '번', weather: '강한 구름대', detail: '24도 · 접근', tone: '#3a1f4d' },
      },
      {
        label: '3시간 뒤',
        kma: { mark: '흐', weather: '흐림', detail: '23도 · 35%', tone: '#64748b' },
        yr: { mark: '비', weather: '비 약함', detail: '22도 · 0.5mm', tone: '#65a6ff' },
        windy: { mark: '구', weather: '구름 통과', detail: '23도 · 동쪽 이동', tone: '#8cc9ff' },
      },
    ];
  }

  if (weather === '눈') {
    return [
      {
        label: '지금',
        kma: { mark: '진', weather: '진눈깨비', detail: '1도 · 40%', tone: '#8cc9ff' },
        yr: { mark: '눈', weather: '약한 눈', detail: '0도 · 0.6mm', tone: '#65a6ff' },
        windy: { mark: '비', weather: '비/눈 경계', detail: '1도 · 남풍', tone: '#f6c453' },
      },
      {
        label: '1시간 뒤',
        kma: { mark: '눈', weather: '눈 가능', detail: '0도 · 55%', tone: '#65a6ff' },
        yr: { mark: '눈', weather: '눈', detail: '-1도 · 1.1mm', tone: '#65a6ff' },
        windy: { mark: '진', weather: '진눈깨비', detail: '0도 · 약함', tone: '#8cc9ff' },
      },
      {
        label: '3시간 뒤',
        kma: { mark: '흐', weather: '흐림', detail: '1도 · 25%', tone: '#64748b' },
        yr: { mark: '눈', weather: '눈 약함', detail: '0도 · 0.3mm', tone: '#65a6ff' },
        windy: { mark: '흐', weather: '구름 많음', detail: '1도 · 정체', tone: '#64748b' },
      },
    ];
  }

  if (weather === '안개') {
    return [
      {
        label: '지금',
        kma: { mark: '안', weather: '안개', detail: '19도 · 습도 높음', tone: '#64748b' },
        yr: { mark: '흐', weather: '흐림', detail: '18도 · 약풍', tone: '#8cc9ff' },
        windy: { mark: '정', weather: '바람 약함', detail: '19도 · 정체', tone: '#f6c453' },
      },
      {
        label: '1시간 뒤',
        kma: { mark: '안', weather: '안개 유지', detail: '19도 · 시야 낮음', tone: '#64748b' },
        yr: { mark: '안', weather: '박무', detail: '19도 · 습함', tone: '#64748b' },
        windy: { mark: '정', weather: '정체 지속', detail: '19도 · 약풍', tone: '#f6c453' },
      },
      {
        label: '3시간 뒤',
        kma: { mark: '흐', weather: '흐림', detail: '21도 · 완화', tone: '#8cc9ff' },
        yr: { mark: '흐', weather: '흐림', detail: '20도 · 시야 회복', tone: '#8cc9ff' },
        windy: { mark: '구', weather: '구름', detail: '21도 · 이동', tone: '#8cc9ff' },
      },
    ];
  }

  return [
    {
      label: '지금',
      kma: { mark: '흐', weather: '흐림', detail: '27도 · 20%', tone: '#64748b' },
      yr: { mark: '맑', weather: '비 없음', detail: '26도 · 0.1mm', tone: '#f25a38' },
      windy: { mark: '구', weather: '구름 약함', detail: '27도 · 북동풍', tone: '#8cc9ff' },
    },
    {
      label: '1시간 뒤',
      kma: { mark: '흐', weather: '흐림', detail: '27도 · 30%', tone: '#64748b' },
      yr: { mark: '흐', weather: '흐림', detail: '27도 · 0.2mm', tone: '#64748b' },
      windy: { mark: '구', weather: '구름', detail: '26도 · 동풍', tone: '#8cc9ff' },
    },
    {
      label: '3시간 뒤',
      kma: { mark: '비', weather: '소나기', detail: '25도 · 50%', tone: '#f6c453' },
      yr: { mark: '비', weather: '약한 비', detail: '24도 · 0.8mm', tone: '#65a6ff' },
      windy: { mark: '비', weather: '비구름 접근', detail: '25도 · 이동', tone: '#65a6ff' },
    },
    {
      label: '6시간 뒤',
      kma: { mark: '흐', weather: '흐림', detail: '24도 · 40%', tone: '#64748b' },
      yr: { mark: '비', weather: '비 약함', detail: '23도 · 0.4mm', tone: '#65a6ff' },
      windy: { mark: '흐', weather: '흐림', detail: '24도 · 약함', tone: '#64748b' },
    },
    {
      label: '9시간 뒤',
      kma: { mark: '비', weather: '비', detail: '23도 · 55%', tone: '#65a6ff' },
      yr: { mark: '흐', weather: '흐림', detail: '22도 · 0.2mm', tone: '#64748b' },
      windy: { mark: '비', weather: '비 약함', detail: '23도 · 남풍', tone: '#65a6ff' },
    },
    {
      label: '12시간 뒤',
      kma: { mark: '구', weather: '구름', detail: '22도 · 20%', tone: '#8cc9ff' },
      yr: { mark: '맑', weather: '비 없음', detail: '21도 · 0mm', tone: '#f25a38' },
      windy: { mark: '구', weather: '구름', detail: '22도 · 약풍', tone: '#8cc9ff' },
    },
    {
      label: '15시간 뒤',
      kma: { mark: '맑', weather: '맑음', detail: '25도 · 10%', tone: '#f25a38' },
      yr: { mark: '맑', weather: '맑음', detail: '24도 · 0mm', tone: '#f25a38' },
      windy: { mark: '구', weather: '구름 약함', detail: '25도 · 약풍', tone: '#8cc9ff' },
    },
    {
      label: '18시간 뒤',
      kma: { mark: '흐', weather: '흐림', detail: '26도 · 25%', tone: '#64748b' },
      yr: { mark: '맑', weather: '비 없음', detail: '25도 · 0mm', tone: '#f25a38' },
      windy: { mark: '맑', weather: '맑음', detail: '26도 · 북풍', tone: '#f25a38' },
    },
  ];
}

function getDailyCompareRows(weather: string): CompareRow[] {
  if (weather === '눈') {
    return [
      {
        label: '오늘',
        kma: { mark: '진', weather: '진눈깨비', detail: '0/3도 · 45%', tone: '#8cc9ff' },
        yr: { mark: '눈', weather: '약한 눈', detail: '-1/2도 · 1.2mm', tone: '#65a6ff' },
        windy: { mark: '비', weather: '비/눈 경계', detail: '0/3도 · 약함', tone: '#f6c453' },
      },
      {
        label: '내일',
        kma: { mark: '눈', weather: '눈', detail: '-2/2도 · 60%', tone: '#65a6ff' },
        yr: { mark: '눈', weather: '눈 약함', detail: '-3/1도 · 0.9mm', tone: '#65a6ff' },
        windy: { mark: '흐', weather: '흐림', detail: '-1/2도 · 약풍', tone: '#64748b' },
      },
      {
        label: '모레',
        kma: { mark: '맑', weather: '맑음', detail: '-2/5도 · 10%', tone: '#f25a38' },
        yr: { mark: '맑', weather: '맑음', detail: '-3/4도 · 0mm', tone: '#f25a38' },
        windy: { mark: '맑', weather: '맑음', detail: '-2/5도 · 북풍', tone: '#f25a38' },
      },
    ];
  }

  return [
    {
      label: '오늘',
      kma: { mark: '흐', weather: weather === '천둥번개' ? '소나기' : '흐림', detail: '24/28도 · 30%', tone: '#64748b' },
      yr: { mark: '구', weather: '구름', detail: '23/27도 · 0.3mm', tone: '#8cc9ff' },
      windy: { mark: '구', weather: weather === '안개' ? '정체' : '구름 약함', detail: '24/28도 · 약함', tone: '#8cc9ff' },
    },
    {
      label: '내일',
      kma: { mark: '비', weather: weather === '천둥번개' ? '천둥 가능' : '비', detail: '23/26도 · 60%', tone: '#65a6ff' },
      yr: { mark: '비', weather: '약한 비', detail: '22/25도 · 1.4mm', tone: '#65a6ff' },
      windy: { mark: '비', weather: '비구름', detail: '23/26도 · 통과', tone: '#65a6ff' },
    },
    {
      label: '주말',
      kma: { mark: '비', weather: '소나기', detail: '25/31도 · 45%', tone: '#f6c453' },
      yr: { mark: '흐', weather: '흐림', detail: '24/30도 · 0.6mm', tone: '#64748b' },
      windy: { mark: '번', weather: '대기 불안정', detail: '25/31도 · 구름', tone: '#3a1f4d' },
    },
    {
      label: '월요일',
      kma: { mark: '맑', weather: '맑음', detail: '23/29도 · 10%', tone: '#f25a38' },
      yr: { mark: '맑', weather: '맑음', detail: '22/28도 · 0mm', tone: '#f25a38' },
      windy: { mark: '구', weather: '구름 약함', detail: '23/29도 · 약풍', tone: '#8cc9ff' },
    },
    {
      label: '화요일',
      kma: { mark: '흐', weather: '흐림', detail: '24/30도 · 30%', tone: '#64748b' },
      yr: { mark: '구', weather: '구름', detail: '23/29도 · 0.2mm', tone: '#8cc9ff' },
      windy: { mark: '비', weather: '비구름 접근', detail: '24/30도 · 남서', tone: '#65a6ff' },
    },
    {
      label: '수요일',
      kma: { mark: '비', weather: '비', detail: '23/27도 · 55%', tone: '#65a6ff' },
      yr: { mark: '비', weather: '약한 비', detail: '22/26도 · 1.0mm', tone: '#65a6ff' },
      windy: { mark: '흐', weather: '흐림', detail: '23/27도 · 서풍', tone: '#64748b' },
    },
    {
      label: '목요일',
      kma: { mark: '맑', weather: '맑음', detail: '22/29도 · 10%', tone: '#f25a38' },
      yr: { mark: '맑', weather: '맑음', detail: '21/28도 · 0mm', tone: '#f25a38' },
      windy: { mark: '맑', weather: '맑음', detail: '22/29도 · 약풍', tone: '#f25a38' },
    },
    {
      label: '금요일',
      kma: { mark: '구', weather: '구름', detail: '23/30도 · 20%', tone: '#8cc9ff' },
      yr: { mark: '맑', weather: '맑음', detail: '22/29도 · 0mm', tone: '#f25a38' },
      windy: { mark: '구', weather: '구름 약함', detail: '23/30도 · 약풍', tone: '#8cc9ff' },
    },
  ];
}
