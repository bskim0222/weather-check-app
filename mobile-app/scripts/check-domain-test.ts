import {
  createDefaultJudgement,
  createQuestionJudgement,
  updateJudgementLocation,
  updateJudgementWeather,
} from '../src/domain/judgement';
import { getCompareFocusText, getContextualCompareRows } from '../src/domain/compare';
import { markReportHidden, markReportPending, visibleReportsOnly } from '../src/domain/moderation';
import {
  createMapReportClusters,
  getRecentMapReports,
  hasMapTargetCoordinates,
  hasStoredClusterCoordinate,
  hasTrustedQuestionMapTarget,
  isSpecificMapPlaceLabel,
  isValidKoreaMapCoordinate,
  MAP_ACTIVITY_WINDOW_MS,
  MAP_PRIVACY_GRID_DEGREES,
  requestToMapReport,
} from '../src/domain/mapClustering';
import { createProviderAdjustedPreset } from '../src/domain/providerJudgement';
import { createFallbackLocationStatus } from '../src/domain/locationStatus';
import { deviceIdStorageKey, loadOrCreateDeviceId } from '../src/services/deviceIdentityShared';
import { weatherPresets } from '../src/data/mockWeather';
import {
  getUnavailableWeatherProviderSnapshot,
  normalizeProviderSnapshot,
  type WeatherProviderSnapshot,
} from '../src/services/weatherProviders';
import { getUnavailableFieldReportSnapshot } from '../src/services/fieldReports';
import type { ReportRequest } from '../src/types/weather';

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function expectTruthy(value: unknown, label: string) {
  if (!value) {
    throw new Error(`${label}: expected truthy value`);
  }
}

const defaultJudgement = createDefaultJudgement();
expectEqual(defaultJudgement.weatherKey, 'rain', 'default weather');
expectEqual(defaultJudgement.searchContext.place, '현재 위치', 'default place');
expectEqual(defaultJudgement.searchContext.target.kind, 'current', 'default target kind');
expectEqual(defaultJudgement.searchContext.detectedWeather, '비', 'default detected weather');

const snowJudgement = createQuestionJudgement('석촌호수 내일 눈 와?');
expectEqual(snowJudgement.weatherKey, 'snow', 'snow question weather');
expectEqual(snowJudgement.searchContext.place, '석촌호수', 'snow question place');
expectEqual(snowJudgement.searchContext.target.id, 'seokchon-lake', 'snow question target');
expectEqual(snowJudgement.searchContext.timeLabel, '내일', 'snow question time');
expectEqual(snowJudgement.searchContext.detectedWeather, '눈', 'snow question detected weather');

const thunderJudgement = createQuestionJudgement('잠실새내역 퇴근길 천둥번개 들려?');
expectEqual(thunderJudgement.weatherKey, 'thunder', 'thunder question weather');
expectEqual(thunderJudgement.searchContext.place, '잠실새내역', 'thunder question place');
expectEqual(thunderJudgement.searchContext.target.id, 'jamsil-sae-nae', 'thunder question target');
expectEqual(thunderJudgement.searchContext.timeLabel, '퇴근길', 'thunder question time');

const busanTomorrowAfternoonJudgement = createQuestionJudgement('부산 내일 오후에 비 올 것 같아?');
expectEqual(busanTomorrowAfternoonJudgement.weatherKey, 'rain', 'busan question weather');
expectEqual(busanTomorrowAfternoonJudgement.searchContext.place, '부산', 'busan question place');
expectEqual(busanTomorrowAfternoonJudgement.searchContext.target.id, 'busan', 'busan question target');
expectEqual(busanTomorrowAfternoonJudgement.searchContext.timeLabel, '내일 오후', 'busan question time');
expectEqual(busanTomorrowAfternoonJudgement.searchContext.needsClarification, false, 'busan question clarification');

