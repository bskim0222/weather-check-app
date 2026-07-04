import { createBackendServer } from '../src/server.mjs';
import { compactDatabase, storageLimits } from '../src/storage.mjs';
import { createFmiForecastModel } from '../src/providers/fmiEcmwfForecast.mjs';
import { convertLatLonToKmaGrid, createKmaForecastModel } from '../src/providers/kmaShortForecast.mjs';
import { createWindyForecastModel } from '../src/providers/windyPointForecast.mjs';
import { createYrForecastModel } from '../src/providers/yrLocationforecast.mjs';

const port = Number(process.env.BACKEND_VERIFY_PORT ?? 8797);
const baseUrl = `http://127.0.0.1:${port}`;
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
  expectEqual(providerSnapshot.source, 'api', 'provider source');
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
  expectEqual(windyModel.current.condition, '흐림', 'windy condition');
  expectEqual(windyModel.current.temp, '24℃', 'windy temperature');
  expectTruthy(windyModel.hourlyRows.length > 0, 'windy hourly rows');

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

  const fmiModel = createFmiForecastModel(createFmiSampleXml());
  expectEqual(fmiModel.current.condition, '비', 'fmi condition');
  expectEqual(fmiModel.current.temp, '24℃', 'fmi temperature');
  expectEqual(fmiModel.dailyRows.length, 2, 'fmi daily rows');
  expectTruthy(fmiModel.hourlyRows.length > 0, 'fmi hourly rows');

  const report = await postJson('/field-reports', {
    place: '잠실운동장',
    condition: '비 없음',
    body: '지금은 비가 안 와요.',
  });
  expectTruthy(report.id, 'created report id');

  const request = await postJson('/report-requests', {
    place: '잠실운동장',
    question: '잠실운동장 지금 비 와요?',
  });
  expectTruthy(request.id, 'created request id');

  const answeredRequest = await postJson(`/report-requests/${encodeURIComponent(request.id)}/answer`, {
    status: '답변 있음',
    hint: '방금 답변됨',
  });
  expectEqual(answeredRequest.answers, 1, 'answered request count');
  expectEqual(answeredRequest.status, '답변 있음', 'answered request status');

  const fieldSnapshot = await postJson('/field-reports/snapshot', { context });
  expectEqual(fieldSnapshot.source, 'api', 'field source');
  expectTruthy(fieldSnapshot.reports.length > 0, 'field reports');
  expectTruthy(fieldSnapshot.requests.length > 0, 'field requests');

  const moderation = await postJson(`/reports/${encodeURIComponent(report.id)}/moderation`, {
    moderationStatus: 'hidden',
    reason: 'verify hidden report',
  });
  expectEqual(moderation.ok, true, 'moderation ok');

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

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }

  return response.json();
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
