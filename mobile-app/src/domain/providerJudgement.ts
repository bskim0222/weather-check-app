import { weatherPresets } from '../data/mockWeather';
import { getThirdProviderCell } from './providerRows';
import type { WeatherProviderSnapshot } from '../services/weatherProviders';
import type { CompareForecastCell, ForecastSource, ForecastStep, WeatherKey, WeatherPreset } from '../types/weather';

type WeatherVote = {
  key: WeatherKey;
  label: string;
};

type VoteStats = {
  consensus: WeatherVote;
  agreeingCount: number;
  totalCount: number;
  uniqueKeys: WeatherKey[];
  hasWarningSignal: boolean;
};

type ProviderCellEntry = {
  cell: CompareForecastCell;
  index: number;
};

const FALLBACK_VOTE: WeatherVote = { key: 'cloudy', label: '흐림' };

const WARNING_KEYS = new Set<WeatherKey>(['typhoon', 'thunder', 'heat', 'dust', 'snow', 'shower']);

const WEATHER_LABELS: Record<WeatherKey, string> = {
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

export function createProviderAdjustedPreset(
  basePreset: WeatherPreset,
  providerSnapshot: WeatherProviderSnapshot,
): WeatherPreset {
  const currentEntries = getCurrentProviderEntries(providerSnapshot);
  const currentCells = currentEntries
    .filter(({ cell }) => isUsableForecastCell(cell))
    .map(({ cell }) => cell);
  const voteStats = getVoteStats(currentCells) ?? {
    consensus: getWeatherVote(basePreset.condition),
    agreeingCount: 0,
    totalCount: 0,
    uniqueKeys: [],
    hasWarningSignal: false,
  };
  const visualPreset = weatherPresets[voteStats.consensus.key] ?? weatherPresets.cloudy;
  const temp = getAverageTemperatureFromCells(currentCells) ?? basePreset.temp;
  const sources = createSyncedSources(
    currentEntries,
    providerSnapshot.sources,
    providerSnapshot.summaries,
    providerSnapshot.source === 'api',
  );
  const copy = createSummaryCopy(sources.filter(isUsableForecastSource), voteStats);

  return {
    ...basePreset,
    bg: visualPreset.bg,
    accent: visualPreset.accent,
    accentInk: visualPreset.accentInk,
    glyph: visualPreset.glyph,
    condition: voteStats.consensus.label,
    temp,
    level: copy.level,
    live: '제보 확인',
    title: copy.title,
    summary: copy.summary,
    signal: copy.signal,
    sources,
    forecastLead: createForecastLead(providerSnapshot.hourlyRows),
    forecastRows: createForecastRows(
      providerSnapshot.hourlyRows,
      visualPreset.forecastRows,
      providerSnapshot.source === 'api',
    ),
  };
}

function getCurrentProviderEntries(providerSnapshot: WeatherProviderSnapshot): ProviderCellEntry[] {
  const firstRow = providerSnapshot.hourlyRows[0];

  if (!firstRow) return [];

  return [firstRow.kma, firstRow.yr, getThirdProviderCell(firstRow)].map((cell, index) => ({ cell, index }));
}

function createSyncedSources(
  entries: ProviderCellEntry[],
  fallbackSources: ForecastSource[],
  summaries: WeatherProviderSnapshot['summaries'],
  isLiveSnapshot: boolean,
): ForecastSource[] {
  return entries.map(({ cell, index }) => {
    const summary = summaries[index];
    const fallback = fallbackSources[index];

    return {
      providerId: fallback?.providerId,
      iconUri: fallback?.iconUri,
      name: summary?.name ?? fallback?.name ?? getFallbackProviderName(index),
      mark: summary?.mark ?? fallback?.mark ?? cell.mark,
      condition: cell.weather,
      temp: getTemperatureFromDetail(cell.detail) ?? (isLiveSnapshot ? '--' : fallback?.temp ?? '--'),
      detail: cell.detail,
      badge: fallback?.badge ?? summary?.summary ?? cell.weather,
      color: summary?.color ?? fallback?.color ?? '#222222',
    };
  });
}

function getFallbackProviderName(index: number) {
  if (index === 0) return '대한민국 기상청';
  if (index === 1) return '노르웨이 기상청';

  return '핀란드 기상청';
}

function getWeatherVote(condition: string): WeatherVote {
  const value = condition.toLowerCase();

  if (includesAny(value, ['태풍', 'typhoon', 'cyclone'])) return { key: 'typhoon', label: '태풍' };
  if (includesAny(value, ['폭염', '무더위', '고온', 'heatwave', 'hot'])) return { key: 'heat', label: '폭염' };
  if (includesAny(value, ['황사', '미세먼지', '먼지', 'dust', 'air quality'])) return { key: 'dust', label: '황사' };
  if (includesAny(value, ['무지개', 'rainbow'])) return { key: 'rainbow', label: '무지개' };
  if (includesAny(value, ['맑은 밤', 'night'])) return { key: 'night', label: '맑은 밤' };
  if (includesAny(value, ['소나기', 'shower'])) return { key: 'shower', label: '소나기' };

  if (
    includesAny(value, [
      '비 없음',
      '비구름 없음',
      '강수 없음',
      '비없음',
      'no rain',
      '맑',
      'clear',
      'sunny',
      '건조',
      '안정',
    ])
  ) {
    return { key: 'sunny', label: '맑음' };
  }

  if (includesAny(value, ['천둥', '번개', 'thunder', 'storm', '불안정'])) {
    return { key: 'thunder', label: '천둥번개' };
  }

  if (includesAny(value, ['눈', '진눈', 'snow', 'sleet'])) {
    return { key: 'snow', label: '눈' };
  }

  if (includesAny(value, ['비', '강수', 'rain'])) {
    return { key: 'rain', label: '비' };
  }

  if (includesAny(value, ['안개', '시야', '박무', 'mist', 'fog'])) {
    return { key: 'fog', label: '안개' };
  }

  if (includesAny(value, ['흐림', '구름', 'cloud', 'overcast'])) {
    return { key: 'cloudy', label: '흐림' };
  }

  return FALLBACK_VOTE;
}

function getVoteStats(cells: CompareForecastCell[]): VoteStats | null {
  const usableCells = cells.filter(isUsableForecastCell);
  if (usableCells.length === 0) return null;

  const votes = usableCells.map((cell) => getWeatherVote(cell.weather));
  const consensus = getConsensusVote(votes) ?? FALLBACK_VOTE;
  const agreeingCount = votes.filter((vote) => vote.key === consensus.key).length;
  const uniqueKeys = Array.from(new Set(votes.map((vote) => vote.key)));

  return {
    consensus,
    agreeingCount,
    totalCount: votes.length,
    uniqueKeys,
    hasWarningSignal: uniqueKeys.some((key) => WARNING_KEYS.has(key)),
  };
}

function getConsensusVote(votes: WeatherVote[]) {
  if (votes.length === 0) return null;

  const counts = votes.reduce<Record<string, { count: number; vote: WeatherVote }>>((acc, vote) => {
    const current = acc[vote.key] ?? { count: 0, vote };
    acc[vote.key] = { count: current.count + 1, vote };
    return acc;
  }, {});

  return Object.values(counts).sort((a, b) => {
    const countDiff = b.count - a.count;
    if (countDiff !== 0) return countDiff;

    return getTieBreakPriority(b.vote.key) - getTieBreakPriority(a.vote.key);
  })[0]?.vote;
}

function getTieBreakPriority(key: WeatherKey) {
  if (key === 'typhoon') return 10;
  if (key === 'heat') return 9;
  if (key === 'dust') return 8;
  if (key === 'thunder') return 7;
  if (key === 'snow') return 6;
  if (key === 'shower') return 5;
  if (key === 'rain') return 4;
  if (key === 'fog') return 3;
  if (key === 'cloudy') return 2;

  return 1;
}

function createSummaryCopy(sources: ForecastSource[], stats: VoteStats) {
  if (stats.totalCount === 0) {
    return {
      level: '확인 중',
      title: '예보를 다시 불러오고 있어요',
      summary: '아직 세 기상청 예보가 충분히 모이지 않았어요. 잠시 뒤 다시 확인해 주세요.',
      signal: '예보 확인 중',
    };
  }

  const providerText = sources.map((source) => `${normalizeProviderName(source.name)} ${source.condition} ${source.temp}`).join(', ');
  const agreementText = `${stats.totalCount}곳 중 ${stats.agreeingCount}곳이 ${stats.consensus.label}`;
  const isUnanimous = stats.totalCount === 3 && stats.agreeingCount === 3;
  const isMajority = stats.agreeingCount >= 2;
  const isSplit = !isMajority;

  if (stats.totalCount < 2) {
    return {
      level: '확인 중',
      title: '예보가 충분히 모이지 않았어요',
      summary: `${providerText || '확인 가능한 예보 없음'}. 다른 기상청 자료를 불러온 뒤 다시 비교해 주세요.`,
      signal: `${stats.totalCount}곳 확인`,
    };
  }

  if (isSplit) {
    return {
      level: '갈림',
      title: '예보가 서로 갈려요',
      summary: `${providerText}. 확인된 기상청 의견이 나뉘어서 시간별 변화를 같이 봐야 해요.`,
      signal: '예보 갈림',
    };
  }

  if (stats.consensus.key === 'rain') {
    return {
      level: isUnanimous ? '일치' : '우세',
      title: isUnanimous ? '세 기상청 모두 비를 보고 있어요' : '비 쪽 신호가 더 많아요',
      summary: `${providerText}. ${agreementText} 쪽이라 비 가능성을 먼저 봐야 해요.`,
      signal: `${agreementText}`,
    };
  }

  if (stats.consensus.key === 'sunny' || stats.consensus.key === 'night' || stats.consensus.key === 'rainbow') {
    return {
      level: isUnanimous ? '일치' : '우세',
      title: isUnanimous ? '세 기상청 모두 비 가능성을 낮게 봐요' : '비 가능성은 낮은 쪽이에요',
      summary: `${providerText}. ${agreementText} 쪽이라 현재 기준으로는 비 걱정이 크지 않아 보여요.`,
      signal: `${agreementText}`,
    };
  }

  if (stats.consensus.key === 'cloudy') {
    return {
      level: isUnanimous ? '일치' : '우세',
      title: isUnanimous ? '세 기상청 모두 흐림으로 보고 있어요' : '흐림 쪽 신호가 더 많아요',
      summary: `${providerText}. ${agreementText} 쪽이고, 비 신호는 비교탭에서 강수량까지 같이 확인하면 좋아요.`,
      signal: `${agreementText}`,
    };
  }

  if (stats.consensus.key === 'thunder' || stats.consensus.key === 'shower') {
    return {
      level: isUnanimous ? '일치' : '주의',
      title: stats.consensus.key === 'thunder' ? '강한 비나 천둥 신호가 있어요' : '소나기 가능성을 같이 봐야 해요',
      summary: `${providerText}. ${agreementText} 쪽이라 짧은 시간 변화가 클 수 있어요.`,
      signal: `${agreementText}`,
    };
  }

  if (stats.consensus.key === 'snow') {
    return {
      level: isUnanimous ? '일치' : '주의',
      title: '눈 또는 진눈깨비 신호가 있어요',
      summary: `${providerText}. ${agreementText} 쪽이라 기온과 강수 형태를 같이 확인해야 해요.`,
      signal: `${agreementText}`,
    };
  }

  if (stats.consensus.key === 'fog') {
    return {
      level: isUnanimous ? '일치' : '주의',
      title: '비보다 시야 확인이 중요해요',
      summary: `${providerText}. ${agreementText} 쪽이라 이동 전 현장 시야를 확인하는 게 좋아요.`,
      signal: `${agreementText}`,
    };
  }

  if (stats.consensus.key === 'dust') {
    return {
      level: isUnanimous ? '일치' : '주의',
      title: '대기질 신호를 같이 봐야 해요',
      summary: `${providerText}. ${agreementText} 쪽이라 비보다 먼지와 시야를 먼저 확인하면 좋아요.`,
      signal: `${agreementText}`,
    };
  }

  if (stats.consensus.key === 'heat') {
    return {
      level: isUnanimous ? '일치' : '주의',
      title: '체감 더위를 조심해야 해요',
      summary: `${providerText}. ${agreementText} 쪽이라 햇볕과 더위 부담을 먼저 봐야 해요.`,
      signal: `${agreementText}`,
    };
  }

  if (stats.consensus.key === 'typhoon') {
    return {
      level: '위험',
      title: '강풍과 많은 비를 조심해야 해요',
      summary: `${providerText}. ${agreementText} 쪽이라 이동 안전과 특보를 같이 확인해야 해요.`,
      signal: `${agreementText}`,
    };
  }

  return {
    level: isUnanimous ? '일치' : '우세',
    title: `${stats.consensus.label} 쪽 신호가 더 많아요`,
    summary: `${providerText}. ${agreementText} 쪽으로 정리됐어요.`,
    signal: `${agreementText}`,
  };
}

function getAverageTemperatureFromCells(cells: CompareForecastCell[]) {
  const temperatures = cells
    .map((cell) => parseTemperature(cell.detail))
    .filter((value): value is number => value !== null);

  if (temperatures.length === 0) return null;

  return Math.round(temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length);
}

function createForecastLead(rows: WeatherProviderSnapshot['hourlyRows']) {
  const nextLabels = rows
    .slice(0, 3)
    .map((row) => {
      const votes = [row.kma, row.yr, getThirdProviderCell(row)]
        .filter(isUsableForecastCell)
        .map((cell) => getWeatherVote(cell.weather));
      return getConsensusVote(votes)?.label;
    })
    .filter((label): label is string => Boolean(label));

  if (nextLabels.length === 0) return '시간별 예보를 다시 맞춰보고 있어요.';

  return `앞으로는 ${dedupe(nextLabels).join(', ')} 흐름으로 이어질 수 있어요.`;
}

function createForecastRows(
  rows: WeatherProviderSnapshot['hourlyRows'],
  fallbackRows: ForecastStep[],
  isLiveSnapshot: boolean,
) {
  const rowCount = isLiveSnapshot
    ? Math.min(12, rows.length)
    : Math.max(10, Math.min(12, Math.max(rows.length, fallbackRows.length)));

  return Array.from({ length: rowCount }, (_, index) => {
    const row = rows[index];
    const fallbackRow = isLiveSnapshot ? undefined : fallbackRows[index] ?? fallbackRows[fallbackRows.length - 1];
    const cell = row ? pickRepresentativeCell(row) : null;

    return {
      time: row?.label ?? fallbackRow?.time ?? `${index + 1}시간 뒤`,
      title: cell?.weather ?? fallbackRow?.title ?? '확인 필요',
      temp: getTemperatureFromDetail(cell?.detail) ?? fallbackRow?.temp ?? '--',
      note: getPrecipitationFromDetail(cell?.detail) ?? fallbackRow?.note ?? '변화 확인',
      mark: cell ? getWeatherVote(cell.weather).label.slice(0, 1) : fallbackRow?.mark ?? '예',
    };
  });
}

function pickRepresentativeCell(row: WeatherProviderSnapshot['hourlyRows'][number]): CompareForecastCell {
  const cells = [row.kma, row.yr, getThirdProviderCell(row)].filter(isUsableForecastCell);
  if (cells.length === 0) return row.kma;
  const consensus = getConsensusVote(cells.map((cell) => getWeatherVote(cell.weather)));

  return cells.find((cell) => getWeatherVote(cell.weather).key === consensus?.key) ?? row.kma;
}

function isUsableForecastCell(cell: CompareForecastCell | undefined): cell is CompareForecastCell {
  if (!cell) return false;

  const weather = cell.weather.trim().toLowerCase();
  return weather !== '' && weather !== '자료 없음' && weather !== 'unavailable' && cell.mark !== '-';
}

function isUsableForecastSource(source: ForecastSource) {
  const condition = source.condition.trim().toLowerCase();
  return condition !== '' && condition !== '자료 없음' && condition !== 'unavailable' && source.mark !== '-';
}

function getTemperatureFromDetail(detail: string | undefined) {
  const match = detail?.match(/-?\d+\s*(?:°C|℃|도)/);

  return match ? match[0].replace(/\s/g, '').replace('℃', '°C').replace('도', '°C') : null;
}

function parseTemperature(value: string | undefined) {
  const match = value?.match(/-?\d+/);

  return match ? Number(match[0]) : null;
}

function getPrecipitationFromDetail(detail: string | undefined) {
  const match = detail?.match(/\d+(?:\.\d+)?mm/);

  return match ? `강수 ${match[0]}` : null;
}

function normalizeProviderName(name: string) {
  if (name.includes('노르웨이') || name.includes('Yr') || name.includes('MET Norway')) return '노르웨이 기상청';
  if (name.includes('핀란드') || name.includes('FMI') || name.includes('ECMWF') || name.toLowerCase().includes('windy')) {
    return '핀란드 기상청';
  }
  if (name.includes('대한민국') || name.includes('기상청') || name.includes('KMA')) return '대한민국 기상청';

  return name;
}

function dedupe(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}