const golfMorningJudgement = createQuestionJudgement('내일 아침7시에 골프칠건데 용인cc에 비가 올까? 기온은 어느정도일거같아?');
expectEqual(golfMorningJudgement.weatherKey, 'rain', 'golf question weather');
expectEqual(golfMorningJudgement.searchContext.locationQuery, '용인cc', 'golf question location query');
expectEqual(golfMorningJudgement.searchContext.timeLabel, '내일 07시', 'golf question exact time');
expectEqual(golfMorningJudgement.searchContext.needsClarification, false, 'golf question has a usable place candidate');

const gimpoTonightJudgement = createQuestionJudgement('김포시 오늘밤 날씨');
expectEqual(gimpoTonightJudgement.searchContext.locationQuery, '김포시', 'gimpo question location query');
expectEqual(gimpoTonightJudgement.searchContext.place, '김포시', 'gimpo question place');

const seoraksanTomorrowJudgement = createQuestionJudgement('설악산 내일 날씨 어때?');
expectEqual(seoraksanTomorrowJudgement.searchContext.locationQuery, '설악산', 'seoraksan question location query');

const cheongwadaeNowJudgement = createQuestionJudgement('청와대 지금 비 와?');
expectEqual(cheongwadaeNowJudgement.searchContext.locationQuery, '청와대', 'cheongwadae question location query');

const gwanghwamunNowJudgement = createQuestionJudgement('광화문 지금 비 와?');
expectEqual(gwanghwamunNowJudgement.searchContext.locationQuery, '광화문', 'gwanghwamun question location query');
expectEqual(gwanghwamunNowJudgement.searchContext.place, '광화문', 'gwanghwamun question place');

const unknownBuildingJudgement = createQuestionJudgement('테스트빌딩 오늘 밤 기온 어때?');
expectEqual(unknownBuildingJudgement.searchContext.locationQuery, '테스트빌딩', 'unknown building location query');
expectEqual(unknownBuildingJudgement.searchContext.place, '테스트빌딩', 'unknown building keeps candidate place');
expectEqual(unknownBuildingJudgement.searchContext.target.kind, 'pending-place', 'unknown building waits for geocoding');

const kyoboTonightJudgement = createQuestionJudgement('종로 교보빌딩 오늘 밤 기온 어때?');
expectEqual(kyoboTonightJudgement.searchContext.locationQuery, '종로 교보빌딩', 'kyobo building question location query');

const dumulmeoriRainJudgement = createQuestionJudgement('두물머리 주말에 비 올까?');
expectEqual(dumulmeoriRainJudgement.searchContext.locationQuery, '두물머리', 'dumulmeori question location query');

const manualJudgement = updateJudgementWeather(snowJudgement, 'fog');
expectEqual(manualJudgement.weatherKey, 'fog', 'manual weather');
expectEqual(manualJudgement.searchContext.detectedWeather, '안개', 'manual detected weather');

const locatedJudgement = updateJudgementLocation(defaultJudgement, {
  phase: 'granted',
  label: 'located',
  message: 'located',
  latitude: 37.5,
  longitude: 127.1,
  source: 'native',
});
expectEqual(locatedJudgement.searchContext.target.latitude, 37.5, 'located latitude');
expectEqual(locatedJudgement.searchContext.target.longitude, 127.1, 'located longitude');

const hourlyRows = getContextualCompareRows('눈', 'hourly');
const dailyRows = getContextualCompareRows('눈', 'daily');
expectTruthy(hourlyRows.length > 0, 'hourly compare rows');
expectTruthy(dailyRows.length > 0, 'daily compare rows');
expectTruthy(getCompareFocusText(snowJudgement.searchContext).includes('눈'), 'compare focus text');

const moderationReports = [
  { id: 'visible-report', place: 'A', time: 'now', condition: 'clear', body: 'visible', moderationStatus: 'visible' as const },
  { id: 'hidden-report', place: 'B', time: 'now', condition: 'rain', body: 'hidden', moderationStatus: 'hidden' as const },
];
expectEqual(visibleReportsOnly(moderationReports).length, 1, 'visible moderation reports');
expectEqual(markReportPending(moderationReports, 'visible-report')[0].moderationStatus, 'pending', 'pending moderation report');
expectEqual(markReportHidden(moderationReports, 'visible-report')[0].moderationStatus, 'hidden', 'hidden moderation report');

