import type { LocalReport, SearchContext } from '../types/weather';
import { resolveReportPlace } from './search';

export function inferConditionFromText(text: string) {
  if (text.includes('천둥') || text.includes('번개')) return '천둥';
  if (text.includes('눈')) return '눈';
  if (text.includes('안개')) return '안개';
  if (text.includes('비 안') || text.includes('안 와') || text.includes('안와')) return '비 없음';
  if (text.includes('비')) return '비';
  if (text.includes('흐')) return '흐림';
  if (text.includes('맑')) return '맑음';

  return '확인';
}

export function orderReportsBySearchContext(reports: LocalReport[], searchContext: SearchContext) {
  if (searchContext.place === '현재 위치') return reports;

  const related = reports.filter((report) => report.place.includes(searchContext.place));
  const others = reports.filter((report) => !report.place.includes(searchContext.place));

  return related.length > 0 ? [...related, ...others] : reports;
}

export function buildMapContextReports(searchContext: SearchContext): LocalReport[] {
  const place = resolveReportPlace(searchContext.place);
  const weather = searchContext.detectedWeather;

  if (weather === '눈') {
    return [
      {
        place,
        time: '방금',
        condition: '진눈깨비',
        body: '바닥은 젖어 있고 차가운 비와 눈이 섞여 보인다는 제보가 필요해요.',
      },
      {
        place: `${place} 북쪽`,
        time: '5분 전',
        condition: '눈',
        body: '기온 경계라 같은 동네 안에서도 비와 눈 판단이 갈릴 수 있어요.',
      },
    ];
  }

  if (weather === '천둥번개') {
    return [
      {
        place,
        time: '방금',
        condition: '천둥',
        body: '짧고 강한 구름대가 지나가는지 현장 소리 제보가 중요해요.',
      },
      {
        place: `${place} 동쪽`,
        time: '4분 전',
        condition: '소나기',
        body: '비가 오락가락할 수 있어 우산보다 실내 대기 판단이 중요해요.',
      },
    ];
  }

  if (weather === '안개') {
    return [
      {
        place,
        time: '방금',
        condition: '안개',
        body: '시야가 얼마나 막히는지, 도로와 산책로 제보를 우선해서 봐야 해요.',
      },
      {
        place: `${place} 주변`,
        time: '6분 전',
        condition: '박무',
        body: '바람이 약하면 안개가 오래 머물 수 있어요.',
      },
    ];
  }

  return [
    {
      place,
      time: '방금',
      condition: weather,
      body: `${searchContext.timeLabel} 기준 ${weather} 여부를 확인할 현장 글이 더 필요해요.`,
    },
  ];
}

export function buildReportPromptRows(searchContext: SearchContext): LocalReport[] {
  const place = resolveReportPlace(searchContext.place);

  if (searchContext.detectedWeather === '눈') {
    return [
      {
        place,
        time: '확인 필요',
        condition: '눈',
        body: '비인지 눈인지 갈리는 시간대라 현장 제보가 필요해요.',
      },
    ];
  }

  if (searchContext.detectedWeather === '천둥번개') {
    return [
      {
        place,
        time: '확인 필요',
        condition: '천둥',
        body: '천둥 소리나 갑자기 굵어진 비 제보가 판정에 크게 도움이 돼요.',
      },
    ];
  }

  if (searchContext.detectedWeather === '안개') {
    return [
      {
        place,
        time: '확인 필요',
        condition: '안개',
        body: '시야가 어느 정도 막히는지 한 줄 제보가 필요해요.',
      },
    ];
  }

  return [
    {
      place,
      time: '확인 필요',
      condition: searchContext.detectedWeather,
      body: `${searchContext.timeLabel} 기준 실제 날씨 제보를 기다리고 있어요.`,
    },
  ];
}
