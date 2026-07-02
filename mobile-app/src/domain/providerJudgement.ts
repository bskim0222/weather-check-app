import type { WeatherProviderSnapshot } from '../services/weatherProviders';
import type { CompareForecastCell, ForecastSource, ForecastStep, WeatherKey, WeatherPreset } from '../types/weather';

type WeatherVote = {
  key: WeatherKey;
  label: string;
};

export function createProviderAdjustedPreset(
  basePreset: WeatherPreset,
  providerSnapshot: WeatherProviderSnapshot,
): WeatherPreset {
  const sources = providerSnapshot.sources.length > 0 ? providerSnapshot.sources : basePreset.sources;
  const votes = sources.map((source) => getWeatherVote(source.condition));
  const consensus = getConsensusVote(votes) ?? getWeatherVote(basePreset.condition);
  const temp = getAverageTemperature(sources) ?? basePreset.temp;
  const serviceSignal = createServiceSignal(sources, consensus.label);

  return {
    ...basePreset,
    condition: consensus.label,
    temp,
    title: createProviderTitle(consensus, basePreset.title),
    summary: createProviderSummary(sources, consensus.label),
    signal: serviceSignal,
    sources,
    forecastLead: createForecastLead(providerSnapshot.hourlyRows, consensus.label, basePreset.forecastLead),
    forecastRows: createForecastRows(providerSnapshot.hourlyRows, basePreset.forecastRows),
  };
}

function getWeatherVote(condition: string): WeatherVote {
  if (includesAny(condition, ['천둥', '번개', '소나기', '불안정'])) {
    return { key: 'thunder', label: '천둥번개' };
  }

  if (includesAny(condition, ['눈', '진눈'])) {
    return { key: 'snow', label: '눈' };
  }

  if (includesAny(condition, ['비', '강수', '소강'])) {
    return { key: 'rain', label: '비' };
  }

  if (includesAny(condition, ['안개', '시야', '습함'])) {
    return { key: 'fog', label: '안개' };
  }

  if (includesAny(condition, ['맑', '비 없음', '건조', '안정'])) {
    return { key: 'sunny', label: '맑음' };
  }

  return { key: 'cloudy', label: '흐림' };
}

function getConsensusVote(votes: WeatherVote[]) {
  const counts = votes.reduce<Record<WeatherKey, number>>((acc, vote) => {
    acc[vote.key] = (acc[vote.key] ?? 0) + 1;
    return acc;
  }, {} as Record<WeatherKey, number>);
  const sorted = [...votes].sort((a, b) => (counts[b.key] ?? 0) - (counts[a.key] ?? 0));
  const winner = sorted[0];

  if (!winner || (counts[winner.key] ?? 0) < 2) return null;

  return winner;
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

function createProviderTitle(consensus: WeatherVote, fallbackTitle: string) {
  if (consensus.key === 'rain') return '지금은 비 오는 쪽이 우세해요';
  if (consensus.key === 'sunny') return '지금은 비 걱정이 거의 없어요';
  if (consensus.key === 'cloudy') return '비보다는 흐린 쪽에 가까워요';
  if (consensus.key === 'thunder') return '소나기와 천둥 가능성을 봐야 해요';
  if (consensus.key === 'snow') return '눈 또는 진눈깨비 신호가 있어요';
  if (consensus.key === 'fog') return '비보다 시야 확인이 먼저예요';

  return fallbackTitle;
}

function createProviderSummary(sources: ForecastSource[], consensusLabel: string) {
  const names = sources.map((source) => `${source.name} ${source.condition}`).join(', ');

  return `${names} 신호를 비교하면 현재는 ${consensusLabel} 쪽으로 판단하고 있어요.`;
}

function createServiceSignal(sources: ForecastSource[], consensusLabel: string) {
  const count = sources.filter((source) => getWeatherVote(source.condition).label === consensusLabel).length;

  return `${count}곳 ${consensusLabel}`;
}

function createForecastLead(rows: WeatherProviderSnapshot['hourlyRows'], consensusLabel: string, fallback: string) {
  if (rows.length === 0) return fallback;

  const nextLabels = rows
    .slice(0, 3)
    .map((row) => pickRepresentativeCell(row)?.weather)
    .filter(Boolean);

  return nextLabels.length > 0
    ? `앞으로 몇 시간은 ${nextLabels.join(' → ')} 흐름으로 보고 있어요.`
    : `${consensusLabel} 판단을 기준으로 다음 변화를 보고 있어요.`;
}

function createForecastRows(rows: WeatherProviderSnapshot['hourlyRows'], fallbackRows: ForecastStep[]) {
  if (rows.length === 0) return fallbackRows;

  return rows.slice(0, 3).map((row, index) => {
    const cell = pickRepresentativeCell(row);

    return {
      time: row.label,
      title: cell?.weather ?? fallbackRows[index]?.title ?? '확인 필요',
      temp: getTemperatureFromDetail(cell?.detail) ?? fallbackRows[index]?.temp ?? '--도',
      note: getPrecipitationFromDetail(cell?.detail) ?? fallbackRows[index]?.note ?? '변화 확인',
      mark: cell?.mark ?? fallbackRows[index]?.mark ?? '확',
    };
  });
}

function pickRepresentativeCell(row: WeatherProviderSnapshot['hourlyRows'][number]): CompareForecastCell {
  const cells = [row.kma, row.yr, row.windy];
  const rainLike = cells.find((cell) => getWeatherVote(cell.weather).key === 'rain');

  return rainLike ?? row.yr ?? row.kma;
}

function getTemperatureFromDetail(detail: string | undefined) {
  const match = detail?.match(/-?\d+\s*(?:℃|도)/);

  return match ? match[0].replace('℃', '도').replace(/\s/g, '') : null;
}

function getPrecipitationFromDetail(detail: string | undefined) {
  const match = detail?.match(/\d+(?:\.\d+)?mm/);

  return match ? `강수 ${match[0]}` : null;
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}