const mapNow = Date.parse('2026-07-21T12:00:00.000Z');
const recentMapReports = getRecentMapReports([
  {
    id: 'map-visible-a',
    place: '서울 송파구 잠실동',
    time: '방금',
    condition: '비',
    body: '비가 와요',
    source: 'api',
    moderationStatus: 'visible',
    createdAt: new Date(mapNow - 60_000).toISOString(),
    clusterLatitude: 37.515,
    clusterLongitude: 127.095,
  },
  {
    id: 'map-visible-b',
    place: '서울 송파구 잠실동',
    time: '방금',
    condition: '비',
    body: '우산이 필요해요',
    source: 'api',
    moderationStatus: 'visible',
    createdAt: new Date(mapNow - 120_000).toISOString(),
    clusterLatitude: 37.53,
    clusterLongitude: 127.11,
  },
  {
    id: 'map-old',
    place: '서울 송파구 잠실동',
    time: '어제',
    condition: '맑음',
    body: '오래된 글',
    source: 'api',
    moderationStatus: 'visible',
    createdAt: new Date(mapNow - MAP_ACTIVITY_WINDOW_MS - 1).toISOString(),
    clusterLatitude: 37.515,
    clusterLongitude: 127.095,
  },
  {
    id: 'map-hidden',
    place: '서울 송파구 잠실동',
    time: '방금',
    condition: '맑음',
    body: '숨김 글',
    source: 'api',
    moderationStatus: 'hidden',
    createdAt: new Date(mapNow - 60_000).toISOString(),
    clusterLatitude: 37.515,
    clusterLongitude: 127.095,
  },
  {
    id: 'map-mock',
    place: '서울 송파구 잠실동',
    time: '방금',
    condition: '맑음',
    body: '샘플 글',
    source: 'mock',
    moderationStatus: 'visible',
    createdAt: new Date(mapNow - 60_000).toISOString(),
    clusterLatitude: 37.515,
    clusterLongitude: 127.095,
  },
], mapNow);
expectEqual(recentMapReports.length, 2, 'map only includes visible real reports from the last 24 hours');
const closeMapClusters = createMapReportClusters(recentMapReports, {}, MAP_PRIVACY_GRID_DEGREES);
expectEqual(closeMapClusters.length, 2, 'nearby map reports remain separate at close zoom');
const wideMapClusters = createMapReportClusters(recentMapReports, {}, 0.12);
expectEqual(wideMapClusters.length, 1, 'nearby map reports merge at wide zoom');
expectEqual(wideMapClusters[0].count, 2, 'wide map cluster count');
expectEqual(wideMapClusters[0].dominantCondition, '비', 'wide map cluster dominant weather');
expectTruthy(
  Math.abs((wideMapClusters[0].latitude ?? 0) - 37.515) < 0.000001,
  'wide map cluster keeps a stable privacy-safe anchor latitude',
);
expectTruthy(
  Math.abs((wideMapClusters[0].longitude ?? 0) - 127.095) < 0.000001,
  'wide map cluster keeps a stable privacy-safe anchor longitude',
);
expectEqual(
  hasStoredClusterCoordinate({
    id: 'legacy-zero-coordinate',
    place: 'legacy place',
    time: 'now',
    condition: 'clear',
    body: 'legacy record',
    clusterLatitude: 0,
    clusterLongitude: 0,
  }),
  false,
  'legacy zero coordinates fall back to place geocoding',
);
expectEqual(
  hasMapTargetCoordinates({
    ...defaultJudgement.searchContext,
    target: { id: 'current-unverified', label: '현재 위치', kind: 'current', radiusMeters: 1200 },
  }),
  false,
  'map does not show a current-location pin before coordinates are verified',
);
expectEqual(
  hasMapTargetCoordinates({
    ...defaultJudgement.searchContext,
    target: {
      id: 'gwanghwamun',
      label: '광화문',
      kind: 'known-place',
      latitude: 37.5759,
      longitude: 126.9768,
      radiusMeters: 900,
    },
  }),
  true,
  'map shows a pin for a verified searched place',
);

