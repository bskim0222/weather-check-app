import http from 'node:http';
import { pathToFileURL } from 'node:url';

import { readDatabase, writeDatabase } from './storage.mjs';
import { createWeatherProviderSnapshot } from './weatherSnapshots.mjs';
import { diagnoseKakaoLocal, geocodePlace, geocodePlaceCandidates, reverseGeocodePoint } from './geocoding.mjs';

const port = Number(process.env.PORT ?? 8796);

export function createBackendServer() {
  return http.createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'content-type');
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
    sendJson(response, 200, { ok: true, service: 'weather-check-backend' });
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

  const fieldReportMatch = url.pathname.match(/^\/field-reports\/([^/]+)$/);

  if (fieldReportMatch && fieldReportMatch[1] !== 'snapshot') {
    const database = await readDatabase();
    const reportId = decodeURIComponent(fieldReportMatch[1]);
    const existingReport = database.fieldReports.find((report) => report.id === reportId);

    if (!existingReport) {
      sendJson(response, 404, { error: 'Field report not found.' });
      return;
    }

    if (request.method === 'PATCH') {
      const updatedReport = {
        ...existingReport,
        condition: textOr(payload.condition, existingReport.condition),
        body: textOr(payload.body, existingReport.body),
        updatedAt: new Date().toISOString(),
      };
      database.fieldReports = upsertById(database.fieldReports, updatedReport);
      await writeDatabase(database);
      sendJson(response, 200, updatedReport);
      return;
    }

    if (request.method === 'DELETE') {
      database.fieldReports = database.fieldReports.filter((report) => report.id !== reportId);
      await writeDatabase(database);
      sendJson(response, 200, { ok: true, reportId });
      return;
    }
  }

  const reportRequestMatch = url.pathname.match(/^\/report-requests\/([^/]+)$/);

  if (reportRequestMatch) {
    const database = await readDatabase();
    const requestId = decodeURIComponent(reportRequestMatch[1]);
    const existingRequest = database.reportRequests.find((requestItem) => requestItem.id === requestId);

    if (!existingRequest) {
      sendJson(response, 404, { error: 'Report request not found.' });
      return;
    }

    if (request.method === 'PATCH') {
      const updatedRequest = {
        ...existingRequest,
        question: textOr(payload.question, existingRequest.question),
        updatedAt: new Date().toISOString(),
      };
      database.reportRequests = upsertById(database.reportRequests, updatedRequest);
      await writeDatabase(database);
      sendJson(response, 200, updatedRequest);
      return;
    }

    if (request.method === 'DELETE') {
      database.reportRequests = database.reportRequests.filter((requestItem) => requestItem.id !== requestId);
      database.fieldReports = database.fieldReports.filter((report) => report.requestId !== requestId);
      await writeDatabase(database);
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
      reports: selectVisibleReports(database.fieldReports, context),
      requests: selectReportRequests(database.reportRequests, context, database.fieldReports),
    });
    return;
  }

  if (url.pathname === '/field-reports') {
    const database = await readDatabase();
    const report = createFieldReport(payload);
    database.fieldReports = upsertById(database.fieldReports, report);
    await writeDatabase(database);
    sendJson(response, 201, report);
    return;
  }

  if (url.pathname === '/report-requests') {
    const database = await readDatabase();
    const reportRequest = createReportRequest(payload);
    database.reportRequests = upsertById(database.reportRequests, reportRequest);
    await writeDatabase(database);
    sendJson(response, 201, reportRequest);
    return;
  }

  const requestAnswerMatch = url.pathname.match(/^\/report-requests\/([^/]+)\/answer$/);

  if (requestAnswerMatch) {
    const database = await readDatabase();
    const requestId = decodeURIComponent(requestAnswerMatch[1]);
    const existingRequest = database.reportRequests.find((requestItem) => requestItem.id === requestId);

    if (!existingRequest) {
      sendJson(response, 404, { error: 'Report request not found.' });
      return;
    }

    const updatedRequest = {
      ...existingRequest,
      answers: Number.isFinite(existingRequest.answers) ? existingRequest.answers + 1 : 1,
      status: textOr(payload.status, '답변 받는 중'),
      hint: textOr(payload.hint, '방금 답변이 추가됐어요.'),
      lastAnsweredAt: new Date().toISOString(),
    };

    database.reportRequests = upsertById(database.reportRequests, updatedRequest);
    await writeDatabase(database);
    sendJson(response, 200, updatedRequest);
    return;
  }

  const moderationMatch = url.pathname.match(/^\/reports\/([^/]+)\/moderation$/);

  if (moderationMatch) {
    const database = await readDatabase();
    const reportId = decodeURIComponent(moderationMatch[1]);
    const moderationStatus = payload.moderationStatus === 'hidden' ? 'hidden' : 'pending';

    database.fieldReports = database.fieldReports.map((report) =>
      report.id === reportId
        ? {
            ...report,
            moderationStatus,
          }
        : report,
    );
    database.moderationEvents.unshift({
      id: createId('moderation'),
      reportId,
      moderationStatus,
      reason: typeof payload.reason === 'string' ? payload.reason : '',
      createdAt: new Date().toISOString(),
    });
    await writeDatabase(database);
    sendJson(response, 200, { ok: true, reportId, moderationStatus });
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
}

function createFieldReport(payload) {
  const createdAt = new Date().toISOString();

  return {
    id: typeof payload.id === 'string' ? payload.id : createId('report'),
    requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
    place: textOr(payload.place, '현재 위치 주변'),
    time: textOr(payload.time, '방금'),
    condition: textOr(payload.condition, '날씨 확인'),
    body: textOr(payload.body, ''),
    createdAt,
    moderationStatus: 'visible',
    source: 'api',
  };
}

function createReportRequest(payload) {
  const place = textOr(payload.place, '현재 위치 주변');

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
  };
}

function selectVisibleReports(reports, context) {
  const visibleReports = reports.filter((report) => report.moderationStatus !== 'hidden');

  return visibleReports.slice(0, 20);
}

function selectReportRequests(requests, context, reports = []) {
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
      const storedAnswers = Number.isFinite(requestItem.answers) ? requestItem.answers : 0;
      const answers = Math.max(storedAnswers, stats?.answers ?? 0);

      return {
        ...requestItem,
        answers,
        status: answers > 0 ? '답변 있음' : requestItem.status,
        hint: answers > 0 ? `${answers}개의 현장 답변이 있어요.` : requestItem.hint,
        lastAnsweredAt: stats?.lastAnsweredAt ?? requestItem.lastAnsweredAt,
      };
    })
    .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
    .slice(0, 20);
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

function upsertById(items, nextItem) {
  return [nextItem, ...items.filter((item) => item.id !== nextItem.id)];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createBackendServer();

  server.listen(port, '0.0.0.0', () => {
    console.log(`Weather Check backend listening on http://0.0.0.0:${port}`);
  });
}
