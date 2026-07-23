const backendUrl = (process.env.WEATHER_CHECK_LIVE_API_URL
  ?? 'https://weather-check-backend-hvfs.onrender.com').replace(/\/$/, '');
const webUrl = (process.env.WEATHER_CHECK_LIVE_WEB_URL
  ?? 'https://weather-check-web.onrender.com').replace(/\/$/, '');
const requiredProviders = ['kma', 'yr', 'fmi'];
const scenarios = [
  {
    label: '서울 잠실',
    place: '서울 송파구 잠실동',
    latitude: 37.5133,
    longitude: 127.1001,
    geocodeQuery: '잠실역',
  },
  {
    label: '부산역',
    place: '부산 동구 부산역',
    latitude: 35.1151,
    longitude: 129.0414,
    geocodeQuery: '부산역',
  },
  {
    label: '제주공항',
    place: '제주특별자치도 제주국제공항',
    latitude: 33.5104,
    longitude: 126.4914,
    geocodeQuery: '제주공항',
  },
];

const results = [];
const health = await requestJson(`${backendUrl}/health`);
assert(health.ok === true, 'backend health response');
assert(health.storage?.ok === true, 'Postgres storage health');
assert(health.storage?.mode === 'postgres', `Postgres storage mode (received ${health.storage?.mode ?? 'missing'})`);

const providerStatus = await requestJson(`${backendUrl}/provider-status`);
const configuredProviders = new Set(
  providerStatus.providers
    ?.filter((provider) => provider.enabled && provider.configured)
    .map((provider) => provider.providerId),
);
requiredProviders.forEach((providerId) => {
  assert(configuredProviders.has(providerId), `${providerId} is configured`);
});

for (const scenario of scenarios) {
  const geocode = await requestJson(`${backendUrl}/geocode`, {
    method: 'POST',
    body: { query: scenario.geocodeQuery },
  });
  assert(geocode.ok === true, `${scenario.label} geocoding`);
  assert(isKoreaCoordinate(geocode.location), `${scenario.label} geocoding stays in South Korea`);
  assert(
    distanceKm(geocode.location, scenario) < 30,
    `${scenario.label} geocoding is near its expected area`,
  );

  const startedAt = Date.now();
  const snapshot = await requestJson(`${backendUrl}/weather/provider-snapshot`, {
    method: 'POST',
    body: {
      context: createContext(scenario, '지금'),
    },
  });
  const elapsedMs = Date.now() - startedAt;
  validateSnapshot(snapshot, scenario, '지금');
  results.push(summarizeSnapshot(snapshot, scenario, elapsedMs));
}

const futureScenario = scenarios[0];
const futureSnapshot = await requestJson(`${backendUrl}/weather/provider-snapshot`, {
  method: 'POST',
  body: {
    context: createContext(futureScenario, '내일 09시'),
  },
});
validateSnapshot(futureSnapshot, futureScenario, '내일 09시');
assert(
  futureSnapshot.hourlyRows[0]?.forecastKey >= getTomorrowNineKey(),
  `future forecast begins at the requested time (received ${futureSnapshot.hourlyRows[0]?.forecastKey ?? 'missing'})`,
);

const webResponse = await fetchWithTimeout(webUrl, { headers: { accept: 'text/html' } }, 45_000);
assert(webResponse.ok, `web app responds (${webResponse.status})`);
const webHtml = await webResponse.text();
assert(webHtml.includes('<div id="root">'), 'web app contains the React root');
assert(webHtml.includes('manifest.webmanifest'), 'web app exposes its PWA manifest');

console.log(JSON.stringify({
  ok: true,
  checkedAt: new Date().toISOString(),
  backendUrl,
  webUrl,
  storageMode: health.storage.mode,
  scenarios: results,
  future: {
    label: futureScenario.label,
    requested: '내일 09시',
    firstForecastKey: futureSnapshot.hourlyRows[0]?.forecastKey,
    liveProviderIds: futureSnapshot.meta.liveProviderIds,
  },
}, null, 2));

function createContext(scenario, timeLabel) {
  return {
    raw: `${scenario.place} ${timeLabel} 날씨`,
    place: scenario.place,
    target: {
      id: `release-check-${scenario.label}`,
      label: scenario.place,
      kind: 'known-place',
      latitude: scenario.latitude,
      longitude: scenario.longitude,
      radiusMeters: 1200,
    },
    timeLabel,
    detectedWeather: '',
    interpretationNote: '운영 안정성 자동 검증',
    needsClarification: false,
  };
}

