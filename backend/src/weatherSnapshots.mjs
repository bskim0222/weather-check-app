import { fetchKmaShortForecast, shouldUseKmaProvider } from './providers/kmaShortForecast.mjs';
import { fetchFmiEcmwfForecast, shouldUseFmiProvider } from './providers/fmiEcmwfForecast.mjs';
import { fetchWindyPointForecast, shouldUseWindyProvider } from './providers/windyPointForecast.mjs';
import { fetchYrLocationforecast, shouldUseYrProvider } from './providers/yrLocationforecast.mjs';

const providerColors = {
  kma: '#e6465f',
  yr: '#65a6ff',
  windy: '#f6c453',
  fmi: '#7f9f8d',
};

export async function createWeatherProviderSnapshot(context) {
  const weather = normalizeWeather(context?.detectedWeather);
  const [kmaForecast, yrForecast, fmiForecast, windyForecast] = await Promise.all([
    resolveKmaForecast(context),
    resolveYrForecast(context),
    resolveFmiForecast(context),
    resolveWindyForecast(context),
  ]);
  const thirdProvider = createThirdProvider(shouldUseFmiProvider() || !shouldUseWindyProvider() ? 'fmi' : 'windy');
  const thirdForecast = thirdProvider.providerId === 'fmi' ? fmiForecast : windyForecast;
  const liveProviderIds = [
    ...(kmaForecast ? ['kma'] : []),
    ...(yrForecast ? ['yr'] : []),
    ...(thirdForecast ? [thirdProvider.providerId] : []),
  ];
  const fallbackProviderIds = ['kma', 'yr', thirdProvider.providerId].filter(
    (providerId) => !liveProviderIds.includes(providerId),
  );
  const resolvedWeather = {
    ...weather,
    ...(kmaForecast ? { kma: kmaForecast.current } : {}),
    ...(yrForecast ? { yr: yrForecast.current } : {}),
    ...(thirdForecast ? { windy: thirdForecast.current } : {}),
  };

  const snapshot = {
    ...createBaseWeatherProviderSnapshot(context, resolvedWeather, thirdProvider),
    meta: createProviderMeta(thirdProvider.providerId, liveProviderIds, fallbackProviderIds),
  };

  if (!kmaForecast && !yrForecast && !thirdForecast) return snapshot;

  return {
    ...snapshot,
    hourlyRows: mergeProviderRows(
      mergeProviderRows(
        mergeProviderRows(snapshot.hourlyRows, 'kma', kmaForecast?.hourlyRows),
        'yr',
        yrForecast?.hourlyRows,
      ),
      'windy',
      thirdForecast?.hourlyRows,
    ),
    dailyRows: mergeProviderRows(
      mergeProviderRows(
        mergeProviderRows(snapshot.dailyRows, 'kma', kmaForecast?.dailyRows),
        'yr',
        yrForecast?.dailyRows,
      ),
      'windy',
      thirdForecast?.dailyRows,
    ),
  };
}

function createProviderMeta(thirdProviderId, liveProviderIds, fallbackProviderIds) {
  return {
    providerMode: process.env.WEATHER_PROVIDER_MODE ?? 'mock',
    liveProviderIds,
    fallbackProviderIds,
    thirdProviderId,
  };
}

function createBaseWeatherProviderSnapshot(context, weather, thirdProvider = createThirdProvider('fmi')) {
  return {
    generatedAt: new Date().toISOString(),
    source: 'api',
    context,
    sources: [
      createSource('kma', '대한민국 기상청', 'K', weather.kma, providerColors.kma),
      createSource('yr', '노르웨이 기상청', 'Yr', weather.yr, providerColors.yr),
      createSource(thirdProvider.providerId, thirdProvider.name, thirdProvider.mark, weather.windy, thirdProvider.color),
    ],
    summaries: [
      createSummary(context, '대한민국 기상청', 'K', 'KMA', weather.kma, providerColors.kma),
      createSummary(context, '노르웨이 기상청', 'Yr', 'MET Norway', weather.yr, providerColors.yr),
      createSummary(context, thirdProvider.name, thirdProvider.mark, thirdProvider.subtitle, weather.windy, thirdProvider.color),
    ],
    differences: [
      {
        name: '대한민국 기상청',
        mark: 'K',
        body: '국내 단기예보와 초단기 관측을 기준으로 현재 시간대의 강수 가능성을 확인합니다.',
        badge: '국내 예보',
        color: providerColors.kma,
      },
      {
        name: '노르웨이 기상청',
        mark: 'Yr',
        body: '강수량과 온도 흐름을 함께 보며 글로벌 모델의 시간 변화를 비교합니다.',
        badge: '글로벌 예보',
        color: providerColors.yr,
      },
      {
        name: thirdProvider.name,
        mark: thirdProvider.mark,
        body: thirdProvider.body,
        badge: thirdProvider.badge,
        color: thirdProvider.color,
      },
    ],
    hourlyRows: createCompareRows(weather, 'hourly'),
    dailyRows: createCompareRows(weather, 'daily'),
  };
}

function createThirdProvider(providerId) {
  if (providerId === 'fmi') {
    return {
      providerId: 'fmi',
      name: '핀란드 기상청',
      mark: 'FMI',
      subtitle: 'FMI',
      body: '핀란드 기상청이 공개한 ECMWF 기반 지점 예보로 같은 위치의 기온, 강수량, 구름량을 비교합니다.',
      badge: 'ECMWF 예보',
      color: providerColors.fmi,
    };
  }

  return {
    providerId: 'windy',
    name: 'Windy.com',
    mark: 'W',
    subtitle: 'ECMWF',
    body: '비구름 이동 방향과 바람 흐름이 현재 위치를 지나는지 봅니다.',
    badge: '구름 흐름',
    color: providerColors.windy,
  };
}

