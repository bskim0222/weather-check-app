import { formatSeoulDateHour, getForecastWindow, getTargetTimestampMs, pickTargetItem } from '../timeIntent.mjs';

const yrEndpoint = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';

export async function fetchYrLocationforecast(context) {
  const coordinates = getCoordinates(context);
  const userAgent = process.env.YR_USER_AGENT ?? process.env.EXPO_PUBLIC_YR_USER_AGENT ?? '';

  if (!coordinates || !userAgent.trim()) {
    return null;
  }

  const url = new URL(yrEndpoint);
  url.searchParams.set('lat', roundCoordinate(coordinates.latitude));
  url.searchParams.set('lon', roundCoordinate(coordinates.longitude));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': userAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`Yr.no request failed with ${response.status}.`);
  }

  return createYrForecastModel(await response.json(), context);
}

export function createYrForecastModel(payload, context = null) {
  const timeseries = Array.isArray(payload?.properties?.timeseries)
    ? payload.properties.timeseries
    : [];
  const targetMs = getTargetTimestampMs(context);
  const forecastWindow = getForecastWindow(timeseries, getItemTimeMs, targetMs, 18);
  const current = pickTargetItem(timeseries, getItemTimeMs, targetMs);
  const currentDetails = current?.data?.instant?.details ?? {};
  const currentSymbol = getSymbolCode(current);
  const currentPrecipitation = getPrecipitationAmount(current);
  const currentWind = numberOrNull(currentDetails.wind_speed);
  const temperature = numberOrNull(currentDetails.air_temperature);
  const condition = symbolToCondition(currentSymbol);

  return {
    current: {
      condition,
      temp: formatTemperature(temperature),
      detail: createDetail(currentPrecipitation, currentWind),
      badge: condition,
      value: formatPrecipitation(currentPrecipitation),
      mark: symbolToMark(currentSymbol),
      tone: symbolToTone(currentSymbol),
    },
    hourlyRows: createRows(forecastWindow, 'hourly', targetMs),
    dailyRows: createDailyRows(timeseries),
  };
}

export function shouldUseYrProvider() {
  const mode = process.env.WEATHER_PROVIDER_MODE ?? '';

  return mode === 'yr' || mode === 'real' || mode.split(',').map((item) => item.trim()).includes('yr');
}

function createRows(items, mode, targetMs = null) {
  return items.slice(0, 18).map((item, index) => {
    const symbol = getSymbolCode(item);
    const details = item?.data?.instant?.details ?? {};
    const precipitation = getPrecipitationAmount(item);

    return {
      label: mode === 'hourly' ? formatHourLabel(item?.time, index, targetMs) : formatDayLabel(item?.time, index),
      weather: symbolToCondition(symbol),
      detail: `${formatTemperature(numberOrNull(details.air_temperature))} · ${formatPrecipitation(precipitation)}`,
      mark: symbolToMark(symbol),
      tone: symbolToTone(symbol),
    };
  });
}

function createDailyRows(timeseries) {
  const byDate = new Map();

  timeseries.forEach((item) => {
    const date = typeof item?.time === 'string' ? item.time.slice(0, 10) : '';

    if (!date) return;
    const rows = byDate.get(date) ?? [];
    rows.push(item);
    byDate.set(date, rows);
  });

  return [...byDate.entries()].slice(0, 10).map(([date, rows], index) => {
    const morning = createYrDailyPeriod(pickClosestIsoHour(rows, 9));
    const afternoon = createYrDailyPeriod(pickClosestIsoHour(rows, 15));
    const representative = afternoon ?? morning ?? createYrDailyPeriod(rows[0]);

    return {
      label: index === 0 ? '오늘' : index === 1 ? '내일' : index === 2 ? '모레' : date.slice(5, 10).replace('-', '/'),
      weather: representative.weather,
      detail: representative.detail,
      mark: representative.mark,
      tone: representative.tone,
      morning,
      afternoon,
    };
  });
}

