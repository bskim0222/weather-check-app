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

  return createYrForecastModel(await response.json());
}

export function createYrForecastModel(payload) {
  const timeseries = Array.isArray(payload?.properties?.timeseries)
    ? payload.properties.timeseries
    : [];
  const current = timeseries[0];
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
    hourlyRows: createRows(timeseries.slice(0, 8), 'hourly'),
    dailyRows: createDailyRows(timeseries),
  };
}

export function shouldUseYrProvider() {
  const mode = process.env.WEATHER_PROVIDER_MODE ?? '';

  return mode === 'yr' || mode === 'real' || mode.split(',').map((item) => item.trim()).includes('yr');
}

function createRows(items, mode) {
  return items.slice(0, 6).map((item, index) => {
    const symbol = getSymbolCode(item);
    const details = item?.data?.instant?.details ?? {};
    const precipitation = getPrecipitationAmount(item);

    return {
      label: mode === 'hourly' ? formatHourLabel(item?.time, index) : formatDayLabel(item?.time, index),
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
    const hour = typeof item?.time === 'string' ? item.time.slice(11, 13) : '';

    if (!date || byDate.has(date)) return;
    if (hour === '12' || byDate.size === 0) {
      byDate.set(date, item);
    }
  });

  return createRows([...byDate.values()].slice(0, 6), 'daily');
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
  if (symbol.includes('rain')) return '비';
  if (symbol.includes('fog')) return '안개';
  if (symbol.includes('clearsky') || symbol.includes('fair')) return '맑음';
  if (symbol.includes('partlycloudy')) return '구름 조금';

  return '흐림';
}

function symbolToMark(symbol) {
  if (symbol.includes('thunder')) return '번개';
  if (symbol.includes('snow') || symbol.includes('sleet')) return '눈';
  if (symbol.includes('rain')) return '비';
  if (symbol.includes('fog')) return '안개';
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

function formatHourLabel(value, index) {
  if (index === 0) return '지금';
  if (typeof value !== 'string') return `${index}시간 뒤`;

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
