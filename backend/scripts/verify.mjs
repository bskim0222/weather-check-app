import { createBackendServer, resolveRequestAnswerSummary } from '../src/server.mjs';
import { compactDatabase, storageLimits } from '../src/storage.mjs';
import { createFmiForecastModel } from '../src/providers/fmiEcmwfForecast.mjs';
import { convertLatLonToKmaGrid, createKmaForecastModel } from '../src/providers/kmaShortForecast.mjs';
import { createWindyForecastModel } from '../src/providers/windyPointForecast.mjs';
import { createYrForecastModel } from '../src/providers/yrLocationforecast.mjs';
import { getForecastWindow, getTargetTimestampMs } from '../src/timeIntent.mjs';
import { createWeatherProviderSnapshot, mergeForecastRows } from '../src/weatherSnapshots.mjs';
import { fetchWithTimeout } from '../src/httpFetch.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.BACKEND_VERIFY_PORT ?? 8797);
const baseUrl = `http://127.0.0.1:${port}`;
const backendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const adminToken = `verify-admin-${Date.now()}`;
process.env.ADMIN_API_TOKEN = adminToken;
const server = createBackendServer();

await new Promise((resolve) => {
  server.listen(port, '127.0.0.1', resolve);
});

try {
  const health = await getJson('/health');
  expectEqual(health.ok, true, 'health ok');

  const allowedCorsResponse = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'https://weather-check-web.onrender.com' },
  });
  expectEqual(
    allowedCorsResponse.headers.get('access-control-allow-origin'),
    'https://weather-check-web.onrender.com',
    'production web origin is allowed',
  );
  const blockedCorsResponse = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'https://untrusted.example' },
  });
  expectEqual(
    blockedCorsResponse.headers.get('access-control-allow-origin'),
    null,
    'untrusted web origin is not allowed',
  );

  const providerStatus = await getJson('/provider-status');
  expectEqual(providerStatus.ok, true, 'provider status ok');
  expectEqual(providerStatus.recommendedMode, 'kma,yr,fmi', 'provider recommended mode');
  expectTruthy(providerStatus.providers.length >= 3, 'provider status providers');

  expectTruthy(existsSync(join(backendRoot, 'db', 'schema.sql')), 'postgres schema exists');
  const schemaSql = readFileSync(join(backendRoot, 'db', 'schema.sql'), 'utf8');
  expectTruthy(schemaSql.includes('author_device_id'), 'postgres ownership columns');
  expectTruthy(schemaSql.includes('cluster_latitude'), 'postgres privacy cluster columns');
  expectTruthy(schemaSql.includes('latitude = null'), 'postgres exact location cleanup');
  expectTruthy(schemaSql.includes('report_requests_no_exact_location'), 'postgres request location privacy constraint');
  expectTruthy(schemaSql.includes('field_reports_no_exact_location'), 'postgres report location privacy constraint');
  expectTruthy(schemaSql.includes('enable row level security'), 'postgres tables enable row level security');
  const envExample = readFileSync(join(backendRoot, '.env.example'), 'utf8');
  expectTruthy(envExample.includes('REPORT_STORAGE_MODE='), 'storage mode env example');
  expectTruthy(envExample.includes('DATABASE_URL='), 'database url env example');

  const compacted = compactDatabase(createLargeDatabaseFixture());
  expectEqual(compacted.fieldReports.length, storageLimits.maxFieldReports, 'compacted field reports');
  expectEqual(compacted.reportRequests.length, storageLimits.maxReportRequests, 'compacted report requests');
  expectEqual(compacted.moderationEvents.length, storageLimits.maxModerationEvents, 'compacted moderation events');
  const retainedAnswerSummary = resolveRequestAnswerSummary(
    { answers: 7, lastAnsweredAt: '2026-07-01T10:00:00Z' },
    { answers: 1, lastAnsweredAt: '2026-07-01T11:00:00Z' },
  );
  expectEqual(retainedAnswerSummary.answers, 7, 'stored answer count survives a truncated report window');
  expectEqual(
    retainedAnswerSummary.lastAnsweredAt,
    '2026-07-01T11:00:00Z',
    'latest visible answer timestamp is retained',
  );

  const context = {
    raw: '잠실운동장 지금 비 와?',
    place: '잠실운동장',
    target: {
      id: 'jamsil-stadium',
      label: '잠실운동장',
      kind: 'known-place',
      radiusMeters: 900,
    },
    timeLabel: '지금',
    detectedWeather: '비',
    interpretationNote: '테스트',
    needsClarification: false,
  };

  const providerSnapshot = await postJson('/weather/provider-snapshot', { context });
  expectEqual(providerSnapshot.source, 'mock', 'provider source is honest when no live provider is configured');
  expectEqual(providerSnapshot.sources.length, 3, 'provider sources');
  expectTruthy(providerSnapshot.meta, 'provider meta');
  expectTruthy(Array.isArray(providerSnapshot.meta.liveProviderIds), 'provider live meta');
  expectTruthy(Array.isArray(providerSnapshot.meta.fallbackProviderIds), 'provider fallback meta');

  const geocodedAlias = await postJson('/geocode', { query: '홍대앞' });
  expectEqual(geocodedAlias.ok, true, 'geocode alias ok');
  expectEqual(geocodedAlias.location.label, '홍대앞', 'geocode alias label');
  expectTruthy(Number.isFinite(geocodedAlias.location.latitude), 'geocode alias latitude');

  const placeCandidates = await postJson('/places/search', { query: '홍대앞' });
  expectEqual(placeCandidates.ok, true, 'place search ok');
  expectTruthy(placeCandidates.candidates.length > 0, 'place search candidates');
  expectEqual(placeCandidates.candidates[0].location.label, '홍대앞', 'place search first label');

  const geocodedGolf = await postJson('/geocode', { query: '용인CC' });
  expectEqual(geocodedGolf.ok, true, 'geocode golf ok');
  expectEqual(geocodedGolf.location.label, '용인CC', 'geocode golf label');
  expectTruthy(Number.isFinite(geocodedGolf.location.longitude), 'geocode golf longitude');

  const kmaGrid = convertLatLonToKmaGrid(37.515, 127.0728);
  expectTruthy(kmaGrid.nx > 0, 'kma grid nx');
  expectTruthy(kmaGrid.ny > 0, 'kma grid ny');

  const kmaModel = createKmaForecastModel(
    {
      response: {
        body: {
          items: {
            item: [
              { category: 'T1H', obsrValue: '24' },
              { category: 'RN1', obsrValue: '0' },
              { category: 'PTY', obsrValue: '0' },
              { category: 'WSD', obsrValue: '2' },
              { category: 'REH', obsrValue: '66' },
            ],
          },
        },
      },
    },
    {
      response: {
        body: {
          items: {
            item: [
              { category: 'T1H', fcstDate: '20260702', fcstTime: '1500', fcstValue: '25' },
              { category: 'RN1', fcstDate: '20260702', fcstTime: '1500', fcstValue: '0' },
              { category: 'PTY', fcstDate: '20260702', fcstTime: '1500', fcstValue: '0' },
              { category: 'SKY', fcstDate: '20260702', fcstTime: '1500', fcstValue: '4' },
              { category: 'WSD', fcstDate: '20260702', fcstTime: '1500', fcstValue: '4' },
              { category: 'REH', fcstDate: '20260702', fcstTime: '1500', fcstValue: '72' },
            ],
          },
        },
      },
    },
  );
  expectEqual(kmaModel.current.temp, '24℃', 'kma temperature');
  expectEqual(kmaModel.current.value, '0mm', 'kma rain amount');
  expectTruthy(kmaModel.current.detail.includes('습도 66%'), 'kma current humidity');
  expectTruthy(kmaModel.hourlyRows.length > 0, 'kma hourly rows');
  expectTruthy(Boolean(kmaModel.hourlyRows[0].forecastAt), 'kma hourly timestamp');
  expectTruthy(kmaModel.hourlyRows[0].detail.includes('바람 4m/s'), 'kma hourly wind');
  expectTruthy(kmaModel.hourlyRows[0].detail.includes('습도 72%'), 'kma hourly humidity');

  const windyModel = createWindyForecastModel({
    ts: [Date.UTC(2026, 6, 2, 9), Date.UTC(2026, 6, 2, 12)],
    'temp-surface': [24.4, 25.1],
    'past3hprecip-surface': [0, 0.4],
    'ptype-surface': [0, 1],
    'wind_u-surface': [1, 2],
    'wind_v-surface': [2, 2],
    'lclouds-surface': [80, 90],
    'mclouds-surface': [30, 40],
    'hclouds-surface': [10, 20],
  });
  expectEqual(windyModel.current.condition, '비', 'windy condition');
  expectEqual(windyModel.current.temp, '25℃', 'windy temperature');
  expectTruthy(windyModel.hourlyRows.length > 0, 'windy hourly rows');
  expectTruthy(Boolean(windyModel.hourlyRows[0].forecastAt), 'windy hourly timestamp');

  const yrModel = createYrForecastModel({
    properties: {
      timeseries: [
        {
          time: '2026-07-02T09:00:00Z',
          data: {
            instant: {
              details: {
                air_temperature: 23.4,
                wind_speed: 3.2,
                relative_humidity: 73,
              },
            },
            next_1_hours: {
              summary: {
                symbol_code: 'rain',
              },
              details: {
                precipitation_amount: 0.7,
              },
            },
          },
        },
      ],
    },
  });
  expectEqual(yrModel.current.condition, '비', 'yr condition');
  expectEqual(yrModel.current.temp, '23℃', 'yr temperature');
  expectTruthy(yrModel.current.detail.includes('습도 73%'), 'yr humidity');
  expectTruthy(yrModel.hourlyRows.length > 0, 'yr hourly rows');
  expectEqual(yrModel.hourlyRows[0].forecastAt, '2026-07-02T09:00:00Z', 'yr hourly timestamp');
  expectTruthy(yrModel.hourlyRows[0].detail.includes('바람 3m/s'), 'yr hourly wind');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url, options = {}) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(options.signal.reason));
  });
  let timedOut = false;
  try {
    await fetchWithTimeout('https://example.invalid/slow', {}, 20);
  } catch {
    timedOut = true;
  } finally {
    globalThis.fetch = originalFetch;
  }
  expectEqual(timedOut, true, 'external fetch timeout aborts a stalled provider');

  const originalProviderMode = process.env.WEATHER_PROVIDER_MODE;
  const originalYrUserAgent = process.env.YR_USER_AGENT;
  let yrFetchCount = 0;
  process.env.WEATHER_PROVIDER_MODE = 'yr';
  process.env.YR_USER_AGENT = 'WeatherCheck verifier';
  globalThis.fetch = async () => {
    yrFetchCount += 1;
    return {
      ok: true,
      json: async () => ({
        properties: {
          timeseries: [
            {
              time: new Date().toISOString(),
              data: {
                instant: { details: { air_temperature: 23, wind_speed: 2 } },
                next_1_hours: {
                  summary: { symbol_code: 'cloudy' },
                  details: { precipitation_amount: 0 },
                },
              },
            },
          ],
        },
      }),
    };
  };
  try {
    const cacheContext = {
      ...context,
      raw: `cache-verification-${Date.now()}`,
      target: { ...context.target, latitude: 37.515, longitude: 127.0728 },
    };
    const firstCachedSnapshot = await createWeatherProviderSnapshot(cacheContext);
    const secondCachedSnapshot = await createWeatherProviderSnapshot(cacheContext);
    expectEqual(firstCachedSnapshot.source, 'api', 'live provider snapshot is cacheable');
    expectEqual(secondCachedSnapshot.generatedAt, firstCachedSnapshot.generatedAt, 'cached snapshot is reused');
    expectEqual(yrFetchCount, 1, 'same weather context calls provider once within cache TTL');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalProviderMode == null) delete process.env.WEATHER_PROVIDER_MODE;
    else process.env.WEATHER_PROVIDER_MODE = originalProviderMode;
    if (originalYrUserAgent == null) delete process.env.YR_USER_AGENT;
    else process.env.YR_USER_AGENT = originalYrUserAgent;
  }

  const fmiModel = createFmiForecastModel(createFmiSampleXml());
  expectEqual(fmiModel.current.condition, '비', 'fmi condition');
  expectEqual(fmiModel.current.temp, '24℃', 'fmi temperature');
  expectEqual(fmiModel.dailyRows.length, 2, 'fmi daily rows');
  expectTruthy(fmiModel.hourlyRows.length > 0, 'fmi hourly rows');
  expectTruthy(Boolean(fmiModel.hourlyRows[0].forecastAt), 'fmi hourly timestamp');
  expectTruthy(/습도 \d+%/.test(fmiModel.hourlyRows[0].detail), 'fmi hourly humidity');

  const fixedSeoulNow = new Date('2026-07-02T02:34:00Z');
  expectEqual(
    getTargetTimestampMs({ timeLabel: '오늘', raw: '서울 오늘 날씨' }, fixedSeoulNow),
    Date.parse('2026-07-02T02:00:00Z'),
    'today-only query uses the current Seoul hour',
  );
  expectEqual(
    getTargetTimestampMs({ timeLabel: '내일', raw: '서울 내일 날씨' }, fixedSeoulNow),
    Date.parse('2026-07-03T03:00:00Z'),
    'tomorrow-only query keeps the noon default',
  );

  const explicitWindow = getForecastWindow(
    [8, 9, 10].map((hour) => ({ time: Date.UTC(2026, 6, 2, hour) })),
    (item) => item.time,
    Date.UTC(2026, 6, 2, 9),
    3,
  );
  expectEqual(explicitWindow[0].time, Date.UTC(2026, 6, 2, 9), 'explicit forecast starts at requested hour');

  const alignedRows = mergeForecastRows([], {
    kma: [createAlignmentRow('2026-07-02T01:00:00Z', 'KMA 10')],
    yr: [
      createAlignmentRow('2026-07-02T00:00:00Z', 'YR 09'),
      createAlignmentRow('2026-07-02T01:00:00Z', 'YR 10'),
    ],
    fmi: [createAlignmentRow('2026-07-02T01:00:00Z', 'FMI 10')],
  }, 'hourly', 'fmi');
  expectEqual(alignedRows.length, 2, 'aligned forecast key count');
  expectEqual(alignedRows[0].forecastKey, '2026-07-02T09', 'aligned first forecast key');
  expectEqual(alignedRows[0].kma.weather, '자료 없음', 'missing provider is explicit');
  expectEqual(alignedRows[1].forecastKey, '2026-07-02T10', 'aligned second forecast key');
  expectEqual(alignedRows[1].kma.weather, 'KMA 10', 'kma aligned by timestamp');
  expectEqual(alignedRows[1].yr.weather, 'YR 10', 'yr aligned by timestamp');
  expectEqual(alignedRows[1].fmi.weather, 'FMI 10', 'fmi aligned by timestamp');

  const deviceA = `verify-device-a-${Date.now()}`;
  const deviceB = `verify-device-b-${Date.now()}`;
  const missingDevice = await requestJson('/field-reports', 'POST', {
    place: 'Test place', condition: 'Clear', body: 'Test body',
  });
  expectEqual(missingDevice.status, 401, 'creating a report requires a device identity');

  const invalidCoordinates = await requestJson('/field-reports', 'POST', {
    place: 'Test place', condition: 'Clear', body: 'Test body', latitude: 95, longitude: 127,
  }, deviceA);
  expectEqual(invalidCoordinates.status, 400, 'invalid report coordinates are rejected');

  const nullCoordinateReport = await postJson('/field-reports', {
    place: '홍대앞',
    condition: '흐림',
    body: '좌표가 없으면 장소를 안전 범위로 변환하는 테스트예요.',
    latitude: null,
    longitude: null,
  }, deviceA);
  expectTruthy(
    Math.abs(nullCoordinateReport.clusterLatitude) > 1,
    'null coordinates are geocoded instead of becoming latitude zero',
  );
  expectTruthy(
    Math.abs(nullCoordinateReport.clusterLongitude) > 1,
    'null coordinates are geocoded instead of becoming longitude zero',
  );

  const longBody = await requestJson('/field-reports', 'POST', {
    place: 'Test place', condition: 'Clear', body: 'x'.repeat(1001),
  }, deviceA);
  expectEqual(longBody.status, 400, 'overlong report body is rejected');
  const report = await postJson('/field-reports', {
    place: '잠실운동장',
    condition: '비 없음',
    body: '지금은 비가 안 와요.',
    latitude: 37.515,
    longitude: 127.0728,
  }, deviceA);
  expectTruthy(report.id, 'created report id');
  expectTruthy(Number.isFinite(report.clusterLatitude), 'report privacy latitude');
  expectTruthy(Number.isFinite(report.clusterLongitude), 'report privacy longitude');
  expectEqual(report.latitude, undefined, 'exact report latitude is not stored');
  expectEqual(report.authorDeviceId, undefined, 'report device id is never returned');
  expectEqual(report.place, '현재 위치 근처', 'gps report place is privacy-safe');

  const request = await postJson('/report-requests', {
    latitude: 37.515,
    longitude: 127.0728,
    place: '잠실운동장',
    question: '잠실운동장 지금 비 와요?',
    answers: 999,
    status: '조작된 상태',
    accent: '#AABBCC',
  }, deviceA);
  expectTruthy(request.id, 'created request id');
  expectEqual(request.authorDeviceId, undefined, 'request device id is never returned');
  expectEqual(request.answers, 0, 'request answer count is server-owned');
  expectEqual(request.status, '답변 대기', 'request status is server-owned');
  expectEqual(request.accent, '#aabbcc', 'request accent is normalized');

  const invalidAccent = await requestJson('/report-requests', 'POST', {
    place: '잠실운동장',
    question: '잘못된 색상 테스트',
    accent: 'url(javascript:bad)',
  }, deviceB);
  expectEqual(invalidAccent.status, 400, 'invalid request accent is rejected');

  const overlongDistance = await requestJson('/report-requests', 'POST', {
    place: '잠실운동장',
    question: '긴 거리 표시 테스트',
    distance: 'x'.repeat(81),
  }, deviceB);
  expectEqual(overlongDistance.status, 400, 'overlong request distance is rejected');

  const duplicateRequest = await requestJson(
    '/report-requests',
    'POST',
    { id: request.id, place: '다른 장소', question: '덮어쓰기 시도' },
    deviceB,
  );
  expectEqual(duplicateRequest.status, 409, 'another device cannot overwrite request by id');

  const answerWithoutLocation = await requestJson('/field-reports', 'POST', {
    requestId: request.id, place: 'Test place', condition: 'Clear', body: 'No location',
  }, deviceB);
  expectEqual(answerWithoutLocation.status, 400, 'answer requires current location');

  const farAnswer = await requestJson('/field-reports', 'POST', {
    requestId: request.id,
    place: 'Far place',
    condition: 'Clear',
    body: 'Too far away',
    latitude: 35.1796,
    longitude: 129.0756,
  }, deviceB);
  expectEqual(farAnswer.status, 403, 'answer is rejected outside the question area');

  const answerReport = await postJson('/field-reports', {
    latitude: 37.515,
    longitude: 127.0728,
    requestId: request.id,
    place: '잠실운동장',
    condition: '비 없음',
    body: '현장에는 비가 오지 않아요.',
  }, deviceB);
  expectTruthy(answerReport.id, 'created answer report id');

  const duplicateReport = await requestJson(
    '/field-reports',
    'POST',
    { id: report.id, place: '다른 장소', condition: '맑음', body: '덮어쓰기 시도' },
    deviceB,
  );
  expectEqual(duplicateReport.status, 409, 'another device cannot overwrite report by id');

  const fieldSnapshot = await postJson('/field-reports/snapshot', { context }, deviceA);
  expectEqual(fieldSnapshot.source, 'api', 'field source');
  expectTruthy(fieldSnapshot.reports.length > 0, 'field reports');
  expectTruthy(fieldSnapshot.requests.length > 0, 'field requests');
  const ownedRequest = fieldSnapshot.requests.find((item) => item.id === request.id);
  const ownedReport = fieldSnapshot.reports.find((item) => item.id === report.id);
  expectEqual(ownedRequest?.source, 'local', 'request is editable on owner device');
  expectEqual(ownedRequest?.answers, 1, 'answer count is derived from reports');
  expectEqual(ownedReport?.source, 'local', 'report is editable on owner device');
  expectEqual(ownedRequest?.authorDeviceId, undefined, 'request device id is private');

  const otherSnapshot = await postJson('/field-reports/snapshot', { context }, deviceB);
  expectEqual(
    otherSnapshot.requests.find((item) => item.id === request.id)?.source,
    'api',
    'request is read-only on another device',
  );

  const forbiddenReportEdit = await requestJson(
    `/field-reports/${encodeURIComponent(report.id)}`,
    'PATCH',
    { body: '다른 기기 수정' },
    deviceB,
  );
  expectEqual(forbiddenReportEdit.status, 403, 'other device cannot edit report');

  const editedReport = await requestJson(
    `/field-reports/${encodeURIComponent(report.id)}`,
    'PATCH',
    { body: '작성자가 수정한 제보' },
    deviceA,
  );
  expectEqual(editedReport.status, 200, 'owner can edit report');
  expectEqual(editedReport.data.body, '작성자가 수정한 제보', 'report edit persisted');

  const forbiddenRequestDelete = await requestJson(
    `/report-requests/${encodeURIComponent(request.id)}`,
    'DELETE',
    undefined,
    deviceB,
  );
  expectEqual(forbiddenRequestDelete.status, 403, 'other device cannot delete request');

  const deletedAnswer = await requestJson(
    `/field-reports/${encodeURIComponent(answerReport.id)}`,
    'DELETE',
    undefined,
    deviceB,
  );
  expectEqual(deletedAnswer.status, 200, 'answer author can delete answer');
  const afterAnswerDelete = await postJson('/field-reports/snapshot', { context }, deviceA);
  expectEqual(
    afterAnswerDelete.requests.find((item) => item.id === request.id)?.answers,
    0,
    'answer count returns to zero after delete',
  );

  const forbiddenModeration = await requestJson(`/reports/${encodeURIComponent(report.id)}/moderation`, 'POST', {
    moderationStatus: 'hidden',
    reason: 'verify hidden report',
  });
  expectEqual(forbiddenModeration.status, 400, 'public moderation cannot hide a report');

  const moderation = await postJson(`/reports/${encodeURIComponent(report.id)}/moderation`, {
    moderationStatus: 'pending',
    reason: 'verify pending review',
  });
  expectEqual(moderation.ok, true, 'moderation ok');
  expectEqual(moderation.moderationStatus, 'pending', 'public moderation only requests review');

  const unauthorizedAdmin = await adminJsonRequest('/admin/reports?status=pending');
  expectEqual(unauthorizedAdmin.status, 401, 'admin reports require authorization');

  const pendingReports = await adminJsonRequest('/admin/reports?status=pending', 'GET', undefined, adminToken);
  expectEqual(pendingReports.status, 200, 'admin can list pending reports');
  expectTruthy(
    pendingReports.data.reports.some((item) => item.id === report.id),
    'pending report appears in admin list',
  );

  const hiddenByAdmin = await adminJsonRequest(
    `/admin/reports/${encodeURIComponent(report.id)}/moderation`,
    'POST',
    { moderationStatus: 'hidden', reason: 'verified by admin' },
    adminToken,
  );
  expectEqual(hiddenByAdmin.status, 200, 'admin can hide report');
  expectEqual(hiddenByAdmin.data.moderationStatus, 'hidden', 'admin hide status');

  const deletedRequest = await requestJson(
    `/report-requests/${encodeURIComponent(request.id)}`,
    'DELETE',
    undefined,
    deviceA,
  );
  expectEqual(deletedRequest.status, 200, 'request owner can delete request');
  const deletedReport = await requestJson(
    `/field-reports/${encodeURIComponent(report.id)}`,
    'DELETE',
    undefined,
    deviceA,
  );
  expectEqual(deletedReport.status, 200, 'report owner can delete report');

  const rateLimitedDevice = `verify-rate-limit-${Date.now()}`;
  for (let index = 0; index < 30; index += 1) {
    const missingWrite = await requestJson(
      `/field-reports/missing-rate-limit-${index}`,
      'DELETE',
      undefined,
      rateLimitedDevice,
    );
    expectEqual(missingWrite.status, 404, `write rate limit allows request ${index + 1}`);
  }
  const rateLimitedWrite = await requestJson(
    '/field-reports/missing-rate-limit-overflow',
    'DELETE',
    undefined,
    rateLimitedDevice,
  );
  expectEqual(rateLimitedWrite.status, 429, 'write rate limit rejects excessive changes');

  console.log('Backend verification checks passed.');
} finally {
  await new Promise((resolve) => {
    server.close(resolve);
  });
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);

  return response.json();
}

