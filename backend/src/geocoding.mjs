const kakaoKeywordEndpoint = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const kakaoAddressEndpoint = 'https://dapi.kakao.com/v2/local/search/address.json';
const kakaoReverseEndpoint = 'https://dapi.kakao.com/v2/local/geo/coord2address.json';
const nominatimEndpoint = 'https://nominatim.openstreetmap.org/search';
const nominatimReverseEndpoint = 'https://nominatim.openstreetmap.org/reverse';
const defaultUserAgent = 'WeatherCheck/0.1 weathercheck.official@gmail.com';
const cache = new Map();

const aliases = [
  createAlias('gimpo', ['김포', '김포시'], '김포시', 37.615, 126.7158, 5000),
  createAlias('seoraksan', ['설악산', '설악산국립공원', '설악산 국립공원'], '설악산', 38.1195, 128.4656, 5000),
  createAlias('cheongwadae', ['청와대', '청와대 본관'], '청와대', 37.5866, 126.9748, 900),
  createAlias('gwanghwamun', ['광화문', '광화문광장', '광화문 광장'], '광화문', 37.5759, 126.9768, 900),
  createAlias('dumulmeori', ['두물머리', '양평 두물머리'], '두물머리', 37.5303, 127.3115, 1200),
  createAlias('kyobo-jongno', ['종로 교보빌딩', '광화문 교보빌딩', '교보빌딩 종로', '교보빌딩 광화문'], '종로 교보빌딩', 37.5707, 126.9779, 500),
  createAlias('yongin-cc', ['용인cc', '용인CC'], '용인CC', 37.1126704, 127.3447246, 1200),
  createAlias('blueone-yongin-cc', ['블루원용인cc', '블루원 용인cc', '블루원 용인CC'], '블루원 용인CC', 37.1296038, 127.3221861, 1200),
  createAlias('hongdae', ['홍대앞', '홍대입구', '홍대'], '홍대앞', 37.5563, 126.9236, 900),
  createAlias('gangnam-station', ['강남역', '강남역 11번출구', '강남역11번출구'], '강남역', 37.4979, 127.0276, 900),
  createAlias('seongsu', ['성수동', '성수역'], '성수동', 37.5446, 127.0557, 1100),
  createAlias('yeouido', ['여의도', '여의도공원'], '여의도', 37.5269, 126.9239, 1600),
];

export async function geocodePlace(query, raw = '') {
  const candidates = await geocodePlaceCandidates(query, raw, 1);

  return candidates[0] ?? null;
}

export async function geocodePlaceCandidates(query, raw = '', limit = 6) {
  const cleanQuery = cleanPlaceQuery(query);

  if (!cleanQuery) return [];

  const cacheKey = `candidates:${normalizeQuery(cleanQuery)}:${limit}:${getKakaoRestApiKey() ? 'kakao' : 'fallback'}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const aliasCandidates = findAliasCandidates(cleanQuery);
  const kakaoCandidates = await fetchKakaoCandidates(cleanQuery);
  const needsFallback = kakaoCandidates.length === 0;
  const nominatimCandidates = needsFallback ? await fetchNominatimCandidates(cleanQuery, raw) : [];
  const candidates = dedupeCandidates([...aliasCandidates, ...kakaoCandidates, ...nominatimCandidates]).slice(0, limit);

  cache.set(cacheKey, candidates);

  return candidates;
}

export async function reverseGeocodePoint(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const cacheKey = `reverse:${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const result = await fetchKakaoReverse(lat, lon) ?? await fetchNominatimReverse(lat, lon);
  cache.set(cacheKey, result);

  return result;
}

export async function diagnoseKakaoLocal(query = '광화문') {
  const restApiKey = getKakaoRestApiKey();

  if (!restApiKey) {
    return {
      configured: false,
      ok: false,
      status: 0,
      message: 'KAKAO_REST_API_KEY is not configured.',
    };
  }

  const url = new URL(kakaoKeywordEndpoint);
  url.searchParams.set('query', cleanPlaceQuery(query) || '광화문');
  url.searchParams.set('size', '1');

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `KakaoAK ${restApiKey}`,
      },
    });
    const payload = await response.json().catch(() => ({}));

    return {
      configured: true,
      ok: response.ok,
      status: response.status,
      count: Array.isArray(payload?.documents) ? payload.documents.length : 0,
      errorType: payload?.errorType,
      message: payload?.message,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : 'Unknown Kakao Local error.',
    };
  }
}

