import { createWeatherProviderSnapshot } from '../src/weatherSnapshots.mjs';

const requiredEnv = [
  ['KMA_SERVICE_KEY', 'KMA service key'],
  ['YR_USER_AGENT', 'Yr.no/MET User-Agent'],
];

const missing = requiredEnv.filter(([key]) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment values: ${missing.map(([key, label]) => `${key} (${label})`).join(', ')}`,
  );
}

process.env.WEATHER_PROVIDER_MODE = 'kma,yr,fmi';

const context = {
  raw: '잠실운동장 지금 비 와?',
  place: '잠실운동장',
  target: {
    id: 'jamsil-stadium',
    label: '잠실운동장',
    kind: 'known-place',
    latitude: 37.515,
    longitude: 127.0728,
    radiusMeters: 900,
  },
  timeLabel: '지금',
  detectedWeather: '비',
  interpretationNote: 'MVP 실데이터 예보 비교 확인용입니다.',
  needsClarification: false,
};

const snapshot = await createWeatherProviderSnapshot(context);

console.log(
  JSON.stringify(
    {
      mode: process.env.WEATHER_PROVIDER_MODE,
      sources: snapshot.sources.map((source) => ({
        providerId: source.providerId,
        name: source.name,
        condition: source.condition,
        temp: source.temp,
        detail: source.detail,
      })),
      summaries: snapshot.summaries.map((summary) => ({
        name: summary.name,
        weather: summary.weather,
        value: summary.value,
      })),
      firstHourly: snapshot.hourlyRows[0],
      firstDaily: snapshot.dailyRows[0],
      hourlyCount: snapshot.hourlyRows.length,
      dailyCount: snapshot.dailyRows.length,
    },
    null,
    2,
  ),
);