const koreaCoordinateCases = [
  ['Seoul', 37.5665, 126.9780],
  ['Busan', 35.1796, 129.0756],
  ['Jeju', 33.4996, 126.5312],
  ['Gangneung', 37.7519, 128.8761],
  ['Ulleungdo', 37.4845, 130.9057],
] as const;
koreaCoordinateCases.forEach(([label, latitude, longitude]) => {
  expectEqual(isValidKoreaMapCoordinate({ latitude, longitude }), true, `${label} coordinate is accepted`);
});
expectEqual(isSpecificMapPlaceLabel('광안리해수욕장'), true, 'specific map place is accepted');
expectEqual(isSpecificMapPlaceLabel('잠실 근처'), true, 'specific nearby place is accepted');
expectEqual(isSpecificMapPlaceLabel('근처'), false, 'generic nearby place is rejected');
expectEqual(isSpecificMapPlaceLabel('근처 주변'), false, 'combined generic place is rejected');
expectEqual(isSpecificMapPlaceLabel('내 위치 주변'), false, 'generic personal place is rejected');
expectEqual(isSpecificMapPlaceLabel('현재 위치'), false, 'generic current place is rejected');
[
  ['zero', 0, 0],
  ['Pyongyang', 39.0392, 125.7625],
  ['Tokyo', 35.6762, 139.6503],
  ['invalid latitude', 95, 127],
].forEach(([label, latitude, longitude]) => {
  expectEqual(
    isValidKoreaMapCoordinate({ latitude: Number(latitude), longitude: Number(longitude) }),
    false,
    `${label} coordinate is rejected`,
  );
});

const targetQuestion = requestToMapReport({
  id: 'question-from-seoul-for-busan',
  question: '광안리 지금 비 와요?',
  place: '부산 수영구 광안리',
  distance: '질문 지역',
  answers: 0,
  time: '방금',
  status: '답변 대기',
  hint: '현장 답변을 기다리는 중',
  mark: '광',
  accent: '#f4f5f2',
  clusterLatitude: 35.1532,
  clusterLongitude: 129.1187,
});
expectEqual(targetQuestion.mapItemKind, 'question', 'question map item kind');
expectEqual(
  hasTrustedQuestionMapTarget({
    id: 'legacy-question',
    question: '서울 비 와요?',
    place: '서울',
    createdAt: '2026-07-21T23:59:59.000Z',
  } as ReportRequest),
  false,
  'legacy question target is hidden from map',
);
expectEqual(
  hasTrustedQuestionMapTarget({
    id: 'trusted-question',
    question: '광안리 비 와요?',
    place: '광안리해수욕장',
    createdAt: '2026-07-22T00:00:01.000Z',
    clusterLatitude: 35.1532,
    clusterLongitude: 129.1187,
  } as ReportRequest),
  true,
  'new resolved question target is shown on map',
);
expectEqual(targetQuestion.clusterLatitude, 35.1532, 'verified question target latitude is retained');
expectEqual(targetQuestion.clusterLongitude, 129.1187, 'verified question target longitude is retained');
const targetQuestionClusters = createMapReportClusters(
  [targetQuestion],
  { '부산 수영구 광안리': { latitude: 35.1532, longitude: 129.1187 } },
);
expectEqual(targetQuestionClusters.length, 1, 'question target produces one map marker');
expectEqual(targetQuestionClusters[0].kind, 'question', 'question target marker remains a question');
expectTruthy(
  Math.abs((targetQuestionClusters[0].latitude ?? 0) - 35.1532) < 0.000001,
  'question marker follows Busan target instead of Seoul requester',
);
expectEqual(
  createMapReportClusters([
    {
      ...targetQuestion,
      place: 'invalid legacy place',
      clusterLatitude: undefined,
      clusterLongitude: undefined,
    },
  ], { 'invalid legacy place': { latitude: 39.0392, longitude: 125.7625 } }).length,
  0,
  'legacy North Korea question marker is hidden',
);