function pickClosestIsoHour(rows, targetHour) {
  return rows.reduce((best, row) => {
    const hour = Number(typeof row?.time === 'string' ? row.time.slice(11, 13) : NaN);
    if (!Number.isFinite(hour)) return best;
    if (!best) return row;

    const bestHour = Number(typeof best?.time === 'string' ? best.time.slice(11, 13) : NaN);

    return Math.abs(hour - targetHour) < Math.abs(bestHour - targetHour) ? row : best;
  }, null);
}

function createYrDailyPeriod(item) {
  if (!item) return null;

  const symbol = getSymbolCode(item);
  const details = item?.data?.instant?.details ?? {};
  const precipitation = getPrecipitationAmount(item);

  return {
    weather: symbolToCondition(symbol),
    detail: `${formatTemperature(numberOrNull(details.air_temperature))} · ${formatPrecipitation(precipitation)}`,
    mark: symbolToMark(symbol),
    tone: symbolToTone(symbol),
  };
}

function getItemTimeMs(item) {
  const value = typeof item?.time === 'string' ? Date.parse(item.time) : NaN;

  return Number.isFinite(value) ? value : NaN;
}

function getCoordinates(context) {
  const latitude = Number(context?.target?.latitude);
  const longitude = Number(context?.target?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function getSymbolCode(item) {
  return (
    item?.data?.next_1_hours?.summary?.symbol_code ??
    item?.data?.next_6_hours?.summary?.symbol_code ??
    item?.data?.next_12_hours?.summary?.symbol_code ??
    'cloudy'
  );
}

function getPrecipitationAmount(item) {
  return numberOrNull(
    item?.data?.next_1_hours?.details?.precipitation_amount ??
      item?.data?.next_6_hours?.details?.precipitation_amount ??
      item?.data?.next_12_hours?.details?.precipitation_amount,
  );
}

function symbolToCondition(symbol) {
  if (symbol.includes('thunder')) return '천둥번개';
  if (symbol.includes('snow') || symbol.includes('sleet')) return '눈';
  if (symbol.includes('rainshowers')) return '소나기';
  if (symbol.includes('rain')) return '비';
  if (symbol.includes('fog')) return '안개';
  if (symbol.includes('night') && (symbol.includes('clearsky') || symbol.includes('fair'))) return '맑은 밤';
  if (symbol.includes('clearsky') || symbol.includes('fair')) return '맑음';
  if (symbol.includes('partlycloudy')) return '구름 조금';

  return '흐림';
}

function symbolToMark(symbol) {
  if (symbol.includes('thunder')) return '번개';
  if (symbol.includes('snow') || symbol.includes('sleet')) return '눈';
  if (symbol.includes('rainshowers')) return '소나기';
  if (symbol.includes('rain')) return '비';
  if (symbol.includes('fog')) return '안개';
  if (symbol.includes('night') && (symbol.includes('clearsky') || symbol.includes('fair'))) return '밤';
  if (symbol.includes('clearsky') || symbol.includes('fair')) return '맑음';

  return '구름';
}

function symbolToTone(symbol) {
  if (symbol.includes('thunder')) return '#8a5a74';
  if (symbol.includes('snow') || symbol.includes('sleet')) return '#9db5c5';
  if (symbol.includes('rain')) return '#6f8da8';
  if (symbol.includes('fog')) return '#9c978d';
  if (symbol.includes('clearsky') || symbol.includes('fair')) return '#b79b57';

  return '#8f9191';
}

function createDetail(precipitation, wind) {
  const parts = [`강수 ${formatPrecipitation(precipitation)}`];

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

function formatHourLabel(value, index, targetMs = null) {
  if (!Number.isFinite(targetMs) && index === 0) return '지금';
  if (typeof value !== 'string') return `${index}시간 뒤`;
  if (Number.isFinite(targetMs)) return formatSeoulDateHour(value);

  return `${value.slice(11, 13)}시`;
}

function formatDayLabel(value, index) {
  if (index === 0) return '오늘';
  if (index === 1) return '내일';
  if (index === 2) return '모레';
  if (typeof value !== 'string') return `${index + 1}일 뒤`;

  return value.slice(5, 10).replace('-', '/');
}

function roundCoordinate(value) {
  return String(Math.round(value * 10000) / 10000);
}

function roundOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function numberOrNull(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}
