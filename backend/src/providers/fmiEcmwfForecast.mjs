const fmiEndpoint = 'https://opendata.fmi.fi/wfs';
const storedQueryId = 'ecmwf::forecast::surface::point::timevaluepair';

export async function fetchFmiEcmwfForecast(context) {
  const coordinates = getCoordinates(context);

  if (!coordinates) {
    return null;
  }

  const url = new URL(fmiEndpoint);
  url.searchParams.set('service', 'WFS');
  url.searchParams.set('version', '2.0.0');
  url.searchParams.set('request', 'getFeature');
  url.searchParams.set('storedquery_id', storedQueryId);
  url.searchParams.set('latlon', `${roundCoordinate(coordinates.latitude)},${roundCoordinate(coordinates.longitude)}`);
  url.searchParams.set('starttime', new Date().toISOString());
  url.searchParams.set('endtime', new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString());

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`FMI request failed with ${response.status}.`);
  }

  return createFmiForecastModel(await response.text());
}

export function createFmiForecastModel(xml) {
  const series = parseFmiTimeValueSeries(xml);
  const rows = mergeFmiRows(series);
  const hourlyRows = rows.slice(0, 8);
  const current = rows[0] ?? {};
  const condition = conditionFromFmiValues(current);

  return {
    current: {
      condition,
      temp: formatTemperature(current.Temperature),
      detail: createDetail(current.Precipitation1h, current.WindSpeedMS),
      badge: condition,
      value: formatPrecipitation(current.Precipitation1h),
      mark: conditionToMark(condition),
      tone: conditionToTone(condition),
    },
    hourlyRows: hourlyRows.map((row, index) => {
      const rowCondition = conditionFromFmiValues(row);

      return {
        label: index === 0 ? '지금' : formatHourLabel(row.time),
        weather: rowCondition,
        detail: `${formatTemperature(row.Temperature)} · ${formatPrecipitation(row.Precipitation1h)}`,
        mark: conditionToMark(rowCondition),
        tone: conditionToTone(rowCondition),
      };
    }),
    dailyRows: createDailyRows(rows),
  };
}

export function shouldUseFmiProvider() {
  const mode = process.env.WEATHER_PROVIDER_MODE ?? '';

  return mode === 'fmi' || mode === 'real' || mode.split(',').map((item) => item.trim()).includes('fmi');
}

export function parseFmiTimeValueSeries(xml) {
  const members = [...xml.matchAll(/<wfs:member>([\s\S]*?)<\/wfs:member>/g)];

  return members.reduce((acc, memberMatch) => {
    const member = memberMatch[1];
    const param = decodeXml(member.match(/param=([^&"]+)/)?.[1] ?? '');

    if (!param) return acc;

    const values = [...member.matchAll(/<wml2:MeasurementTVP>\s*<wml2:time>([^<]+)<\/wml2:time>\s*<wml2:value>([^<]+)<\/wml2:value>/g)]
      .map((match) => ({
        time: match[1],
        value: parseFmiNumber(match[2]),
      }))
      .filter((item) => item.value !== null);

    if (values.length > 0) {
      acc[param] = values;
    }

    return acc;
  }, {});
}

function mergeFmiRows(series) {
  const byTime = new Map();

  Object.entries(series).forEach(([param, values]) => {
    values.forEach((item) => {
      if (!byTime.has(item.time)) {
        byTime.set(item.time, { time: item.time });
      }

      byTime.get(item.time)[param] = item.value;
    });
  });

  return [...byTime.values()].sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

function createDailyRows(rows) {
  const byDate = new Map();

  rows.forEach((row) => {
    const date = typeof row.time === 'string' ? row.time.slice(0, 10) : '';

    if (!date || byDate.has(date)) return;
    byDate.set(date, row);
  });

  return [...byDate.values()].slice(0, 6).map((row, index) => {
    const condition = conditionFromFmiValues(row);

    return {
      label: index === 0 ? '오늘' : index === 1 ? '내일' : row.time.slice(5, 10).replace('-', '/'),
      weather: condition,
      detail: `${formatTemperature(row.Temperature)} · ${formatPrecipitation(row.Precipitation1h)}`,
      mark: conditionToMark(condition),
      tone: conditionToTone(condition),
    };
  });
}

function conditionFromFmiValues(values) {
  const weatherSymbol = Number(values.WeatherSymbol3);
  const precipitation = Number(values.Precipitation1h ?? 0);
  const cloudCover = Number(values.TotalCloudCover ?? 100);

  if ([51, 52, 53, 61, 62, 63, 64, 65, 80, 81, 82].includes(weatherSymbol) || precipitation > 0.1) {
    return '비';
  }

  if ([71, 72, 73, 74, 75, 85, 86].includes(weatherSymbol)) {
    return '눈';
  }

  if ([21, 22].includes(weatherSymbol) || cloudCover < 25) return '맑음';
  if (cloudCover < 70) return '구름 조금';

  return '흐림';
}

function createDetail(precipitation, wind) {
  const parts = [`강수 ${formatPrecipitation(precipitation)}`];

  if (wind !== null && wind !== undefined) {
    parts.push(`바람 ${Math.round(Number(wind))}m/s`);
  }

  return parts.join(' · ');
}

function getCoordinates(context) {
  const latitude = Number(context?.target?.latitude);
  const longitude = Number(context?.target?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function formatTemperature(value) {
  const number = Number(value);

  return Number.isFinite(number) ? `${Math.round(number)}℃` : '--℃';
}

function formatPrecipitation(value) {
  const number = Number(value);

  return Number.isFinite(number) ? `${roundOneDecimal(number)}mm` : '0mm';
}

function formatHourLabel(value) {
  return typeof value === 'string' ? `${value.slice(11, 13)}시` : '예보';
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

function roundCoordinate(value) {
  return String(Math.round(value * 10000) / 10000);
}

function roundOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function parseFmiNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
