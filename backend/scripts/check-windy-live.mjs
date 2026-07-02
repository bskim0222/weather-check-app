import { createWeatherProviderSnapshot } from '../src/weatherSnapshots.mjs';

if (!process.env.WINDY_API_KEY) {
  throw new Error('WINDY_API_KEY is required.');
}

process.env.WEATHER_PROVIDER_MODE = 'windy';

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
  interpretationNote: 'Windy 실제 예보 연결 확인용입니다.',
  needsClarification: false,
};

const snapshot = await createWeatherProviderSnapshot(context);
const windySource = snapshot.sources.find((source) => source.providerId === 'windy');
const firstHourly = snapshot.hourlyRows[0]?.windy;

console.log(
  JSON.stringify(
    {
      source: snapshot.source,
      place: snapshot.context.place,
      windySource,
      firstHourly,
    },
    null,
    2,
  ),
);
