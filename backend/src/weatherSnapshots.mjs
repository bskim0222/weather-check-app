import { fetchKmaShortForecast, shouldUseKmaProvider } from './providers/kmaShortForecast.mjs';
import { fetchFmiEcmwfForecast, shouldUseFmiProvider } from './providers/fmiEcmwfForecast.mjs';
import { fetchWindyPointForecast, shouldUseWindyProvider } from './providers/windyPointForecast.mjs';
import { fetchYrLocationforecast, shouldUseYrProvider } from './providers/yrLocationforecast.mjs';
import {
  formatDailyKeyLabel,
  formatHourlyKeyLabel,
  getDailyForecastKey,
  getHourlyForecastKey,
} from './forecastKeys.mjs';
import { getTargetTimestampMs } from './timeIntent.mjs';

const providerColors = {
  kma: '#e6465f',
  yr: '#65a6ff',
  windy: '#f6c453',
  fmi: '#7f9f8d',
};

const snapshotCacheTtlMs = 2 * 60 * 1000;
const snapshotCache = new Map();

export async function createWeatherProviderSnapshot(context) {
  const cacheKey = createSnapshotCacheKey(context);
  const cached = snapshotCache.get(cacheKey);
  const now = Date.now();

  if (cached?.snapshot && cached.expiresAt > now) return cached.snapshot;
  if (cached?.pending) return cached.pending;

  const pending = createWeatherProviderSnapshotUncached(context);
  snapshotCache.set(cacheKey, { pending, expiresAt: now + snapshotCacheTtlMs });

  try {
    const snapshot = await pending;
    if (isCompleteConfiguredSnapshot(snapshot)) {
      snapshotCache.set(cacheKey, {
        snapshot,
        expiresAt: Date.now() + snapshotCacheTtlMs,
      });
      trimSnapshotCache();
    } else {
      snapshotCache.delete(cacheKey);
    }
    return snapshot;
  } catch (error) {
    snapshotCache.delete(cacheKey);
    throw error;
  }
}

function isCompleteConfiguredSnapshot(snapshot) {
  if (snapshot.source !== 'api') return false;

  const expectedProviderIds = [
    ...(shouldUseKmaProvider() ? ['kma'] : []),
    ...(shouldUseYrProvider() ? ['yr'] : []),
    ...(shouldUseFmiProvider() ? ['fmi'] : []),
    ...(shouldUseWindyProvider() && !shouldUseFmiProvider() ? ['windy'] : []),
  ];
  const liveProviderIds = new Set(snapshot.meta?.liveProviderIds ?? []);

  return expectedProviderIds.length > 0
    && expectedProviderIds.every((providerId) => liveProviderIds.has(providerId));
}

async function createWeatherProviderSnapshotUncached(context) {
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
  const hasLiveForecast = liveProviderIds.length > 0;
  const unavailable = createUnavailableWeather();
  const resolvedWeather = {
    ...weather,
    kma: kmaForecast?.current ?? (hasLiveForecast ? unavailable : weather.kma),
    yr: yrForecast?.current ?? (hasLiveForecast ? unavailable : weather.yr),
    windy: thirdForecast?.current ?? (hasLiveForecast ? unavailable : weather.windy),
    ...(thirdProvider.providerId === 'fmi'
      ? { fmi: thirdForecast?.current ?? (hasLiveForecast ? unavailable : weather.fmi ?? weather.windy) }
      : {}),
  };

  const snapshot = {
    ...createBaseWeatherProviderSnapshot(context, resolvedWeather, thirdProvider),
    source: hasLiveForecast ? 'api' : 'mock',
    meta: createProviderMeta(thirdProvider.providerId, liveProviderIds, fallbackProviderIds),
  };

  if (!kmaForecast && !yrForecast && !thirdForecast) return snapshot;

  const targetTimestampMs = getTargetTimestampMs(context);
  const hourlyMinimumKey = getHourlyForecastKey(
    Number.isFinite(targetTimestampMs) ? new Date(targetTimestampMs) : new Date(),
  );

  return {
    ...snapshot,
    hourlyRows: mergeForecastRows(snapshot.hourlyRows, {
      kma: kmaForecast?.hourlyRows,
      yr: yrForecast?.hourlyRows,
      [thirdProvider.providerId]: thirdForecast?.hourlyRows,
    }, 'hourly', thirdProvider.providerId, {
      minimumKey: hourlyMinimumKey,
      currentRowsById: {
        kma: kmaForecast?.current,
        yr: yrForecast?.current,
        [thirdProvider.providerId]: thirdForecast?.current,
      },
    }),
    dailyRows: mergeForecastRows(snapshot.dailyRows, {
      kma: kmaForecast?.dailyRows,
      yr: yrForecast?.dailyRows,
      [thirdProvider.providerId]: thirdForecast?.dailyRows,
    }, 'daily', thirdProvider.providerId),
  };
}

function createSnapshotCacheKey(context) {
  const target = context?.target ?? {};
  const latitude = Number.isFinite(target.latitude) ? Number(target.latitude).toFixed(4) : '';
  const longitude = Number.isFinite(target.longitude) ? Number(target.longitude).toFixed(4) : '';

  return [
    latitude,
    longitude,
    context?.place ?? '',
    context?.timeLabel ?? '',
    context?.raw ?? '',
    process.env.WEATHER_PROVIDER_MODE ?? '',
  ].join('|');
}