function createAlias(id, names, label, latitude, longitude, radiusMeters) {
  return {
    id,
    names,
    result: {
      source: 'alias',
      displayName: label,
      subtitle: '자주 쓰는 장소',
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

function findAliasCandidates(query) {
  const normalized = normalizeQuery(query);

  return aliases
    .filter((item) =>
      item.names.some((name) => {
        const aliasName = normalizeQuery(name);

        return aliasName.includes(normalized) || normalized.includes(aliasName);
      }),
    )
    .map((item) => item.result);
}

async function fetchKakaoCandidates(query) {
  const keywordRows = await fetchKakaoRows(kakaoKeywordEndpoint, {
    query,
    size: '8',
    sort: 'accuracy',
  });
  const addressRows = await fetchKakaoRows(kakaoAddressEndpoint, {
    query,
    size: '5',
    analyze_type: 'similar',
  });

  const keywordCandidates = keywordRows.map(createKakaoKeywordCandidate).filter(Boolean);
  const addressCandidates = addressRows.map(createKakaoAddressCandidate).filter(Boolean);

  return prefersAdministrativePlace(query)
    ? [...addressCandidates, ...keywordCandidates]
    : [...keywordCandidates, ...addressCandidates];
}

async function fetchKakaoRows(endpoint, params) {
  const restApiKey = getKakaoRestApiKey();

  if (!restApiKey) return [];

  const url = new URL(endpoint);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `KakaoAK ${restApiKey}`,
    },
  });

  if (!response.ok) return [];

  const payload = await response.json();

  return Array.isArray(payload?.documents) ? payload.documents : [];
}

function createKakaoKeywordCandidate(row) {
  const latitude = Number(row?.y);
  const longitude = Number(row?.x);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const label = compactRegionName(row.place_name);
  const subtitle = compactRegionName(row.road_address_name || row.address_name || row.category_name);
  const radiusMeters = getKakaoRadiusMeters(row.category_group_code, row.category_name);

  return {
    source: 'kakao',
    displayName: row.place_name,
    subtitle,
    location: {
      id: `kakao-${row.id || normalizeQuery(`${label}-${latitude.toFixed(4)}-${longitude.toFixed(4)}`)}`,
      label,
      kind: 'custom',
      latitude,
      longitude,
      radiusMeters,
    },
  };
}

function createKakaoAddressCandidate(row) {
  const latitude = Number(row?.y);
  const longitude = Number(row?.x);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const address = row.road_address ?? row.address ?? {};
  const label = createKakaoAddressLabel(row);
  const subtitle = compactRegionName(row.road_address?.address_name || row.address?.address_name || row.address_name);

  return {
    source: 'kakao',
    displayName: row.address_name,
    subtitle,
    location: {
      id: `kakao-address-${normalizeQuery(`${row.address_name}-${latitude.toFixed(4)}-${longitude.toFixed(4)}`).replace(/[^a-z0-9가-힣]+/gi, '-')}`,
      label,
      kind: 'custom',
      latitude,
      longitude,
      radiusMeters: address.main_building_no ? 700 : 1400,
    },
  };
}

function createKakaoAddressLabel(row) {
  const roadAddress = row.road_address;
  if (roadAddress?.building_name) return compactRegionName(roadAddress.building_name);

  const address = row.address ?? {};
  const parts = [
    address.region_1depth_name,
    address.region_2depth_name,
    address.region_3depth_name,
  ].map(compactRegionName).filter(Boolean);

  return parts.length > 0 ? unique(parts).join(' ') : compactRegionName(row.address_name) || '검색한 장소';
}

async function fetchNominatimCandidates(query, raw) {
  const url = new URL(nominatimEndpoint);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '6');
  url.searchParams.set('countrycodes', 'kr');
  url.searchParams.set('accept-language', 'ko');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('q', createNominatimQuery(query, raw));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': process.env.GEOCODING_USER_AGENT || process.env.YR_USER_AGENT || defaultUserAgent,
    },
  });

  if (!response.ok) return [];

  const rows = await response.json();
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => createNominatimCandidate(query, row)).filter(Boolean);
}

