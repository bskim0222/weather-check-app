import { getForecastWindow, getTargetTimestampMs, getSeoulParts, pickTargetItem } from '../timeIntent.mjs';
import { getKmaDailyForecastKey, getKmaHourlyForecastAt } from '../forecastKeys.mjs';

const kmaBaseUrl = 'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';

export async function fetchKmaShortForecast(context) {
  const coordinates = getCoordinates(context);
  const serviceKey = process.env.KMA_SERVICE_KEY ?? process.env.EXPO_PUBLIC_KMA_API_KEY ?? '';

  if (!coordinates || !serviceKey.trim()) {
    return null;
  }

  const grid = convertLatLonToKmaGrid(coordinates.latitude, coordinates.longitude);
  const now = new Date();
  const [current, forecast] = await Promise.all([
    fetchKmaEndpoint('/getUltraSrtNcst', {
      ...createKmaBaseTime(now, 'current'),
      nx: grid.nx,
      ny: grid.ny,
      serviceKey,
    }),
    fetchKmaEndpoint('/getVilageFcst', {
      ...createKmaForecastBaseTime(now),
      nx: grid.nx,
      ny: grid.ny,
      serviceKey,
    }),
  ]);

  return createKmaForecastModel(current, forecast, context);
}

export function createKmaForecastModel(currentPayload, forecastPayload = currentPayload, context = null) {
  const currentItems = getItems(currentPayload);
  const forecastItems = getItems(forecastPayload);
  const currentByCategory = groupLatestByCategory(currentItems, 'obsrValue');
  const allForecastRows = createForecastRows(forecastItems);
  const targetMs = getTargetTimestampMs(context);
  const forecastRows = getForecastWindow(allForecastRows, getForecastRowTimeMs, targetMs, 18);
  const targetForecast = pickTargetItem(allForecastRows, getForecastRowTimeMs, targetMs) ?? forecastRows[0];
  const currentValues = {
    pty: currentByCategory.PTY ?? targetForecast?.pty,
    sky: currentByCategory.SKY ?? targetForecast?.sky,
    rn1: currentByCategory.RN1 ?? targetForecast?.rn1,
  };
  const targetValues = targetForecast
    ? {
        pty: targetForecast.pty,
        sky: targetForecast.sky,
        rn1: targetForecast.rn1,
      }
    : currentValues;
  const representativeValues = Number.isFinite(targetMs) ? targetValues : currentValues;
  const condition = conditionFromKmaValues(representativeValues);
  const temp = Number.isFinite(targetMs)
    ? targetForecast?.temperature ?? currentByCategory.T1H ?? null
    : currentByCategory.T1H ?? targetForecast?.temperature ?? null;
  const rain = Number.isFinite(targetMs)
    ? targetForecast?.rn1 ?? currentByCategory.RN1 ?? '0'
    : currentByCategory.RN1 ?? targetForecast?.rn1 ?? '0';
  const wind = currentByCategory.WSD ?? null;

  return {
    current: {
      condition,
      temp: formatTemperature(temp),
      detail: createDetail(rain, wind),
      badge: condition,
      value: formatKmaRain(rain),
      mark: conditionToMark(condition),
      tone: conditionToTone(condition),
    },
    hourlyRows: forecastRows.map((row, index) => ({
      forecastAt: getKmaHourlyForecastAt(row.date, row.time),
      label: formatKmaRowLabel(row, index, targetMs),
      weather: conditionFromKmaValues(row),
      detail: `${formatTemperature(row.temperature)} · ${formatKmaRain(row.rn1)}`,
      mark: conditionToMark(conditionFromKmaValues(row)),
      tone: conditionToTone(conditionFromKmaValues(row)),
    })),
    dailyRows: createDailyRows(allForecastRows),
  };
}

export function shouldUseKmaProvider() {
  const mode = process.env.WEATHER_PROVIDER_MODE ?? '';

  return mode === 'kma' || mode === 'real' || mode.split(',').map((item) => item.trim()).includes('kma');
}

