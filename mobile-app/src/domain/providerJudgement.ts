import type { WeatherProviderSnapshot } from '../services/weatherProviders';
import { weatherPresets } from '../data/mockWeather';
import type { CompareForecastCell, ForecastSource, ForecastStep, WeatherKey, WeatherPreset } from '../types/weather';

type WeatherVote = {
  key: WeatherKey;
  label: string;
};

type JudgementTone = 'confident' | 'leaning' | 'mixed' | 'caution';

export function createProviderAdjustedPreset(
  basePreset: WeatherPreset,
  providerSnapshot: WeatherProviderSnapshot,
): WeatherPreset {
  const sources = providerSnapshot.sources.length > 0 ? providerSnapshot.sources : basePreset.sources;
  const judgementSources = getJudgementSources(sources, providerSnapshot);
  const votes = judgementSources.map((source) => getWeatherVote(source.condition));
  const consensus = getConsensusVote(votes) ?? getWeatherVote(basePreset.condition);
  const visualPreset = weatherPresets[consensus.key];
  const agreeingCount = votes.filter((vote) => vote.key === consensus.key).length;
  const tone = getJudgementTone(consensus.key, agreeingCount, judgementSources.length);
  const temp = getAverageTemperature(judgementSources) ?? basePreset.temp;

  return {
    ...basePreset,
    bg: visualPreset.bg,
    accent: visualPreset.accent,
    accentInk: visualPreset.accentInk,
    glyph: visualPreset.glyph,
    condition: consensus.label,
    temp,
    level: createJudgementLevel(tone),
    live: '현장 제보 확인',
    title: createProviderTitle(consensus, tone),
    summary: createProviderSummary(judgementSources, consensus, agreeingCount),
    signal: createServiceSignal(agreeingCount, judgementSources.length, consensus.label),
    sources,
    forecastLead: createForecastLead(providerSnapshot.hourlyRows, consensus),
    forecastRows: createForecastRows(providerSnapshot.hourlyRows, visualPreset.forecastRows, consensus),
  };
}

function getJudgementSources(
  sources: ForecastSource[],
  providerSnapshot: WeatherProviderSnapshot,
) {
  const liveProviderIds = new Set(providerSnapshot.meta.liveProviderIds);
  const liveSources = sources.filter((source) => source.providerId && liveProviderIds.has(source.providerId));

  return liveSources.length > 0 ? liveSources : sources;
}

function getWeatherVote(condition: string): WeatherVote {
  const value = condition.toLowerCase();

  if (includesAny(value, ['태풍', 'typhoon', 'cyclone'])) return { key: 'typhoon', label: '태풍' };
  if (includesAny(value, ['폭염', '무더위', '고온', 'heatwave', 'hot'])) return { key: 'heat', label: '폭염' };
  if (includesAny(value, ['황사', '미세먼지', '먼지', 'dust', 'air quality'])) return { key: 'dust', label: '황사' };
  if (includesAny(value, ['무지개', 'rainbow'])) return { key: 'rainbow', label: '무지개' };
  if (includesAny(value, ['맑은 밤', 'night'])) return { key: 'night', label: '맑은 밤' };
  if (includesAny(value, ['소나기', 'shower'])) return { key: 'shower', label: '소나기' };

  if (includesAny(value, ['비 없음', '비구름 없음', '강수 없음', '비 안', 'no rain', '0mm', '맑', 'clear', 'sunny', '건조', '안정'])) {
    return { key: 'sunny', label: '맑음' };
  }

  if (includesAny(value, ['천둥', '번개', 'thunder', 'storm', '불안정'])) {
    return { key: 'thunder', label: '천둥번개' };
  }

  if (includesAny(value, ['눈', '진눈', 'snow', 'sleet'])) {
    return { key: 'snow', label: '눈' };
  }

  if (includesAny(value, ['비', '강수', '소나기', 'rain', 'shower'])) {
    return { key: 'rain', label: '비' };
  }

  if (includesAny(value, ['안개', '시야', '습함', '낮은 구름', 'fog', 'mist'])) {
    return { key: 'fog', label: '안개' };
  }

  return { key: 'cloudy', label: '흐림' };
}

function getConsensusVote(votes: WeatherVote[]) {
  const counts = votes.reduce<Record<WeatherKey, number>>((acc, vote) => {
    acc[vote.key] = (acc[vote.key] ?? 0) + 1;
    return acc;
  }, {} as Record<WeatherKey, number>);
  const sorted = [...votes].sort((a, b) => {
    const countDiff = (counts[b.key] ?? 0) - (counts[a.key] ?? 0);
    if (countDiff !== 0) return countDiff;

    return getWeatherPriority(b.key) - getWeatherPriority(a.key);
  });

  return sorted[0] ?? null;
}

function getWeatherPriority(key: WeatherKey) {
  if (key === 'typhoon') return 10;
  if (key === 'heat') return 9;
  if (key === 'dust') return 8;
  if (key === 'shower') return 7;
  if (key === 'thunder') return 6;
  if (key === 'snow') return 5;
  if (key === 'rain') return 4;
  if (key === 'fog') return 3;
  if (key === 'cloudy') return 2;

  return 1;
}

function getJudgementTone(key: WeatherKey, agreeingCount: number, totalCount: number): JudgementTone {
  if (key === 'typhoon' || key === 'heat' || key === 'dust' || key === 'thunder' || key === 'snow' || key === 'fog') return 'caution';
  if (totalCount >= 3 && agreeingCount >= 3) return 'confident';
  if (agreeingCount >= 2) return 'leaning';

  return 'mixed';
}

