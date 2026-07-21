import { createBackendServer } from '../src/server.mjs';
import { compactDatabase, storageLimits } from '../src/storage.mjs';
import { createFmiForecastModel } from '../src/providers/fmiEcmwfForecast.mjs';
import { convertLatLonToKmaGrid, createKmaForecastModel } from '../src/providers/kmaShortForecast.mjs';
import { createWindyForecastModel } from '../src/providers/windyPointForecast.mjs';
import { createYrForecastModel } from '../src/providers/yrLocationforecast.mjs';
import { getForecastWindow } from '../src/timeIntent.mjs';
import { mergeForecastRows } from '../src/weatherSnapshots.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.BACKEND_VERIFY_PORT ?? 8797);
const baseUrl = `http://127.0.0.1:${port}`;
const backendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const server = createBackendServer();

await new Promise((resolve) => {
  server.listen(port, '127.0.0.1', resolve);
});

try {
  const health = await getJson('/health');
  expectEqual(health.ok, true, 'health ok');

  const providerStatus = await getJson('/provider-status');
  expectEqual(providerStatus.ok, true, 'provider status ok');
  expectEqual(providerStatus.recommendedMode, 'kma,yr,fmi', 'provider recommended mode');
  expectTruthy(providerStatus.providers.length >= 3, 'provider status providers');

  expectTruthy(existsSync(join(backendRoot, 'db', 'schema.sql')), 'postgres schema exists');
  const schemaSql = readFileSync(join(backendRoot, 'db', 'schema.sql'), 'utf8');
  expectTruthy(schemaSql.includes('author_device_id'), 'postgres ownership columns');
  expectTruthy(schemaSql.includes('cluster_latitude'), 'postgres privacy cluster columns');
  expectTruthy(schemaSql.includes('latitude = null'), 'postgres exact location cleanup');
  const envExample = readFileSync(join(backendRoot, '.env.example'), 'utf8');
  expectTruthy(envExample.includes('REPORT_STORAGE_MODE='), 'storage mode env example');
  expectTruthy(envExample.includes('DATABASE_URL='), 'database url env example');

  const compacted = compactDatabase(createLargeDatabaseFixture());
  expectEqual(compacted.fieldReports.length, storageLimits.maxFieldReports, 'compacted field reports');
  expectEqual(compacted.reportRequests.length, storageLimits.maxReportRequests, 'compacted report requests');
  expectEqual(compacted.moderationEvents.length, storageLimits.maxModerationEvents, 'compacted moderation events');

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
            ],
          },
        },
      },
    },
  );
  expectEqual(kmaModel.current.temp, '24℃', 'kma temperature');
  expectEqual(kmaModel.current.value, '0mm', 'kma rain amount');
  expectTruthy(kmaModel.hourlyRows.length > 0, 'kma hourly rows');
  expectTruthy(Boolean(kmaModel.hourlyRows[0].forecastAt), 'kma hourly timestamp');

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
  expectTruthy(yrModel.hourlyRows.length > 0, 'yr hourly rows');
  expectEqual(yrModel.hourlyRows[0].forecastAt, '2026-07-02T09:00:00Z', 'yr hourly timestamp');

  const fmiModel = createFmiForecastModel(createFmiSampleXml());
  expectEqual(fmiModel.current.condition, '비', 'fmi condition');
  expectEqual(fmiModel.current.temp, '24℃', 'fmi temperature');
  expectEqual(fmiModel.dailyRows.length, 2, 'fmi daily rows');
  expectTruthy(fmiModel.hourlyRows.length > 0, 'fmi hourly rows');
  expectTruthy(Boolean(fmiModel.hourlyRows[0].forecastAt), 'fmi hourly timestamp');

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
    place: '잠실운동장',
    question: '잠실운동장 지금 비 와요?',
  }, deviceA);
  expectTruthy(request.id, 'created request id');
  expectEqual(request.authorDeviceId, undefined, 'request device id is never returned');

  const duplicateRequest = await requestJson(
    '/report-requests',
    'POST',
    { id: request.id, place: '다른 장소', question: '덮어쓰기 시도' },
    deviceB,
  );
  expectEqual(duplicateRequest.status, 409, 'another device cannot overwrite request by id');

  const answerReport = await postJson('/field-reports', {
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

  const moderation = await postJson(`/reports/${encodeURIComponent(report.id)}/moderation`, {
    moderationStatus: 'hidden',
    reason: 'verify hidden report',
  });
  expectEqual(moderation.ok, true, 'moderation ok');

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