export function convertLatLonToKmaGrid(latitude, longitude) {
  const earthRadius = 6371.00877;
  const grid = 5.0;
  const slat1 = 30.0;
  const slat2 = 60.0;
  const olon = 126.0;
  const olat = 38.0;
  const xo = 43;
  const yo = 136;
  const degrad = Math.PI / 180.0;
  const re = earthRadius / grid;
  const slat1Rad = slat1 * degrad;
  const slat2Rad = slat2 * degrad;
  const olonRad = olon * degrad;
  const olatRad = olat * degrad;

  let sn = Math.tan(Math.PI * 0.25 + slat2Rad * 0.5) / Math.tan(Math.PI * 0.25 + slat1Rad * 0.5);
  sn = Math.log(Math.cos(slat1Rad) / Math.cos(slat2Rad)) / Math.log(sn);

  let sf = Math.tan(Math.PI * 0.25 + slat1Rad * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1Rad)) / sn;

  let ro = Math.tan(Math.PI * 0.25 + olatRad * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + latitude * degrad * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);

  let theta = longitude * degrad - olonRad;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + xo + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + yo + 0.5),
  };
}

async function fetchKmaEndpoint(path, params) {
  const url = new URL(`${kmaBaseUrl}${path}`);
  url.searchParams.set('serviceKey', params.serviceKey);
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '1000');
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('base_date', params.baseDate);
  url.searchParams.set('base_time', params.baseTime);
  url.searchParams.set('nx', String(params.nx));
  url.searchParams.set('ny', String(params.ny));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`KMA request failed with ${response.status}.`);
  }

  return response.json();
}

function createKmaBaseTime(date, type) {
  const releaseOffsetMinutes = type === 'forecast' ? 45 : 15;
  const base = new Date(date.getTime() - releaseOffsetMinutes * 60 * 1000);
  const baseParts = getSeoulParts(base);
  const hour = String(baseParts.hour).padStart(2, '0');

  return {
    baseDate: `${baseParts.year}${String(baseParts.month).padStart(2, '0')}${String(baseParts.day).padStart(2, '0')}`,
    baseTime: type === 'forecast' ? `${hour}30` : `${hour}00`,
  };
}

function createKmaForecastBaseTime(date) {
  const base = new Date(date.getTime() - 20 * 60 * 1000);
  const parts = getSeoulParts(base);
  const baseHours = [2, 5, 8, 11, 14, 17, 20, 23];
  let baseHour = [...baseHours].reverse().find((hour) => hour <= parts.hour);
  let dayOffset = 0;

  if (baseHour === undefined) {
    baseHour = 23;
    dayOffset = -1;
  }

  const baseDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, 12));
  const baseDateParts = getSeoulParts(baseDate);

  return {
    baseDate: `${baseDateParts.year}${String(baseDateParts.month).padStart(2, '0')}${String(baseDateParts.day).padStart(2, '0')}`,
    baseTime: `${String(baseHour).padStart(2, '0')}00`,
  };
}