async function postJson(path, body, deviceId) {
  const result = await requestJson(path, 'POST', body, deviceId);

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${path} failed with ${result.status}`);
  }

  return result.data;
}

async function requestJson(path, method, body, deviceId) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(deviceId ? { 'X-WeatherCheck-Device-Id': deviceId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return {
    status: response.status,
    data: await response.json(),
  };
}

async function adminJsonRequest(path, method = 'GET', body, token = '') {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function expectTruthy(value, label) {
  if (!value) {
    throw new Error(`${label}: expected truthy value`);
  }
}

function createFmiSampleXml() {
  return `
    <wfs:FeatureCollection>
      ${createFmiMember('Temperature', [
        ['2026-07-02T09:00:00Z', '24.2'],
        ['2026-07-02T12:00:00Z', '25.1'],
        ['2026-07-03T09:00:00Z', '22.8'],
      ])}
      ${createFmiMember('Precipitation1h', [
        ['2026-07-02T09:00:00Z', '0.4'],
        ['2026-07-02T12:00:00Z', '0'],
        ['2026-07-03T09:00:00Z', '0'],
      ])}
      ${createFmiMember('WindSpeedMS', [
        ['2026-07-02T09:00:00Z', '2.1'],
        ['2026-07-02T12:00:00Z', '3.2'],
        ['2026-07-03T09:00:00Z', '1.4'],
      ])}
      ${createFmiMember('RelativeHumidity', [
        ['2026-07-02T09:00:00Z', '81'],
        ['2026-07-02T12:00:00Z', '74'],
        ['2026-07-03T09:00:00Z', '68'],
      ])}
      ${createFmiMember('TotalCloudCover', [
        ['2026-07-02T09:00:00Z', '90'],
        ['2026-07-02T12:00:00Z', '60'],
        ['2026-07-03T09:00:00Z', '20'],
      ])}
      ${createFmiMember('WeatherSymbol3', [
        ['2026-07-02T09:00:00Z', '61'],
        ['2026-07-02T12:00:00Z', '3'],
        ['2026-07-03T09:00:00Z', '1'],
      ])}
    </wfs:FeatureCollection>
  `;
}

function createFmiMember(param, values) {
  return `
    <wfs:member>
      <omso:PointTimeSeriesObservation gml:id="obs-${param}">
        <om:parameter>
          <om:NamedValue>
            <om:name xlink:href="https://opendata.fmi.fi/meta?param=${param}"/>
          </om:NamedValue>
        </om:parameter>
        <om:result>
          <wml2:MeasurementTimeseries>
            ${values
              .map(
                ([time, value]) => `
                  <wml2:point>
                    <wml2:MeasurementTVP>
                      <wml2:time>${time}</wml2:time>
                      <wml2:value>${value}</wml2:value>
                    </wml2:MeasurementTVP>
                  </wml2:point>
                `,
              )
              .join('')}
          </wml2:MeasurementTimeseries>
        </om:result>
      </omso:PointTimeSeriesObservation>
    </wfs:member>
  `;
}

function createAlignmentRow(forecastAt, weather) {
  return {
    forecastAt,
    weather,
    detail: '20°C · 0mm',
    mark: weather,
    tone: '#64748b',
  };
}

function createLargeDatabaseFixture() {
  return {
    fieldReports: createItems(storageLimits.maxFieldReports + 5, 'report'),
    reportRequests: createItems(storageLimits.maxReportRequests + 5, 'request'),
    moderationEvents: createItems(storageLimits.maxModerationEvents + 5, 'moderation'),
  };
}

function createItems(count, prefix) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  }));
}
