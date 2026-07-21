import http from 'node:http';
import { pathToFileURL } from 'node:url';

import {
  deleteFieldReportById,
  deleteReportRequestById,
  findFieldReportById,
  findReportRequestById,
  getStorageStatus,
  moderateFieldReportById,
  readDatabase,
  saveFieldReport,
  saveReportRequest,
  updateFieldReportById,
  updateReportRequestAnswerStatus,
  updateReportRequestById,
} from './storage.mjs';
import { createWeatherProviderSnapshot } from './weatherSnapshots.mjs';
import { diagnoseKakaoLocal, geocodePlace, geocodePlaceCandidates, reverseGeocodePoint } from './geocoding.mjs';

const port = Number(process.env.PORT ?? 8796);

export function createBackendServer() {
  return http.createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'content-type,x-weathercheck-device-id');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');

    if (request.method === 'OPTIONS') {
      sendJson(response, 204, null);
      return;
    }

    try {
      await routeRequest(request, response);
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : 'Unknown server error.',
      });
    }
  });
}

async function routeRequest(request, response) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    const databaseStatus = await getStorageStatus();
    sendJson(response, databaseStatus.ok ? 200 : 503, {
      ok: databaseStatus.ok,
      service: 'weather-check-backend',
      storage: databaseStatus,
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/provider-status') {
    sendJson(response, 200, createProviderStatus());
    return;
  }

  if (request.method === 'GET' && url.pathname === '/places/kakao-status') {
    sendJson(response, 200, await diagnoseKakaoLocal(url.searchParams.get('query') ?? '광화문'));
    return;
  }

  if (!['POST', 'PATCH', 'DELETE'].includes(request.method)) {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  const payload = request.method === 'DELETE' ? {} : await readJsonBody(request);
  const deviceId = getRequestDeviceId(request);

  const fieldReportMatch = url.pathname.match(/^\/field-reports\/([^/]+)$/);

  if (fieldReportMatch && fieldReportMatch[1] !== 'snapshot') {
    const reportId = decodeURIComponent(fieldReportMatch[1]);
    const existingReport = await findFieldReportById(reportId);

    if (!existingReport) {
      sendJson(response, 404, { error: 'Field report not found.' });
      return;
    }

    if (!canManageOwnedItem(existingReport, deviceId)) {
      sendJson(response, 403, { error: 'This field report belongs to another device.' });
      return;
    }

    if (request.method === 'PATCH') {
      const updatedReport = await updateFieldReportById(reportId, payload);
      sendJson(response, 200, toViewerItem(updatedReport, deviceId));
      return;
    }

    if (request.method === 'DELETE') {
      await deleteFieldReportById(reportId);
      sendJson(response, 200, { ok: true, reportId });
      return;
    }
  }

  const reportRequestMatch = url.pathname.match(/^\/report-requests\/([^/]+)$/);

  if (reportRequestMatch) {
    const requestId = decodeURIComponent(reportRequestMatch[1]);
    const existingRequest = await findReportRequestById(requestId);

    if (!existingRequest) {
      sendJson(response, 404, { error: 'Report request not found.' });
      return;
    }

    if (!canManageOwnedItem(existingRequest, deviceId)) {
      sendJson(response, 403, { error: 'This report request belongs to another device.' });
      return;
    }

    if (request.method === 'PATCH') {
      const updatedRequest = await updateReportRequestById(requestId, payload);
      sendJson(response, 200, toViewerItem(updatedRequest, deviceId));
      return;
    }

    if (request.method === 'DELETE') {
      await deleteReportRequestById(requestId);
      sendJson(response, 200, { ok: true, requestId });
      return;
    }
  }

  if (url.pathname === '/weather/provider-snapshot') {
    sendJson(response, 200, await createWeatherProviderSnapshot(payload.context ?? createFallbackContext()));
    return;
  }

  if (url.pathname === '/geocode') {
    const query = textOr(payload.query, '');
    const result = await geocodePlace(query, textOr(payload.raw, ''));

    sendJson(response, 200, {
      ok: Boolean(result?.location),
      query,
      ...result,
    });
    return;
  }

  if (url.pathname === '/places/search') {
    const query = textOr(payload.query, '');
    const candidates = await geocodePlaceCandidates(query, textOr(payload.raw, ''), 6);

    sendJson(response, 200, {
      ok: candidates.length > 0,
      query,
      candidates,
    });
    return;
  }

  if (url.pathname === '/reverse-geocode') {
    const result = await reverseGeocodePoint(payload.latitude, payload.longitude);

    sendJson(response, 200, {
      ok: Boolean(result?.location),
      latitude: Number(payload.latitude),
      longitude: Number(payload.longitude),
      ...result,
    });
    return;
  }

  if (url.pathname === '/field-reports/snapshot') {
    const database = await readDatabase();
    const context = payload.context ?? createFallbackContext();

    sendJson(response, 200, {
      generatedAt: new Date().toISOString(),
      source: 'api',
      context,
      reports: selectVisibleReports(database.fieldReports, context, deviceId),
      requests: selectReportRequests(database.reportRequests, context, database.fieldReports, deviceId),
    });
    return;
  }

  if (url.pathname === '/field-reports') {
    const report = await createFieldReport(payload, deviceId);
    const savedReport = await saveFieldReport(report);
    sendJson(response, 201, toViewerItem(savedReport, deviceId));
    return;
  }

  if (url.pathname === '/report-requests') {
    const reportRequest = await createReportRequest(payload, deviceId);
    const savedRequest = await saveReportRequest(reportRequest);
    sendJson(response, 201, toViewerItem(savedRequest, deviceId));
    return;
  }

  const requestAnswerMatch = url.pathname.match(/^\/report-requests\/([^/]+)\/answer$/);

  if (requestAnswerMatch) {
    const requestId = decodeURIComponent(requestAnswerMatch[1]);
    const existingRequest = await findReportRequestById(requestId);

    if (!existingRequest) {
      sendJson(response, 404, { error: 'Report request not found.' });
      return;
    }

    const updatedRequest = await updateReportRequestAnswerStatus(requestId, payload);
    sendJson(response, 200, updatedRequest);
    return;
  }

  const moderationMatch = url.pathname.match(/^\/reports\/([^/]+)\/moderation$/);

  if (moderationMatch) {
    const reportId = decodeURIComponent(moderationMatch[1]);
    const moderationStatus = payload.moderationStatus === 'hidden' ? 'hidden' : 'pending';

    sendJson(response, 200, await moderateFieldReportById(reportId, moderationStatus, payload.reason));
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
}

async function createFieldReport(payload, deviceId) {
  const createdAt = new Date().toISOString();
  const coordinates = await resolvePrivacyCoordinates(payload, textOr(payload.place, '현재 위치 주변'));
  const isGpsReport = finiteNumber(payload.latitude) != null && finiteNumber(payload.longitude) != null;

  return {
    id: typeof payload.id === 'string' ? payload.id : createId('report'),
    requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
    place: isGpsReport
      ? sanitizeGpsReportPlace(textOr(payload.place, '현재 위치 주변'))
      : textOr(payload.place, '현재 위치 주변'),
    time: textOr(payload.time, '방금'),
    condition: textOr(payload.condition, '날씨 확인'),
    body: textOr(payload.body, ''),
    createdAt,
    moderationStatus: 'visible',
    source: 'api',
    authorDeviceId: deviceId || undefined,
    ...coordinates,
  };
}

async function createReportRequest(payload, deviceId) {
  const place = textOr(payload.place, '현재 위치 주변');
  const coordinates = await resolvePrivacyCoordinates(payload, place);

  return {
    id: typeof payload.id === 'string' ? payload.id : createId('request'),
    question: textOr(payload.question, `${place} 지금 날씨 어때요?`),
    hint: textOr(payload.hint, '근처 사용자에게 현장 제보를 요청합니다.'),
    place,
    distance: textOr(payload.distance, '근처'),
    answers: Number.isFinite(payload.answers) ? payload.answers : 0,
    time: textOr(payload.time, '방금'),
    status: textOr(payload.status, '답변 대기'),
    mark: textOr(payload.mark, '요'),
    accent: textOr(payload.accent, '#d6d2c4'),
    createdAt: new Date().toISOString(),
    source: 'api',
    authorDeviceId: deviceId || undefined,
    ...coordinates,
  };
}

function selectVisibleReports(reports, context, deviceId) {
  const visibleReports = reports.filter((report) => report.moderationStatus !== 'hidden');

  return visibleReports.map((report) => toViewerItem(report, deviceId));
}

function selectReportRequests(requests, context, reports = [], deviceId) {
  const visibleAnswers = reports.filter(
    (report) =>
      report.requestId &&
      report.moderationStatus !== 'hidden' &&
      !report.deletedAt,
  );
  const answerStatsByRequestId = new Map();

  visibleAnswers.forEach((report) => {
    const current = answerStatsByRequestId.get(report.requestId) ?? {
      answers: 0,
      lastAnsweredAt: '',
    };
    const createdAt = typeof report.createdAt === 'string' ? report.createdAt : '';

    answerStatsByRequestId.set(report.requestId, {
      answers: current.answers + 1,
      lastAnsweredAt: getTime(createdAt) > getTime(current.lastAnsweredAt) ? createdAt : current.lastAnsweredAt,
    });
  });

  return requests
    .filter((requestItem) => !requestItem.deletedAt)
    .map((requestItem) => {
      const stats = answerStatsByRequestId.get(requestItem.id);
      const answers = stats?.answers ?? 0;

      return toViewerItem({
        ...requestItem,
        answers,
        status: answers > 0 ? '답변 있음' : '답변 대기',
        hint: answers > 0 ? `${answers}개의 현장 답변이 있어요.` : '현장 답변을 기다리는 중',
        lastAnsweredAt: stats?.lastAnsweredAt,
      }, deviceId);
    })
    .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
    .slice(0, 100);
}

async function resolvePrivacyCoordinates(payload, place) {
  let latitude = finiteNumber(payload.latitude);
  let longitude = finiteNumber(payload.longitude);

  if (latitude == null || longitude == null) {
    const geocoded = await geocodePlace(place, place);
    latitude = finiteNumber(geocoded?.location?.latitude);
    longitude = finiteNumber(geocoded?.location?.longitude);
  }

  if (latitude == null || longitude == null) return {};

  const privacyRadiusMeters = 1500;
  const gridDegrees = 0.015;

  return {
    clusterLatitude: Math.round(latitude / gridDegrees) * gridDegrees,
    clusterLongitude: Math.round(longitude / gridDegrees) * gridDegrees,
    privacyRadiusMeters,
  };
}

function getRequestDeviceId(request) {
  const value = request.headers['x-weathercheck-device-id'];

  return typeof value === 'string' ? value.trim().slice(0, 160) : '';
}

function canManageOwnedItem(item, deviceId) {
  return Boolean(deviceId && item.authorDeviceId && item.authorDeviceId === deviceId);
}

function isOwnedByDevice(item, deviceId) {
  return Boolean(deviceId && item.authorDeviceId && item.authorDeviceId === deviceId);
}

function toViewerItem(item, deviceId) {
  return {
    ...item,
    source: isOwnedByDevice(item, deviceId) ? 'local' : 'api',
    authorDeviceId: undefined,
  };
}

function finiteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function sanitizeGpsReportPlace(place) {
  const clean = place
    .replace(/\d+(?:동|호|층)/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const administrativeTokens = clean.split(/\s+/).filter((token) => (
    /(?:특별시|광역시|특별자치시|특별자치도|도|시|군|구|읍|면|동|리)$/.test(token)
    && !/^\d+동$/.test(token)
  ));

  if (administrativeTokens.length > 0) {
    return administrativeTokens.slice(-3).join(' ');
  }

  return '현재 위치 근처';
}
async function readJsonBody(request) {
  const raw = await new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });

  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(body === null ? '' : JSON.stringify(body));
}

function createFallbackContext() {
  return {
    raw: '현재 위치 날씨',
    place: '현재 위치',
    target: {
      id: 'current-location',
      label: '현재 위치',
      kind: 'current',
      radiusMeters: 1200,
    },
    timeLabel: '지금',
    detectedWeather: '비',
    interpretationNote: '현재 위치 기준으로 예보를 비교합니다.',
    needsClarification: false,
  };
}

function createProviderStatus() {
  const mode = process.env.WEATHER_PROVIDER_MODE ?? 'mock';

  return {
    ok: true,
    providerMode: mode,
    recommendedMode: 'kma,yr,fmi',
    providers: [
      {
        providerId: 'kakao-local',
        name: '카카오 로컬',
        enabled: hasEnvValue('KAKAO_REST_API_KEY'),
        configured: hasEnvValue('KAKAO_REST_API_KEY'),
        requiresKey: true,
      },
      {
        providerId: 'kma',
        name: '대한민국 기상청',
        enabled: isProviderEnabled(mode, 'kma'),
        configured: hasEnvValue('KMA_SERVICE_KEY') || hasEnvValue('EXPO_PUBLIC_KMA_API_KEY'),
        requiresKey: true,
      },
      {
        providerId: 'yr',
        name: '노르웨이 기상청',
        enabled: isProviderEnabled(mode, 'yr'),
        configured: hasEnvValue('YR_USER_AGENT') || hasEnvValue('EXPO_PUBLIC_YR_USER_AGENT'),
        requiresKey: false,
      },
      {
        providerId: 'fmi',
        name: '핀란드 기상청',
        enabled: isProviderEnabled(mode, 'fmi'),
        configured: true,
        requiresKey: false,
      },
      {
        providerId: 'windy',
        name: 'Windy.com',
        enabled: isProviderEnabled(mode, 'windy'),
        configured: hasEnvValue('WINDY_API_KEY'),
        requiresKey: true,
        optional: true,
      },
    ],
  };
}

function isProviderEnabled(mode, providerId) {
  if (mode === 'real') return true;

  return mode.split(',').map((item) => item.trim()).includes(providerId);
}

function hasEnvValue(key) {
  return typeof process.env[key] === 'string' && process.env[key].trim().length > 0;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function textOr(value, fallback) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function getTime(value) {
  const time = Date.parse(value);

  return Number.isFinite(time) ? time : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createBackendServer();

  server.listen(port, '0.0.0.0', () => {
    console.log(`Weather Check backend listening on http://0.0.0.0:${port}`);
  });
}
