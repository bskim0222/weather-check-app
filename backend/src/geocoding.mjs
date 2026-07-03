const nominatimEndpoint = 'https://nominatim.openstreetmap.org/search';
const nominatimReverseEndpoint = 'https://nominatim.openstreetmap.org/reverse';
const defaultUserAgent = 'WeatherCheck/0.1 weathercheck.official@gmail.com';
const cache = new Map();

const aliases = [
  createAlias('yongin-cc', ['용인cc', '용인CC'], '용인CC', 37.1126704, 127.3447246, 1200),
  createAlias('blueone-yongin-cc', ['블루원용인cc', '블루원 용인cc', '블루원 용인CC'], '블루원 용인CC', 37.1296038, 127.3221861, 1200),
  createAlias('hongdae', ['홍대앞', '홍대입구', '홍대'], '홍대앞', 37.5563, 126.9236, 900),
  createAlias('gangnam-station', ['강남역', '강남역 11번출구', '강남역11번출구'], '강남역', 37.4979, 127.0276, 900),
  createAlias('seongsu', ['성수동', '성수역'], '성수동', 37.5446, 127.0557, 1100),
  createAlias('yeouido', ['여의도', '여의도공원'], '여의도', 37.5269, 126.9239, 1600),
];

export async function geocodePlace(query, raw = '') {
  const cleanQuery = cleanPlaceQuery(query);

  if (!cleanQuery) return null;

  const alias = findAlias(cleanQuery);
  if (alias) return alias;

  const cacheKey = normalizeQuery(cleanQuery);
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const result = await fetchNominatim(cleanQuery, raw);
  cache.set(cacheKey, result);

  return result;
}

export async function reverseGeocodePoint(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const cacheKey = `reverse:${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const result = await fetchNominatimReverse(lat, lon);
  cache.set(cacheKey, result);

  return result;
}

function createAlias(id, names, label, latitude, longitude, radiusMeters) {
  return {
    id,
    names,
    result: {
      source: 'alias',
      displayName: label,
      location: {
        id,
        label,
        kind: 'custom',
        latitude,
        longitude,
        radiusMeters,
      },
    },
  };
}

function findAlias(query) {
  const normalized = normalizeQuery(query);
  const found = aliases.find((item) => item.names.some((name) => normalizeQuery(name) === normalized));

  return found?.result ?? null;
}

async function fetchNominatim(query, raw) {
  const url = new URL(nominatimEndpoint);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'kr');
  url.searchParams.set('accept-language', 'ko');
  url.searchParams.set('q', createNominatimQuery(query, raw));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': process.env.GEOCODING_USER_AGENT || process.env.YR_USER_AGENT || defaultUserAgent,
    },
  });

  if (!response.ok) return null;

  const rows = await response.json();
  const first = Array.isArray(rows) ? rows[0] : null;
  const latitude = Number(first?.lat);
  const longitude = Number(first?.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const label = createLocationLabel(query, first.display_name);

  return {
    source: 'nominatim',
    displayName: first.display_name,
    location: {
      id: `geocoded-${normalizeQuery(label).replace(/[^a-z0-9가-힣]+/gi, '-')}`,
      label,
      kind: 'custom',
      latitude,
      longitude,
      radiusMeters: getRadiusMeters(first),
    },
  };
}

async function fetchNominatimReverse(latitude, longitude) {
  const url = new URL(nominatimReverseEndpoint);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('accept-language', 'ko');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': process.env.GEOCODING_USER_AGENT || process.env.YR_USER_AGENT || defaultUserAgent,
    },
  });

  if (!response.ok) return null;

  const row = await response.json();
  const address = row?.address ?? {};
  const label = createReverseLocationLabel(address, row?.display_name);

  if (!label) return null;

  return {
    source: 'nominatim',
    displayName: row?.display_name,
    location: {
      id: `reverse-${normalizeQuery(label).replace(/[^a-z0-9가-힣]+/gi, '-')}`,
      label,
      kind: 'custom',
      latitude,
      longitude,
      radiusMeters: 1200,
    },
  };
}

function createNominatimQuery(query, raw) {
  if (/[가-힣]/.test(query) && !query.includes('대한민국')) {
    return `${query} 대한민국`;
  }

  return query || raw;
}

function createLocationLabel(query, displayName = '') {
  const clean = cleanPlaceQuery(query);
  if (clean) return clean;

  return String(displayName).split(',')[0]?.trim() || '검색한 장소';
}

function createReverseLocationLabel(address, displayName = '') {
  const city = compactRegionName(address.city || address.province || address.state);
  const district = compactRegionName(address.borough || address.county || address.city_district);
  const neighborhood = compactRegionName(
    address.neighbourhood ||
      address.suburb ||
      address.quarter ||
      address.village ||
      address.town ||
      address.hamlet,
  );
  const road = compactRegionName(address.road);
  const parts = [city, district, neighborhood || road].filter(Boolean);

  if (parts.length > 0) return unique(parts).join(' ');

  return String(displayName).split(',').slice(0, 3).map(compactRegionName).filter(Boolean).join(' ');
}

function getRadiusMeters(row) {
  if (row?.type === 'golf_course') return 1200;
  if (row?.type === 'station' || row?.type === 'subway') return 700;

  return 1000;
}

function cleanPlaceQuery(value) {
  return String(value ?? '')
    .replace(/[?？!！]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(오늘|내일|모레|주말|아침|오전|오후|저녁|밤|새벽|점심|낮|\d{1,2}시)\s*/g, '')
    .trim();
}

function normalizeQuery(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
}

function compactRegionName(value) {
  return String(value ?? '')
    .replace(/특별시/g, '')
    .replace(/광역시/g, '')
    .replace(/특별자치시/g, '')
    .replace(/특별자치도/g, '')
    .replace(/자치도/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values) {
  return values.filter((value, index) => values.indexOf(value) === index);
}