function createJudgementLevel(tone: JudgementTone) {
  if (tone === 'confident') return '확실';
  if (tone === 'leaning') return '우세';
  if (tone === 'caution') return '주의';

  return '애매';
}

function getAverageTemperature(sources: ForecastSource[]) {
  const temperatures = sources
    .map((source) => parseTemperature(source.temp))
    .filter((value): value is number => value !== null);

  if (temperatures.length === 0) return null;

  return Math.round(temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length);
}

function parseTemperature(value: string) {
  const match = value.match(/-?\d+/);

  return match ? Number(match[0]) : null;
}

function createProviderTitle(consensus: WeatherVote, tone: JudgementTone) {
  if (consensus.key === 'rain') return tone === 'mixed' ? '비 신호가 애매해요' : '비 가능성이 더 높아요';
  if (consensus.key === 'sunny') return tone === 'mixed' ? '비 가능성은 낮아 보여요' : '비 걱정은 낮은 편이에요';
  if (consensus.key === 'cloudy') return '비보다는 흐림 쪽 신호예요';
  if (consensus.key === 'thunder') return '소나기와 천둥 가능성을 확인해야 해요';
  if (consensus.key === 'snow') return '눈 또는 진눈깨비 신호가 있어요';
  if (consensus.key === 'fog') return '비보다 시야 확인이 중요해요';

  return '예보 신호를 비교하고 있어요';
}

function createProviderSummary(sources: ForecastSource[], consensus: WeatherVote, agreeingCount: number) {
  const sourceText = sources
    .map((source) => `${normalizeProviderName(source.name)} ${source.condition} ${source.temp}`)
    .join(', ');
  const total = sources.length;

  if (agreeingCount >= 2) {
    return `${sourceText}. ${total}곳 중 ${agreeingCount}곳이 ${consensus.label} 쪽이라 이렇게 판단했어요.`;
  }

  return `${sourceText}. 예보가 서로 갈려서 ${consensus.label} 가능성을 우선 보되, 현장 제보 확인이 필요해요.`;
}

function createServiceSignal(agreeingCount: number, totalCount: number, consensusLabel: string) {
  return `${totalCount}곳 중 ${agreeingCount}곳 ${consensusLabel}`;
}

function createForecastLead(rows: WeatherProviderSnapshot['hourlyRows'], consensus: WeatherVote) {
  if (rows.length === 0) {
    return `${consensus.label} 판정을 기준으로 다음 변화를 계속 확인해요.`;
  }

  const nextLabels = rows
    .slice(0, 3)
    .map((row) => pickRepresentativeCell(row, consensus)?.weather)
    .filter(Boolean);

  if (nextLabels.length === 0) {
    return `${consensus.label} 판정을 기준으로 다음 변화를 계속 확인해요.`;
  }

  return `앞으로 몇 시간은 ${dedupe(nextLabels).join(' → ')} 흐름으로 보고 있어요.`;
}

function createForecastRows(
  rows: WeatherProviderSnapshot['hourlyRows'],
  fallbackRows: ForecastStep[],
  consensus: WeatherVote,
) {
  return Array.from({ length: 7 }, (_, index) => {
    const row = rows[index];
    const fallbackRow = fallbackRows[index] ?? fallbackRows[fallbackRows.length - 1];
    const cell = row ? pickRepresentativeCell(row, consensus) : null;

    return {
      time: row?.label ?? fallbackRow?.time ?? `${index}시간 뒤`,
      title: cell?.weather ?? fallbackRow?.title ?? '확인 필요',
      temp: getTemperatureFromDetail(cell?.detail) ?? fallbackRow?.temp ?? '--도',
      note: getPrecipitationFromDetail(cell?.detail) ?? fallbackRow?.note ?? '변화 확인',
      mark: cell?.mark ?? fallbackRow?.mark ?? consensus.label.slice(0, 1),
    };
  });
}

function pickRepresentativeCell(
  row: WeatherProviderSnapshot['hourlyRows'][number],
  consensus: WeatherVote,
): CompareForecastCell {
  const cells = [row.kma, row.yr, row.windy];
  const consensusCell = cells.find((cell) => getWeatherVote(cell.weather).key === consensus.key);
  const cautionCell = cells.find((cell) => ['rain', 'thunder', 'snow'].includes(getWeatherVote(cell.weather).key));

  return consensusCell ?? cautionCell ?? row.kma ?? row.yr ?? row.windy;
}

function getTemperatureFromDetail(detail: string | undefined) {
  const match = detail?.match(/-?\d+\s*(?:°|도)/);

  return match ? match[0].replace(/\s/g, '').replace('°', '도') : null;
}

function getPrecipitationFromDetail(detail: string | undefined) {
  const match = detail?.match(/\d+(?:\.\d+)?mm/);

  return match ? `강수 ${match[0]}` : null;
}

function normalizeProviderName(name: string) {
  if (name === '기상청') return '대한민국 기상청';
  if (name === 'Yr.no') return '노르웨이 기상청';
  if (name === 'FMI ECMWF') return '핀란드 기상청';
  if (name.toLowerCase().includes('windy')) return '핀란드 기상청';

  return name;
}

function dedupe(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}