function createNominatimCandidate(query, row) {
  const latitude = Number(row?.lat);
  const longitude = Number(row?.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const label = createNominatimCandidateLabel(query, row);
  const subtitle = createNominatimCandidateSubtitle(row);

  return {
    source: 'nominatim',
    displayName: row.display_name,
    subtitle,
    location: {
      id: `geocoded-${normalizeQuery(`${label}-${latitude.toFixed(4)}-${longitude.toFixed(4)}`).replace(/[^a-z0-9가-힣]+/gi, '-')}`,
      label,
      kind: 'custom',
      latitude,
      longitude,
      radiusMeters: getNominatimRadiusMeters(row),
    },
  };
}

async function fetchKakaoReverse(latitude, longitude) {
  const restApiKey = getKakaoRestApiKey();

  if (!restApiKey) return null;

  const url = new URL(kakaoReverseEndpoint);
  url.searchParams.set('x', String(longitude));
  url.searchParams.set('y', String(latitude));

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `KakaoAK ${restApiKey}`,
    },
  });

  if (!response.ok) return null;

  const payload = await response.json();
  const row = Array.isArray(payload?.documents) ? payload.documents[0] : null;
  const address = row?.road_address ?? row?.address ?? {};
  const label = createKakaoReverseLabel(row);

  if (!label) return null;

  return {
    source: 'kakao',
    displayName: address.address_name,
    location: {
      id: `reverse-kakao-${normalizeQuery(label).replace(/[^a-z0-9가-힣]+/gi, '-')}`,
      label,
      kind: 'custom',
      latitude,
      longitude,
      radiusMeters: 1200,
    },
  };
}

function createKakaoReverseLabel(row) {
  const roadAddress = row?.road_address;
  const address = row?.address ?? {};

  if (roadAddress?.building_name) {
    return compactRegionName(roadAddress.building_name);
  }

  const parts = [
    address.region_1depth_name,
    address.region_2depth_name,
    address.region_3depth_name,
  ].map(compactRegionName).filter(Boolean);

  return unique(parts).join(' ');
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
  const label = createNominatimReverseLabel(address, row?.display_name);

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

function createNominatimCandidateLabel(query, row) {
  const address = row?.address ?? {};
  const name = compactRegionName(row?.name);
  const road = compactRegionName(address.road);
  const neighbourhood = compactRegionName(address.neighbourhood || address.suburb || address.quarter || address.village);
  const district = compactRegionName(address.borough || address.county || address.city_district);
  const city = compactRegionName(address.city || address.province || address.state);
  const fallback = cleanPlaceQuery(query) || String(row?.display_name ?? '').split(',')[0]?.trim();

  return name || neighbourhood || road || district || city || fallback || '검색한 장소';
}

function createNominatimCandidateSubtitle(row) {
  const address = row?.address ?? {};
  const parts = [
    address.city || address.province || address.state,
    address.borough || address.county || address.city_district,
    address.neighbourhood || address.suburb || address.quarter || address.village,
    address.road,
  ].map(compactRegionName).filter(Boolean);

  if (parts.length > 0) return unique(parts).join(' ');

  return String(row?.display_name ?? '').split(',').slice(1, 4).map(compactRegionName).filter(Boolean).join(' ');
}

function createNominatimReverseLabel(address, displayName = '') {
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

function dedupeCandidates(candidates) {
  const seen = new Set();

  return candidates.filter((candidate) => {
    if (!candidate?.location) return false;

    const key = normalizeQuery(
      `${candidate.location.label}:${Number(candidate.location.latitude).toFixed(4)}:${Number(candidate.location.longitude).toFixed(4)}`,
    );

    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
}

function getKakaoRadiusMeters(categoryGroupCode, categoryName = '') {
  if (categoryGroupCode === 'SW8') return 700;
  if (categoryGroupCode === 'AT4') return 1200;
  if (categoryGroupCode === 'CT1') return 900;
  if (String(categoryName).includes('골프')) return 1500;

  return 1000;
}

function getNominatimRadiusMeters(row) {
  if (row?.type === 'golf_course') return 1200;
  if (row?.type === 'station' || row?.type === 'subway') return 700;

  return 1000;
}

function prefersAdministrativePlace(query) {
  const clean = cleanPlaceQuery(query).replace(/\s+/g, '');

  return /(특별시|광역시|특별자치시|특별자치도|도|시|군|구|읍|면|동|리)$/.test(clean);
}

function cleanPlaceQuery(value) {
  return String(value ?? '')
    .replace(/[?？!！]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(오늘|내일|모레|주말|아침|오전|오후|저녁|밤|새벽|점심|낮|퇴근길|지금|\d{1,2}\s*시)/g, ' ')
    .replace(/\s*(날씨|비\s*(?:와|오|올|내리|안|소식)|눈\s*(?:와|오|올|내리|안|소식)|안개|기온|우산|소나기|천둥|번개|흐림|맑음|바람).*$/g, ' ')
    .replace(/\s+/g, ' ')
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

function getKakaoRestApiKey() {
  if (typeof process.env.KAKAO_REST_API_KEY !== 'string') return '';

  return process.env.KAKAO_REST_API_KEY
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^KakaoAK\s+/i, '')
    .trim();
}
