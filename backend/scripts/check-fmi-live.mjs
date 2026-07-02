import { fetchFmiEcmwfForecast } from '../src/providers/fmiEcmwfForecast.mjs';

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
  interpretationNote: 'FMI ECMWF 실제 예보 연결 확인용입니다.',
  needsClarification: false,
};

const forecast = await fetchFmiEcmwfForecast(context);

console.log(
  JSON.stringify(
    {
      current: forecast?.current,
      firstHourly: forecast?.hourlyRows[0],
      hourlyCount: forecast?.hourlyRows.length,
      dailyCount: forecast?.dailyRows.length,
    },
    null,
    2,
  ),
);
