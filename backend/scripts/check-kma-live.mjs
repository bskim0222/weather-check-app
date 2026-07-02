import { createWeatherProviderSnapshot } from '../src/weatherSnapshots.mjs';

if (!process.env.KMA_SERVICE_KEY) {
  throw new Error('KMA_SERVICE_KEY is required.');
}

process.env.WEATHER_PROVIDER_MODE = 'kma';

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
  interpretationNote: '기상청 실제 예보 연결 확인용입니다.',
  needsClarification: false,
};

const snapshot = await createWeatherProviderSnapshot(context);
const kmaSource = snapshot.sources.find((source) => source.providerId === 'kma');
const firstHourly = snapshot.hourlyRows[0]?.kma;

console.log(
  JSON.stringify(
    {
      source: snapshot.source,
      place: snapshot.context.place,
      kmaSource,
      firstHourly,
    },
    null,
    2,
  ),
);
