const windyEndpoint = 'https://api.windy.com/api/point-forecast/v2';

export async function fetchWindyPointForecast(context) {
  const coordinates = getCoordinates(context);
  const apiKey = process.env.WINDY_API_KEY ?? process.env.EXPO_PUBLIC_WINDY_API_KEY ?? '';

  if (!coordinates || !apiKey.trim()) {
    return null;
  }

  const response = await fetch(windyEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      lat: coordinates.latitude,
      lon: coordinates.longitude,
      model: process.env.WINDY_MODEL ?? 'gfs',
      parameters: ['temp', 'precip', 'ptype', 'wind', 'lclouds', 'mclouds', 'hclouds'],
      levels: ['surface'],
      key: apiKey,
    }),
  });

  if (!response.ok) {
    throw new Error(`Windy request failed with ${response.status}.`);
  }

  return createWindyForecastModel(await response.json());
}

export function createWindyForecastModel(payload) {
  const timestamps = Array.isArray(payload?.ts) ? payload.ts : [];
  const rows = timestamps.slice(0, 18).map((timestamp, index) => {
    const values = getWindyValues(payload, index);
    const condition = conditionFromWindyValues(values);

    return {
      timestamp,
      label: index === 0 ? '지금' : formatHourLabel(timestamp),
      weather: condition,
      detail: `${formatTemperature(values.temp)} · ${formatPrecipitation(values.precip)}`,
      mark: conditionToMark(condition),
      tone: conditionToTone(condition),
      condition,
      temp: values.temp,
      precip: values.precip,
      wind: values.wind,
    };
  });
  const current = rows[0] ?? {
    condition: '흐림',
    temp: null,
    precip: null,
    wind: null,
    weather: '흐림',
    detail: '--℃ · 0mm',
    mark: '흐림',
    tone: '#777b80',
  };

  return {
    current: {
      condition: current.condition,
      temp: formatTemperature(current.temp),
      detail: createDetail(current.precip, current.wind),
      badge: current.condition,
      value: formatPrecipitation(current.precip),
      mark: conditionToMark(current.condition),
      tone: conditionToTone(current.condition),
    },
    hourlyRows: rows.map(stripInternalRowFields),
    dailyRows: createDailyRows(rows),
  };
}

export function shouldUseWindyProvider() {
  const mode = process.env.WEATHER_PROVIDER_MODE ?? '';

  return mode === 'windy' || mode === 'real' || mode.split(',').map((item) => item.trim()).includes('windy');
}

function getCoordinates(context) {
  const latitude = Number(context?.target?.latitude);
  const longitude = Number(context?.target?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function getWindyValues(payload, index) {
  const windU = numberOrNull(payload?.['wind_u-surface']?.[index]);
  const windV = numberOrNull(payload?.['wind_v-surface']?.[index]);

  return {
    temp: numberOrNull(payload?.['temp-surface']?.[index]),
    precip: numberOrNull(payload?.['past3hprecip-surface']?.[index]),
    ptype: numberOrNull(payload?.['ptype-surface']?.[index]),
    lclouds: numberOrNull(payload?.['lclouds-surface']?.[index]),
    mclouds: numberOrNull(payload?.['mclouds-surface']?.[index]),
    hclouds: numberOrNull(payload?.['hclouds-surface']?.[index]),
    wind: windU !== null && windV !== null ? Math.sqrt(windU * windU + windV * windV) : null,
  };
}

function conditionFromWindyValues(values) {
  const celsius = Number(values.temp) - 273.15;

  if (Number(values.wind) >= 25) return '태풍';
  if (values.ptype === 5) return '눈';
  if (values.ptype === 7) return '진눈깨비';
  if ((values.precip ?? 0) > 8) return '소나기';
  if (values.ptype === 1 || values.ptype === 3 || (values.precip ?? 0) > 0.1) return '비';

  const cloudCover = Math.max(values.lclouds ?? 0, values.mclouds ?? 0, values.hclouds ?? 0);

  if (Number.isFinite(celsius) && celsius >= 35) return '폭염';
  if (cloudCover < 20) return '맑음';
  if (cloudCover < 60) return '구름 조금';

  return '흐림';
}

function createDailyRows(rows) {
  const byDate = new Map();

  rows.forEach((row) => {
    const date = typeof row.timestamp === 'number'
      ? new Date(row.timestamp).toISOString().slice(0, 10)
      : row.label;

    const items = byDate.get(date) ?? [];
    items.push(row);
    byDate.set(date, items);
  });

  return [...byDate.entries()].slice(0, 10).map(([date, rows], index) => {
    const morning = createWindyDailyPeriod(pickClosestWindyHour(rows, 9));
    const afternoon = createWindyDailyPeriod(pickClosestWindyHour(rows, 15));
    const representative = afternoon ?? morning ?? createWindyDailyPeriod(rows[0]);

    return {
      label: index === 0 ? '오늘' : index === 1 ? '내일' : String(date).slice(5).replace('-', '/'),
      weather: representative.weather,
      detail: representative.detail,
      mark: representative.mark,
      tone: representative.tone,
      morning,
      afternoon,
    };
  });
}

function pickClosestWindyHour(rows, targetHour) {
  return rows.reduce((best, row) => {
    const hour = Number.isFinite(row?.timestamp) ? new Date(row.timestamp).getUTCHours() + 9 : NaN;
    const normalizedHour = Number.isFinite(hour) ? hour % 24 : NaN;
    if (!Number.isFinite(normalizedHour)) return best;
    if (!best) return row;

    const bestHourRaw = Number.isFinite(best?.timestamp) ? new Date(best.timestamp).getUTCHours() + 9 : NaN;
    const bestHour = Number.isFinite(bestHourRaw) ? bestHourRaw % 24 : NaN;

    return Math.abs(normalizedHour - targetHour) < Math.abs(bestHour - targetHour) ? row : best;
  }, null);
}

function createWindyDailyPeriod(row) {
  if (!row) return null;

  return stripInternalRowFields(row);
}

function stripInternalRowFields(row) {
  return {
    label: row.label,
    weather: row.weather,
    detail: row.detail,
    mark: row.mark,
    tone: row.tone,
  };
}

function createDetail(precip, wind) {
  const parts = [`강수 ${formatPrecipitation(precip)}`];

  if (wind !== null) {
    parts.push(`바람 ${Math.round(wind)}m/s`);
  }

  return parts.join(' · ');
}

function formatTemperature(value) {
  return value === null ? '--℃' : `${Math.round(value)}℃`;
}

function formatPrecipitation(value) {
  return value === null ? '0mm' : `${roundOneDecimal(value)}mm`;
}

function formatHourLabel(value) {
  if (typeof value !== 'number') return '예보';

  return `${new Date(value).toISOString().slice(11, 13)}시`;
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

function roundOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function numberOrNull(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}