function validateSnapshot(snapshot, scenario, requestedTime) {
  assert(snapshot.source === 'api', `${scenario.label} ${requestedTime} uses live data`);
  assert(snapshot.context?.place === scenario.place, `${scenario.label} response keeps the requested place`);
  assert(snapshot.context?.timeLabel === requestedTime, `${scenario.label} response keeps the requested time`);
  requiredProviders.forEach((providerId) => {
    assert(snapshot.meta?.liveProviderIds?.includes(providerId), `${scenario.label} ${providerId} is live`);
  });
  assert(snapshot.meta?.fallbackProviderIds?.length === 0, `${scenario.label} has no fallback provider`);
  assert(snapshot.sources?.length === 3, `${scenario.label} has exactly three provider summaries`);
  assert(snapshot.hourlyRows?.length >= 6, `${scenario.label} has at least six hourly rows`);
  assert(snapshot.dailyRows?.length >= 3, `${scenario.label} has at least three daily rows`);
  assertOrderedUnique(snapshot.hourlyRows.map((row) => row.forecastKey), `${scenario.label} hourly keys`);
  assertOrderedUnique(snapshot.dailyRows.map((row) => row.periodKey), `${scenario.label} daily keys`);

  const firstRow = snapshot.hourlyRows[0];
  requiredProviders.forEach((providerId) => {
    const cell = firstRow[providerId];
    const summary = snapshot.sources.find((source) => source.providerId === providerId);
    assert(isUsableCell(cell), `${scenario.label} ${providerId} first-hour data`);
    assert(summary, `${scenario.label} ${providerId} summary`);
    assert(summary.condition === cell.weather, `${scenario.label} ${providerId} summary condition matches comparison row`);
    assert(readTemperature(summary.temp) === readTemperature(cell.detail), `${scenario.label} ${providerId} summary temperature matches comparison row`);
  });

  if (requestedTime === '지금') {
    const currentKey = getKoreaHourKey();
    assert(
      firstRow.forecastKey === currentKey,
      `${scenario.label} current row uses the current Korea hour (${currentKey}, received ${firstRow.forecastKey})`,
    );
  }
}

function summarizeSnapshot(snapshot, scenario, elapsedMs) {
  return {
    label: scenario.label,
    responseMs: elapsedMs,
    firstForecastKey: snapshot.hourlyRows[0].forecastKey,
    providers: snapshot.sources.map((source) => ({
      providerId: source.providerId,
      condition: source.condition,
      temp: source.temp,
    })),
  };
}

async function requestJson(url, options = {}) {
  const response = await fetchWithTimeout(url, {
    method: options.method ?? 'GET',
    headers: {
      accept: 'application/json',
      ...(options.body === undefined ? {} : { 'content-type': 'application/json; charset=utf-8' }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }, 90_000);
  const text = await response.text();
  if (!response.ok) throw new Error(`${url} failed with ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function isUsableCell(cell) {
  return cell && cell.weather !== '자료 없음' && cell.mark !== '-' && Number.isFinite(readTemperature(cell.detail));
}

function readTemperature(value) {
  const match = String(value ?? '').match(/(-?\d+(?:\.\d+)?)\s*℃/);
  const temperature = match ? Number(match[1]) : Number.NaN;
  return temperature >= -60 && temperature <= 60 ? temperature : Number.NaN;
}

function assertOrderedUnique(values, label) {
  assert(values.every(Boolean), `${label} are present`);
  assert(new Set(values).size === values.length, `${label} are unique`);
  for (let index = 1; index < values.length; index += 1) {
    assert(values[index] > values[index - 1], `${label} are chronological`);
  }
}

function getKoreaHourKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}`;
}

function getTomorrowNineKey() {
  const now = new Date();
  const koreaDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  koreaDate.setUTCDate(koreaDate.getUTCDate() + 1);
  return `${koreaDate.getUTCFullYear()}-${String(koreaDate.getUTCMonth() + 1).padStart(2, '0')}-${String(koreaDate.getUTCDate()).padStart(2, '0')}T09`;
}

function isKoreaCoordinate(value) {
  return Number.isFinite(value?.latitude)
    && Number.isFinite(value?.longitude)
    && value.latitude >= 32.5
    && value.latitude <= 38.7
    && value.longitude >= 124.5
    && value.longitude <= 132;
}

function distanceKm(a, b) {
  const radiusKm = 6371;
  const latitudeDelta = toRadians(a.latitude - b.latitude);
  const longitudeDelta = toRadians(a.longitude - b.longitude);
  const latitudeA = toRadians(b.latitude);
  const latitudeB = toRadians(a.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function assert(value, label) {
  if (!value) throw new Error(`Release live check failed: ${label}`);
}