const nationwideReports = koreaCoordinateCases.map(([label, latitude, longitude], index) => ({
  id: `nationwide-${index}`,
  place: label,
  time: '방금',
  condition: index % 2 === 0 ? '맑음' : '비',
  body: `${label} 현장 테스트`,
  source: 'api' as const,
  moderationStatus: 'visible' as const,
  createdAt: new Date(mapNow - index * 1_000).toISOString(),
  clusterLatitude: latitude,
  clusterLongitude: longitude,
}));
[0.015, 0.03, 0.06, 0.12, 0.25, 0.5, 1, 2].forEach((gridDegrees) => {
  const clusters = createMapReportClusters(nationwideReports, {}, gridDegrees);
  expectEqual(
    clusters.reduce((sum, cluster) => sum + cluster.count, 0),
    nationwideReports.length,
    `zoom grid ${gridDegrees} preserves every valid report`,
  );
  expectEqual(
    clusters.every((cluster) => isValidKoreaMapCoordinate(cluster)),
    true,
    `zoom grid ${gridDegrees} keeps every marker inside Korea`,
  );
});
const nationwideSeoulCluster = createMapReportClusters([nationwideReports[0]], {}, 2)[0];
expectTruthy(
  Math.abs((nationwideSeoulCluster.latitude ?? 0) - koreaCoordinateCases[0][1]) < 0.000001,
  'nationwide zoom keeps marker at the report latitude instead of grid center',
);
expectTruthy(
  Math.abs((nationwideSeoulCluster.longitude ?? 0) - koreaCoordinateCases[0][2]) < 0.000001,
  'nationwide zoom keeps marker at the report longitude instead of grid center',
);

const alignedSnapshot: WeatherProviderSnapshot = {
  context: defaultJudgement.searchContext,
  generatedAt: new Date().toISOString(),
  source: 'api',
  meta: {
    providerMode: 'live',
    liveProviderIds: ['kma', 'yr', 'fmi'],
    fallbackProviderIds: [],
    thirdProviderId: 'fmi',
  },
  sources: weatherPresets.rain.sources,
  summaries: [],
  differences: [],
  hourlyRows: [
    {
      label: '지금',
      forecastKey: '2026-07-21T15',
      kma: { mark: 'K', weather: '비', detail: '29°C · 강수 0.5mm', tone: '#aaa' },
      yr: { mark: '-', weather: '자료 없음', detail: '해당 시각 제공값 없음', tone: '#aaa' },
      windy: { mark: 'FMI', weather: '자료 없음', detail: '해당 시각 제공값 없음', tone: '#aaa' },
      fmi: { mark: 'FMI', weather: '자료 없음', detail: '해당 시각 제공값 없음', tone: '#aaa' },
    },
  ],
  dailyRows: [],
};
const alignedPreset = createProviderAdjustedPreset(weatherPresets.rain, alignedSnapshot);
expectEqual(alignedPreset.condition, '비', 'missing providers do not cast fallback cloudy votes');
expectEqual(alignedPreset.temp, 29, 'representative temperature uses aligned usable cells only');
expectEqual(alignedPreset.sources[0].condition, '비', 'summary first source uses aligned row');
expectEqual(alignedPreset.sources[1].condition, '자료 없음', 'summary second source remains explicit');
expectEqual(alignedPreset.sources[2].condition, '자료 없음', 'summary missing source remains explicit');
expectEqual(alignedPreset.sources[1].temp, '--', 'live missing temperature never falls back to an unrelated value');
expectEqual(alignedPreset.forecastRows.length, 1, 'live forecast rows never append mock hours');
expectTruthy(!alignedPreset.summary.includes('자료 없음'), 'missing provider excluded from summary sentence');

