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
    fetchKmaEndpoint('/getUltraSrtFcst', {
      ...createKmaBaseTime(now, 'forecast'),
      nx: grid.nx,
      ny: grid.ny,
      serviceKey,
    }),
  ]);

  return createKmaForecastModel(current, forecast);
}

export function createKmaForecastModel(currentPayload, forecastPayload = currentPayload) {
  const currentItems = getItems(currentPayload);
  const forecastItems = getItems(forecastPayload);
  const currentByCategory = groupLatestByCategory(currentItems, 'obsrValue');
  const forecastRows = createForecastRows(forecastItems);
  const firstForecast = forecastRows[0];
  const condition = conditionFromKmaValues({
    pty: currentByCategory.PTY ?? firstForecast?.pty,
    sky: firstForecast?.sky ?? currentByCategory.SKY,
    rn1: currentByCategory.RN1 ?? firstForecast?.rn1,
  });
  const temp = currentByCategory.T1H ?? firstForecast?.temperature ?? null;
  const rain = currentByCategory.RN1 ?? firstForecast?.rn1 ?? '0';
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
      label: index === 0 ? '지금' : formatKmaHour(row.time),
      weather: conditionFromKmaValues(row),
      detail: `${formatTemperature(row.temperature)} · ${formatKmaRain(row.rn1)}`,
      mark: conditionToMark(conditionFromKmaValues(row)),
      tone: conditionToTone(conditionFromKmaValues(row)),
    })),
    dailyRows: createDailyRows(forecastRows),
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
  const zoned = getSeoulParts(date);
  const releaseOffsetMinutes = type === 'forecast' ? 45 : 15;
  const base = new Date(date.getTime() - releaseOffsetMinutes * 60 * 1000);
  const baseParts = getSeoulParts(base);
  const hour = String(baseParts.hour).padStart(2, '0');

  return {
    baseDate: `${baseParts.year}${String(baseParts.month).padStart(2, '0')}${String(baseParts.day).padStart(2, '0')}`,
    baseTime: type === 'forecast' ? `${hour}30` : `${hour}00`,
  };
}

function getSeoulParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    hour: Number(value.hour),
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
    if (item.category === 'T1H') row.temperature = item.fcstValue;
    if (item.category === 'RN1') row.rn1 = item.fcstValue;
    if (item.category === 'PTY') row.pty = item.fcstValue;
    if (item.category === 'SKY') row.sky = item.fcstValue;
  });

  return [...rows.values()].filter((row) => row.time).slice(0, 8);
}

function createDailyRows(hourlyRows) {
  const byDate = new Map();

  hourlyRows.forEach((row) => {
    if (!row.date || byDate.has(row.date)) return;
    byDate.set(row.date, row);
  });

  return [...byDate.values()].slice(0, 6).map((row, index) => ({
    label: index === 0 ? '오늘' : index === 1 ? '내일' : row.date?.slice(4).replace(/(\d{2})(\d{2})/, '$1/$2') ?? `${index + 1}일 뒤`,
    weather: conditionFromKmaValues(row),
    detail: `${formatTemperature(row.temperature)} · ${formatKmaRain(row.rn1)}`,
    mark: conditionToMark(conditionFromKmaValues(row)),
    tone: conditionToTone(conditionFromKmaValues(row)),
  }));
}

function conditionFromKmaValues(values) {
  const pty = String(values.pty ?? '0');
  const sky = String(values.sky ?? '');
  const rain = Number(values.rn1 ?? 0);

  if (['1', '5'].includes(pty) || rain > 0) return '비';
  if (['2', '6'].includes(pty)) return '진눈깨비';
  if (['3', '7'].includes(pty)) return '눈';
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

function conditionToMark(condition) {
  if (condition.includes('비')) return '비';
  if (condition.includes('눈')) return '눈';
  if (condition.includes('맑')) return '맑음';
  if (condition.includes('구름')) return '구름';

  return '흐림';
}

function conditionToTone(condition) {
  if (condition.includes('비')) return '#6f8da8';
  if (condition.includes('눈')) return '#9db5c5';
  if (condition.includes('맑')) return '#b79b57';
  if (condition.includes('구름')) return '#8f9191';

  return '#777b80';
}