function trimSnapshotCache() {
  if (snapshotCache.size <= 200) return;
  const now = Date.now();

  for (const [key, value] of snapshotCache) {
    if (!value.pending && value.expiresAt <= now) snapshotCache.delete(key);
  }

  while (snapshotCache.size > 200) {
    const oldestKey = snapshotCache.keys().next().value;
    if (oldestKey == null) break;
    snapshotCache.delete(oldestKey);
  }
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

  return resolveProviderWithRetry('Yr.no', () => fetchYrLocationforecast(context));
}

async function resolveKmaForecast(context) {
  if (!shouldUseKmaProvider()) return null;

  return resolveProviderWithRetry('KMA', () => fetchKmaShortForecast(context));
}

async function resolveWindyForecast(context) {
  if (!shouldUseWindyProvider()) return null;

  return resolveProviderWithRetry('Windy', () => fetchWindyPointForecast(context));
}

async function resolveFmiForecast(context) {
  if (!shouldUseFmiProvider()) return null;

  return resolveProviderWithRetry('FMI', () => fetchFmiEcmwfForecast(context));
}

async function resolveProviderWithRetry(providerName, fetchProvider) {
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await fetchProvider();
    } catch (error) {
      lastError = error;
      if (attempt === 1) await delay(250);
    }
  }

  console.warn(lastError instanceof Error ? lastError.message : `${providerName} request failed.`);
  return null;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function mergeForecastRows(
  baseRows,
  providerRowsById,
  mode,
  thirdProviderId = 'fmi',
  options = {},
) {
  const rowKey = mode === 'daily' ? getDailyRowKey : getHourlyRowKey;
  const providerIds = ['kma', 'yr', thirdProviderId];
  const maps = Object.fromEntries(providerIds.map((providerId) => {
    const rows = Array.isArray(providerRowsById?.[providerId]) ? providerRowsById[providerId] : [];
    return [providerId, new Map(rows.map((row) => [rowKey(row), row]).filter(([key]) => key))];
  }));
  const minimumKey = mode === 'hourly' ? String(options.minimumKey ?? '') : '';

  if (minimumKey) {
    providerIds.forEach((providerId) => {
      const currentRow = createCurrentForecastRow(options.currentRowsById?.[providerId]);
      if (currentRow) maps[providerId].set(minimumKey, currentRow);
    });
  }

  const keys = [...new Set(providerIds.flatMap((providerId) => [...maps[providerId].keys()]))]
    .filter((key) => !minimumKey || key >= minimumKey)
    .sort()
    .slice(0, mode === 'daily' ? 10 : 18);

  if (keys.length === 0) return baseRows;

  return keys.map((key, index) => {
    const kma = createProviderCell(maps.kma.get(key));
    const yr = createProviderCell(maps.yr.get(key));
    const third = createProviderCell(maps[thirdProviderId].get(key));

    return {
      forecastKey: mode === 'hourly' ? key : undefined,
      periodKey: mode === 'daily' ? key : undefined,
      label: mode === 'daily' ? formatDailyKeyLabel(key, index) : formatHourlyKeyLabel(key),
      kma,
      yr,
      windy: third,
      ...(thirdProviderId === 'fmi' ? { fmi: third } : {}),
    };
  });
}

function getHourlyRowKey(row) {
  return row?.forecastKey || getHourlyForecastKey(row?.forecastAt);
}

function getDailyRowKey(row) {
  return row?.periodKey || getDailyForecastKey(row?.forecastAt);
}

function createProviderCell(providerRow) {
  if (!providerRow) return createUnavailableCell();

  return {
    mark: providerRow.mark,
    weather: providerRow.weather,
    detail: providerRow.detail,
    tone: providerRow.tone,
    morning: providerRow.morning,
    afternoon: providerRow.afternoon,
  };
}

function createCurrentForecastRow(weather) {
  if (!weather?.condition) return null;

  return {
    mark: weather.mark ?? String(weather.condition).slice(0, 1),
    weather: weather.condition,
    detail: [weather.temp, weather.detail].filter(Boolean).join(' · '),
    tone: weather.tone,
  };
}

function createUnavailableCell() {
  return {
    mark: '-',
    weather: '자료 없음',
    detail: '해당 시각 제공값 없음',
    tone: '#9ca3af',
  };
}

function createUnavailableWeather() {
  return {
    condition: '자료 없음',
    temp: '--°C',
    detail: '실시간 예보를 불러오지 못했어요',
    badge: '확인 필요',
    value: '--',
    mark: '-',
    tone: '#9ca3af',
  };
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
      ? createDailyCompareLabels(10)
      : createHourlyCompareLabels(18);

  return labels.map((label, index) => ({
    label,
    kma: createCell(weather.kma, index),
    yr: createCell(weather.yr, index),
    windy: createCell(weather.windy, index),
    fmi: createCell(weather.fmi ?? weather.windy, index),
  }));
}

function createHourlyCompareLabels(count) {
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return '지금';

    return `${index}시간 뒤`;
  });
}

function createDailyCompareLabels(count) {
  const today = new Date();

  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return '오늘';
    if (index === 1) return '내일';
    if (index === 2) return '모레';

    const date = new Date(today);
    date.setDate(today.getDate() + index);

    return `${date.getMonth() + 1}/${date.getDate()}`;
  });
}

function createCell(weather, index) {
  const detail = `${weather.temp} · ${index === 0 ? weather.value : index < 3 ? '비슷함' : '변동'}`;

  return {
    mark: weather.condition.slice(0, 1),
    weather: weather.condition,
    detail,
    tone: '#64748b',
    morning: {
      weather: weather.condition,
      detail,
      mark: weather.condition.slice(0, 1),
      tone: '#64748b',
    },
    afternoon: {
      weather: weather.condition,
      detail,
      mark: weather.condition.slice(0, 1),
      tone: '#64748b',
    },
  };
}