function getCoordinates(context) {
  const latitude = Number(context?.target?.latitude);
  const longitude = Number(context?.target?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function getItems(payload) {
  const item = payload?.response?.body?.items?.item;

  return Array.isArray(item) ? item : [];
}

function groupLatestByCategory(items, valueKey) {
  return items.reduce((acc, item) => {
    if (typeof item?.category === 'string') {
      acc[item.category] = item[valueKey] ?? item.fcstValue ?? item.obsrValue;
    }

    return acc;
  }, {});
}

function createForecastRows(items) {
  const rows = new Map();

  items.forEach((item) => {
    const key = `${item.fcstDate ?? ''}-${item.fcstTime ?? ''}`;
    if (!rows.has(key)) {
      rows.set(key, {
        date: item.fcstDate,
        time: item.fcstTime,
      });
    }

    const row = rows.get(key);
    if (item.category === 'T1H' || item.category === 'TMP') row.temperature = item.fcstValue;
    if (item.category === 'RN1' || item.category === 'PCP') row.rn1 = item.fcstValue;
    if (item.category === 'PTY') row.pty = item.fcstValue;
    if (item.category === 'SKY') row.sky = item.fcstValue;
  });

  return [...rows.values()].filter((row) => row.time);
}

function getForecastRowTimeMs(row) {
  const date = String(row?.date ?? '');
  const time = String(row?.time ?? '');

  if (date.length !== 8 || time.length < 2) return NaN;

  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(4, 6));
  const day = Number(date.slice(6, 8));
  const hour = Number(time.slice(0, 2));

  return Date.UTC(year, month - 1, day, hour - 9, 0, 0);
}

function createDailyRows(hourlyRows) {
  const byDate = new Map();

  hourlyRows.forEach((row) => {
    if (!row.date) return;
    const rows = byDate.get(row.date) ?? [];
    rows.push(row);
    byDate.set(row.date, rows);
  });

  return [...byDate.entries()].slice(0, 10).map(([date, rows], index) => {
    const morning = createKmaDailyPeriod(pickClosestKmaHour(rows, 9));
    const afternoon = createKmaDailyPeriod(pickClosestKmaHour(rows, 15));
    const representative = afternoon ?? morning ?? createKmaDailyPeriod(rows[0]);

    return {
      periodKey: getKmaDailyForecastKey(date),
      label: createDailyLabel(date, index),
      weather: representative.weather,
      detail: representative.detail,
      mark: representative.mark,
      tone: representative.tone,
      morning,
      afternoon,
    };
  });
}

function pickClosestKmaHour(rows, targetHour) {
  return rows.reduce((best, row) => {
    const hour = Number(String(row?.time ?? '').slice(0, 2));
    if (!Number.isFinite(hour)) return best;
    if (!best) return row;

    const bestHour = Number(String(best?.time ?? '').slice(0, 2));

    return Math.abs(hour - targetHour) < Math.abs(bestHour - targetHour) ? row : best;
  }, null);
}

function createKmaDailyPeriod(row) {
  if (!row) return null;

  const weather = conditionFromKmaValues(row);

  return {
    weather,
    detail: `${formatTemperature(row.temperature)} · ${formatKmaRain(row.rn1)}`,
    mark: conditionToMark(weather),
    tone: conditionToTone(weather),
  };
}

function createDailyLabel(dateValue, index) {
  if (index === 0) return '오늘';
  if (index === 1) return '내일';
  if (typeof dateValue === 'string' && dateValue.length === 8) {
    return dateValue.slice(4).replace(/(\d{2})(\d{2})/, '$1/$2');
  }

  return `${index + 1}일 뒤`;
}

function conditionFromKmaValues(values) {
  const pty = String(values.pty ?? '0');
  const sky = String(values.sky ?? '');
  const rain = Number(values.rn1 ?? 0);
  const temperature = Number(values.temperature ?? values.T1H ?? values.TMP);

  if (pty === '4') return '소나기';
  if (['1', '5'].includes(pty) || rain > 0) return '비';
  if (['2', '6'].includes(pty)) return '진눈깨비';
  if (['3', '7'].includes(pty)) return '눈';
  if (Number.isFinite(temperature) && temperature >= 35) return '폭염';
  if (sky === '1') return '맑음';
  if (sky === '3') return '구름 조금';

  return '흐림';
}

function createDetail(rain, wind) {
  const parts = [`강수 ${formatKmaRain(rain)}`];

  if (wind !== null && wind !== undefined) {
    parts.push(`바람 ${Math.round(Number(wind))}m/s`);
  }

  return parts.join(' · ');
}

function formatTemperature(value) {
  const number = Number(value);

  return Number.isFinite(number) ? `${Math.round(number)}℃` : '--℃';
}

function formatKmaRain(value) {
  const raw = String(value ?? '0');

  if (raw === '강수없음') return '0mm';
  if (raw.includes('mm')) return raw;

  const number = Number(raw);

  return Number.isFinite(number) ? `${number}mm` : raw;
}

function formatKmaHour(value) {
  return typeof value === 'string' && value.length >= 2 ? `${value.slice(0, 2)}시` : '예보';
}

function formatKmaRowLabel(row, index, targetMs) {
  if (!Number.isFinite(targetMs) && index === 0) return '지금';
  if (typeof row?.date === 'string' && row.date.length === 8 && typeof row?.time === 'string') {
    return `${row.date.slice(4, 6)}/${row.date.slice(6, 8)} ${formatKmaHour(row.time)}`;
  }

  return formatKmaHour(row?.time);
}

function conditionToMark(condition) {
  if (condition.includes('비')) return '비';
  if (condition.includes('눈')) return '눈';
  if (condition.includes('맑')) return '맑';
  if (condition.includes('구름')) return '구';

  return '흐';
}

function conditionToTone(condition) {
  if (condition.includes('비')) return '#6f8da8';
  if (condition.includes('눈')) return '#9db5c5';
  if (condition.includes('맑')) return '#b79b57';
  if (condition.includes('구름')) return '#8f9191';

  return '#777b80';
}
