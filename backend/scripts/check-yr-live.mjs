import { createWeatherProviderSnapshot } from '../src/weatherSnapshots.mjs';

if (!process.env.YR_USER_AGENT) {
  throw new Error('YR_USER_AGENT is required. Example: WeatherCheck/0.1 contact@example.com');
}

process.env.WEATHER_PROVIDER_MODE = 'yr';

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
  interpretationNote: 'Yr.no 실제 예보 연결 확인용입니다.',
  needsClarification: false,
};

const snapshot = await createWeatherProviderSnapshot(context);
const yrSource = snapshot.sources.find((source) => source.providerId === 'yr');
const firstHourly = snapshot.hourlyRows[0]?.yr;

console.log(
  JSON.stringify(
    {
      source: snapshot.source,
      place: snapshot.context.place,
      yrSource,
      firstHourly,
    },
    null,
    2,
  ),
);