const unavailableSnapshot = getUnavailableWeatherProviderSnapshot(defaultJudgement.searchContext);
expectEqual(unavailableSnapshot.source, 'unavailable', 'unavailable snapshot source');
expectEqual(unavailableSnapshot.hourlyRows.length, 0, 'unavailable snapshot has no fake hourly rows');
expectEqual(unavailableSnapshot.sources.length, 0, 'unavailable snapshot has no fake provider cards');

const failedLocation = createFallbackLocationStatus();
expectEqual(failedLocation.phase, 'fallback', 'failed location remains an explicit fallback state');
expectEqual(failedLocation.latitude, undefined, 'failed location never injects a sample latitude');
expectEqual(failedLocation.longitude, undefined, 'failed location never injects a sample longitude');
expectTruthy(!failedLocation.placeName, 'failed location never presents a sample place as the current location');

const unavailableReports = getUnavailableFieldReportSnapshot(defaultJudgement.searchContext);
expectEqual(unavailableReports.source, 'unavailable', 'unavailable field report source');
expectEqual(unavailableReports.reports.length, 0, 'unavailable field reports contain no samples');
expectEqual(unavailableReports.requests.length, 0, 'unavailable report requests contain no samples');

const emptyApiSnapshot = normalizeProviderSnapshot(
  {
    context: defaultJudgement.searchContext,
    generatedAt: new Date().toISOString(),
    source: 'api',
    sources: [],
    summaries: [],
    differences: [],
    hourlyRows: [],
    dailyRows: [],
  },
  defaultJudgement.searchContext,
);
expectEqual(emptyApiSnapshot.hourlyRows.length, 0, 'empty API response does not receive mock hourly rows');
expectEqual(emptyApiSnapshot.sources.length, 0, 'empty API response does not receive mock provider cards');
expectEqual(emptyApiSnapshot.source, 'unavailable', 'empty API response is explicitly unavailable');

export async function verifyPersistentDeviceIdentity() {
  const identityStore = new Map<string, string>();
  const identityStorage = {
    async getItem(key: string) {
      return identityStore.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      identityStore.set(key, value);
    },
  };
  const firstPersistentDeviceId = await loadOrCreateDeviceId(identityStorage);
  const restoredPersistentDeviceId = await loadOrCreateDeviceId(identityStorage);
  expectEqual(restoredPersistentDeviceId, firstPersistentDeviceId, 'device identity persists across app restarts');
  expectEqual(identityStore.get(deviceIdStorageKey), firstPersistentDeviceId, 'device identity uses the stable storage key');
}

const threeProviderSnapshot: WeatherProviderSnapshot = {
  ...alignedSnapshot,
  hourlyRows: [
    {
      label: '지금',
      forecastKey: '2026-07-21T15',
      kma: { mark: 'K', weather: '흐림', detail: '29°C · 강수 0mm', tone: '#aaa' },
      yr: { mark: 'Yr', weather: '흐림', detail: '28°C · 강수 0mm', tone: '#aaa' },
      windy: { mark: 'FMI', weather: '비', detail: '27°C · 강수 0.2mm', tone: '#aaa' },
      fmi: { mark: 'FMI', weather: '비', detail: '27°C · 강수 0.2mm', tone: '#aaa' },
    },
  ],
};
const threeProviderPreset = createProviderAdjustedPreset(weatherPresets.rain, threeProviderSnapshot);
expectTruthy(threeProviderPreset.summary.includes('대한민국 기상청 흐림 29°C'), 'summary names KMA correctly');
expectTruthy(threeProviderPreset.summary.includes('노르웨이 기상청 흐림 28°C'), 'summary names Norway correctly');
expectTruthy(threeProviderPreset.summary.includes('핀란드 기상청 비 27°C'), 'summary names Finland correctly');

console.log('Domain smoke checks passed.');
