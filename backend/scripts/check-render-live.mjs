const baseUrl = process.env.RENDER_BACKEND_URL ?? 'https://weather-check-backend-hvfs.onrender.com';

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
  interpretationNote: 'Render 운영 서버 실제 예보 비교 확인용입니다.',
  needsClarification: false,
};

const providerStatus = await readJson(`${baseUrl}/provider-status`);
const snapshot = await writeJson(`${baseUrl}/weather/provider-snapshot`, { context });
const requiredProviders = ['kma', 'yr', 'fmi'];
const configuredProviders = new Set(
  providerStatus.providers
    ?.filter((provider) => provider.enabled && provider.configured)
    .map((provider) => provider.providerId),
);
const liveProviders = new Set(snapshot.meta?.liveProviderIds ?? []);
const missingConfigured = requiredProviders.filter((providerId) => !configuredProviders.has(providerId));
const missingLive = requiredProviders.filter((providerId) => !liveProviders.has(providerId));
const firstFmiCell = snapshot.hourlyRows?.[0]?.fmi ?? snapshot.hourlyRows?.[0]?.windy;

if (missingConfigured.length > 0 || missingLive.length > 0) {
  throw new Error(
    [
      missingConfigured.length > 0 ? `Not configured: ${missingConfigured.join(', ')}` : '',
      missingLive.length > 0 ? `Not live: ${missingLive.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' / '),
  );
}

if (!firstFmiCell || firstFmiCell.weather === '자료 없음') {
  throw new Error('FMI current-hour forecast is missing from the first comparison row.');
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      providerMode: providerStatus.providerMode,
      liveProviderIds: snapshot.meta.liveProviderIds,
      fallbackProviderIds: snapshot.meta.fallbackProviderIds,
      sources: snapshot.sources.map((source) => ({
        providerId: source.providerId,
        name: source.name,
        condition: source.condition,
        temp: source.temp,
        detail: source.detail,
      })),
      firstHourly: snapshot.hourlyRows[0],
      firstDaily: snapshot.dailyRows[0],
    },
    null,
    2,
  ),
);

async function readJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });

  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }

  return response.json();
}

async function writeJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }

  return response.json();
}