async function resolveYrForecast(context) {
  if (!shouldUseYrProvider()) return null;

  try {
    return await fetchYrLocationforecast(context);
  } catch (error) {
    console.warn(error instanceof Error ? error.message : 'Yr.no request failed.');
    return null;
  }
}

async function resolveKmaForecast(context) {
  if (!shouldUseKmaProvider()) return null;

  try {
    return await fetchKmaShortForecast(context);
  } catch (error) {
    console.warn(error instanceof Error ? error.message : 'KMA request failed.');
    return null;
  }
}

async function resolveWindyForecast(context) {
  if (!shouldUseWindyProvider()) return null;

  try {
    return await fetchWindyPointForecast(context);
  } catch (error) {
    console.warn(error instanceof Error ? error.message : 'Windy request failed.');
    return null;
  }
}

async function resolveFmiForecast(context) {
  if (!shouldUseFmiProvider()) return null;

  try {
    return await fetchFmiEcmwfForecast(context);
  } catch (error) {
    console.warn(error instanceof Error ? error.message : 'FMI request failed.');
    return null;
  }
}

function mergeProviderRows(baseRows, providerId, providerRows) {
  if (!Array.isArray(providerRows) || providerRows.length === 0) return baseRows;

  return baseRows.map((row, index) => {
    const providerRow = providerRows[index];

    if (!providerRow) return row;

    return {
      ...row,
      label: providerRow.label,
      [providerId]: {
        mark: providerRow.mark,
        weather: providerRow.weather,
        detail: providerRow.detail,
        tone: providerRow.tone,
      },
    };
  });
}

function createSource(providerId, name, mark, weather, color) {
  return {
    providerId,
    name,
    mark,
    condition: weather.condition,
    temp: weather.temp,
    detail: weather.detail,
    badge: weather.badge,
    color,
  };
}

function createSummary(context, name, mark, subtitle, weather, color) {
  const place = context?.place ?? '현재 위치';
  const timeLabel = context?.timeLabel ?? '지금';

  return {
    name,
    mark,
    subtitle,
    summary: `${place} · ${timeLabel} 기준으로 보고 있어요.`,
    weather: weather.condition,
    value: weather.value,
    color,
  };
}

function normalizeWeather(detectedWeather) {
  if (detectedWeather === '맑음') {
    return {
      kma: createWeather('구름 조금', '28℃', '현재 강수 신호가 거의 없어요.', '맑음', '10%'),
      yr: createWeather('맑음', '27℃', '강수량을 0mm에 가깝게 보고 있어요.', '건조', '0mm'),
      windy: createWeather('비구름 없음', '28℃', '구름대가 현재 위치를 벗어나 있어요.', '안정', '약함'),
    };
  }

  if (detectedWeather === '천둥번개') {
    return {
      kma: createWeather('소나기', '24℃', '대기 불안정 신호가 일부 있어요.', '주의', '55%'),
      yr: createWeather('약한 비', '23℃', '짧은 비 가능성을 낮게 봅니다.', '약한 비', '0.8mm'),
      windy: createWeather('대기 불안정', '24℃', '구름 발달 가능성이 보입니다.', '불안정', '국지'),
    };
  }

  if (detectedWeather === '눈') {
    return {
      kma: createWeather('눈 약함', '-1℃', '낮은 기온과 약한 강수 신호가 있어요.', '눈', '40%'),
      yr: createWeather('진눈깨비', '0℃', '비와 눈이 섞일 가능성을 봅니다.', '혼합', '0.5mm'),
      windy: createWeather('눈구름', '-1℃', '찬 공기와 구름대가 겹쳐 있어요.', '눈구름', '약함'),
    };
  }

  if (detectedWeather === '안개') {
    return {
      kma: createWeather('안개', '19℃', '습도가 높고 시정이 낮을 수 있어요.', '안개', '주의'),
      yr: createWeather('흐림', '18℃', '강수보다 습한 흐림 신호가 강해요.', '습함', '0mm'),
      windy: createWeather('낮은 구름', '19℃', '낮은 구름층이 머물 가능성이 있어요.', '구름', '정체'),
    };
  }

  return {
    kma: createWeather('비 약함', '23℃', '현재 강수 신호가 있고 1시간 안에 이어질 수 있어요.', '비', '50%'),
    yr: createWeather('흐림', '22℃', '강수량은 작지만 구름대가 걸쳐 있어요.', '흐림', '0.4mm'),
    windy: createWeather('비구름 접근', '23℃', '남서쪽 비구름 흐름이 접근 중이에요.', '접근', '남서풍'),
  };
}

function createWeather(condition, temp, detail, badge, value) {
  return { condition, temp, detail, badge, value };
}

function createCompareRows(weather, mode) {
  const labels =
    mode === 'daily'
      ? ['오늘', '내일', '모레', '목요일', '금요일', '토요일']
      : ['지금', '1시간 뒤', '3시간 뒤', '6시간 뒤', '9시간 뒤', '12시간 뒤'];

  return labels.map((label, index) => ({
    label,
    kma: createCell(weather.kma, index),
    yr: createCell(weather.yr, index),
    windy: createCell(weather.windy, index),
  }));
}

function createCell(weather, index) {
  return {
    mark: weather.condition.slice(0, 1),
    weather: weather.condition,
    detail: `${weather.temp} · ${index === 0 ? weather.value : index < 3 ? '비슷함' : '변동'}`,
    tone: '#64748b',
  };
}
