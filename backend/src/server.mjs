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
  updateReportRequestById,
} from './storage.mjs';
import { createWeatherProviderSnapshot } from './weatherSnapshots.mjs';
import { diagnoseKakaoLocal, geocodePlace, geocodePlaceCandidates, reverseGeocodePoint } from './geocoding.mjs';
import { createAdminPage } from './adminPage.mjs';

const port = Number(process.env.PORT ?? 8796);
const writeRateLimitWindowMs = 10 * 60 * 1000;
const writeRateLimitMax = 30;
const ipWriteRateLimitMax = 300;
const writeRateLimitEntries = new Map();

export function createBackendServer() {
  return http.createServer(async (request, response) => {
    applyCorsHeaders(request, response);
    response.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,x-weathercheck-device-id');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');

    if (request.method === 'OPTIONS') {
      sendJson(response, 204, null);
      return;
    }

    try {
      await routeRequest(request, response);
    } catch (error) {
      sendJson(response, error instanceof HttpError ? error.statusCode : 500, {
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

  if (request.method === 'GET' && url.pathname === '/admin') {
    sendHtml(response, 200, createAdminPage());
    return;
  }

  if (request.method === 'GET' && url.pathname === '/admin/reports') {
    requireAdmin(request);
    const database = await readDatabase();
    const requestedStatus = url.searchParams.get('status') ?? 'pending';
    const reports = database.fieldReports
      .filter((report) => !report.deletedAt)
      .filter((report) => requestedStatus === 'all' || report.moderationStatus === requestedStatus)
      .map((report) => toViewerItem(report, ''))
      .slice(0, 200);
    sendJson(response, 200, { reports });
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
    requireMethod(request, ['PATCH', 'DELETE']);
    requireDeviceId(deviceId);
    enforceWriteRateLimit(request, deviceId);
    const reportId = decodeURIComponent(fieldReportMatch[1]);
    validateId(reportId, 'Field report id');
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
      const updatedReport = await updateFieldReportById(reportId, {
        condition: optionalText(payload.condition, 'condition', 40),
        body: optionalText(payload.body, 'body', 1000),
      });
      if (!updatedReport) throw new HttpError(409, 'The field report changed before the update completed.');
      sendJson(response, 200, toViewerItem(updatedReport, deviceId));
      return;
    }

    if (request.method === 'DELETE') {
      const deleted = await deleteFieldReportById(reportId);
      if (!deleted) throw new HttpError(409, 'The field report changed before deletion completed.');
      sendJson(response, 200, { ok: true, reportId });
      return;
    }
  }

  const reportRequestMatch = url.pathname.match(/^\/report-requests\/([^/]+)$/);

  if (reportRequestMatch) {
    requireMethod(request, ['PATCH', 'DELETE']);
    requireDeviceId(deviceId);
    enforceWriteRateLimit(request, deviceId);
    const requestId = decodeURIComponent(reportRequestMatch[1]);
    validateId(requestId, 'Report request id');
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
      const updatedRequest = await updateReportRequestById(requestId, {
        question: optionalText(payload.question, 'question', 500),
      });
      if (!updatedRequest) throw new HttpError(409, 'The report request changed before the update completed.');
      sendJson(response, 200, toViewerItem(updatedRequest, deviceId));
      return;
    }

    if (request.method === 'DELETE') {
      const deleted = await deleteReportRequestById(requestId);
      if (!deleted) throw new HttpError(409, 'The report request changed before deletion completed.');
      sendJson(response, 200, { ok: true, requestId });
      return;
    }
  }

  if (url.pathname === '/weather/provider-snapshot') {
    requireMethod(request, ['POST']);
    sendJson(response, 200, await createWeatherProviderSnapshot(payload.context ?? createFallbackContext()));
    return;
  }

  if (url.pathname === '/geocode') {
    requireMethod(request, ['POST']);
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
    requireMethod(request, ['POST']);
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
    requireMethod(request, ['POST']);
    validateCoordinatePair(payload.latitude, payload.longitude, true);
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
    requireMethod(request, ['POST']);
    const database = await readDatabase({ ownerDeviceId: deviceId });
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
    requireMethod(request, ['POST']);
    requireDeviceId(deviceId);
    enforceWriteRateLimit(request, deviceId);
    const requestedId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const existingReport = requestedId ? await findFieldReportById(requestedId) : null;
    if (existingReport) {
      if (!canManageOwnedItem(existingReport, deviceId)) {
        sendJson(response, 409, { error: 'A field report with this id already exists.' });
        return;
      }

      sendJson(response, 200, toViewerItem(existingReport, deviceId));
      return;
    }

    const report = await createFieldReport(payload, deviceId);
    const savedReport = await saveFieldReport(report);
    if (!savedReport) throw new HttpError(409, 'This field report id is no longer available.');
    sendJson(response, 201, toViewerItem(savedReport, deviceId));
    return;
  }

  if (url.pathname === '/report-requests') {
    requireMethod(request, ['POST']);
    requireDeviceId(deviceId);
    enforceWriteRateLimit(request, deviceId);
    const requestedId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const existingRequest = requestedId ? await findReportRequestById(requestedId) : null;
    if (existingRequest) {
      if (!canManageOwnedItem(existingRequest, deviceId)) {
        sendJson(response, 409, { error: 'A report request with this id already exists.' });
        return;
      }

      sendJson(response, 200, toViewerItem(existingRequest, deviceId));
      return;
    }

    const reportRequest = await createReportRequest(payload, deviceId);
    const savedRequest = await saveReportRequest(reportRequest);
    if (!savedRequest) throw new HttpError(409, 'This report request id is no longer available.');
    sendJson(response, 201, toViewerItem(savedRequest, deviceId));
    return;
  }

  const requestAnswerMatch = url.pathname.match(/^\/report-requests\/([^/]+)\/answer$/);

  if (requestAnswerMatch) {
    sendJson(response, 410, { error: 'Create a field report linked to the request instead.' });
    return;
  }

  const moderationMatch = url.pathname.match(/^\/reports\/([^/]+)\/moderation$/);

  if (moderationMatch) {
    requireMethod(request, ['POST']);
    requireDeviceId(deviceId);
    enforceWriteRateLimit(request, deviceId);
    const reportId = decodeURIComponent(moderationMatch[1]);
    validateId(reportId, 'Field report id');
    const existingReport = await findFieldReportById(reportId);
    if (!existingReport) throw new HttpError(404, 'Field report not found.');
    if (canManageOwnedItem(existingReport, deviceId)) {
      throw new HttpError(400, 'You cannot report your own field report.');
    }
    if (payload.moderationStatus !== 'pending') {
      throw new HttpError(400, 'Public moderation requests can only mark a report as pending review.');
    }

    const moderated = await moderateFieldReportById(
      reportId,
      'pending',
      optionalText(payload.reason, 'reason', 300) ?? '',
    );
    if (!moderated) throw new HttpError(409, 'The field report changed before moderation completed.');
    sendJson(response, 200, moderated);
    return;
  }

  const adminModerationMatch = url.pathname.match(/^\/admin\/reports\/([^/]+)\/moderation$/);

  if (adminModerationMatch) {
    requireMethod(request, ['POST']);
    requireAdmin(request);
    const reportId = decodeURIComponent(adminModerationMatch[1]);
    validateId(reportId, 'Field report id');
    const existingReport = await findFieldReportById(reportId);
    if (!existingReport) throw new HttpError(404, 'Field report not found.');
    const moderationStatus = optionalText(payload.moderationStatus, 'moderationStatus', 20);
    if (!['visible', 'pending', 'hidden'].includes(moderationStatus)) {
      throw new HttpError(400, 'Invalid moderation status.');
    }
    const moderated = await moderateFieldReportById(
      reportId,
      moderationStatus,
      optionalText(payload.reason, 'reason', 300) ?? '',
    );
    if (!moderated) throw new HttpError(409, 'The field report changed before moderation completed.');
    sendJson(response, 200, moderated);
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
}

async function createFieldReport(payload, deviceId) {
  const createdAt = new Date().toISOString();
  validateCoordinatePair(payload.latitude, payload.longitude, false);
  const requestId = optionalText(payload.requestId, 'requestId', 180);
  const submittedLatitude = finiteNumber(payload.latitude);
  const submittedLongitude = finiteNumber(payload.longitude);
  let validatedPlace = requiredText(payload.place, 'place', 120);

  if (requestId) {
    const existingRequest = await findReportRequestById(requestId);
    if (!existingRequest) throw new HttpError(404, 'Report request not found.');
    if (submittedLatitude == null || submittedLongitude == null) {
      throw new HttpError(400, 'Current location is required to answer a field question.');
    }
    if (!Number.isFinite(existingRequest.clusterLatitude) || !Number.isFinite(existingRequest.clusterLongitude)) {
      throw new HttpError(409, 'The question location cannot be verified.');
    }
    const distanceMeters = getDistanceMeters(
      submittedLatitude,
      submittedLongitude,
      existingRequest.clusterLatitude,
      existingRequest.clusterLongitude,
    );
    if (distanceMeters > 3000) {
      throw new HttpError(403, 'You must be within about 3 km of the question location to answer.');
    }
    validatedPlace = existingRequest.place;
  }
  const coordinates = await resolvePrivacyCoordinates(payload, textOr(payload.place, '현재 위치 주변'));
  const isGpsReport = finiteNumber(payload.latitude) != null && finiteNumber(payload.longitude) != null;

  return {
    id: validateOptionalId(payload.id) ?? createId('report'),
    requestId,
    place: isGpsReport
      ? (requestId ? validatedPlace : sanitizeGpsReportPlace(validatedPlace))
      : validatedPlace,
    time: optionalText(payload.time, 'time', 40) ?? '방금',
    condition: requiredText(payload.condition, 'condition', 40),
    body: requiredText(payload.body, 'body', 1000),
    createdAt,
    moderationStatus: 'visible',
    source: 'api',
    authorDeviceId: deviceId || undefined,
    ...coordinates,
  };
}

async function createReportRequest(payload, deviceId) {
  validateCoordinatePair(payload.latitude, payload.longitude, false);
  const place = requiredText(payload.place, 'place', 120);
  const coordinates = await resolvePrivacyCoordinates(payload, place);
  if (!Number.isFinite(coordinates.clusterLatitude) || !Number.isFinite(coordinates.clusterLongitude)) {
    throw new HttpError(400, 'The question location could not be resolved.');
  }

  return {
    id: validateOptionalId(payload.id) ?? createId('request'),
    question: requiredText(payload.question, 'question', 500),
    hint: optionalText(payload.hint, 'hint', 300) ?? '현장 답변을 기다리는 중',
    place,
    distance: optionalText(payload.distance, 'distance', 80) ?? '근처',
    answers: 0,
    time: optionalText(payload.time, 'time', 40) ?? '방금',
    status: '답변 대기',
    mark: optionalText(payload.mark, 'mark', 8) ?? '요',
    accent: normalizeAccent(payload.accent),
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
      // PostgreSQL readDatabase already derives this count from the complete
      // answer table. Keep that authoritative value when the public snapshot
      // contains only the newest report window.
      const { answers, lastAnsweredAt } = resolveRequestAnswerSummary(requestItem, stats);

      return toViewerItem({
        ...requestItem,
        answers,
        status: answers > 0 ? '답변 있음' : '답변 대기',
        hint: answers > 0 ? `${answers}개의 현장 답변이 있어요.` : '현장 답변을 기다리는 중',
        lastAnsweredAt,
      }, deviceId);
    })
    .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
    .slice(0, 100);
}

export function resolveRequestAnswerSummary(requestItem, stats) {
  const storedAnswers = Number.isFinite(Number(requestItem?.answers))
    ? Math.max(0, Number(requestItem.answers))
    : 0;
  const visibleAnswers = Number.isFinite(Number(stats?.answers))
    ? Math.max(0, Number(stats.answers))
    : 0;

  return {
    answers: Math.max(storedAnswers, visibleAnswers),
    lastAnsweredAt: getTime(stats?.lastAnsweredAt) > getTime(requestItem?.lastAnsweredAt)
      ? stats.lastAnsweredAt
      : requestItem?.lastAnsweredAt,
  };
}

async function resolvePrivacyCoordinates(payload, place) {
  let latitude = finiteNumber(payload.latitude);
  let longitude = finiteNumber(payload.longitude);

  if (latitude == null || longitude == null) {
    const geocoded = await geocodePlace(place, place);
    latitude = finiteNumber(geocoded?.location?.latitude);
    longitude = finiteNumber(geocoded?.location?.longitude);
  }

  if (latitude == null || longitude == null || !isKoreaServiceCoordinate(latitude, longitude)) return {};

  const privacyRadiusMeters = 1500;
  const gridDegrees = 0.015;

  return {
    clusterLatitude: Math.round(latitude / gridDegrees) * gridDegrees,
    clusterLongitude: Math.round(longitude / gridDegrees) * gridDegrees,
    privacyRadiusMeters,
  };
}

function isKoreaServiceCoordinate(latitude, longitude) {
  return latitude >= 32.8
    && latitude <= 38.7
    && longitude >= 124
    && longitude <= 132.2;
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
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !value.trim()) return null;

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
    let size = 0;

    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 32768) {
        reject(new HttpError(413, 'Request body is too large.'));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });

  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function requireMethod(request, allowedMethods) {
  if (!allowedMethods.includes(request.method)) {
    throw new HttpError(405, 'Method not allowed.');
  }
}

function requireDeviceId(deviceId) {
  if (!/^[A-Za-z0-9._:-]{12,160}$/.test(deviceId)) {
    throw new HttpError(401, 'A valid device identity is required.');
  }
}

function requireAdmin(request) {
  const configuredToken = process.env.ADMIN_API_TOKEN?.trim();
  if (!configuredToken) throw new HttpError(503, 'Admin moderation is not configured.');
  const authorization = typeof request.headers.authorization === 'string'
    ? request.headers.authorization
    : '';
  if (authorization !== `Bearer ${configuredToken}`) {
    throw new HttpError(401, 'Admin authorization is required.');
  }
}

function sendHtml(response, statusCode, html) {
  response.statusCode = statusCode;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  response.end(html);
}

function enforceWriteRateLimit(request, deviceId) {
  const now = Date.now();
  if (writeRateLimitEntries.size > 2000) {
    for (const [key, entry] of writeRateLimitEntries) {
      if (now - entry.windowStartedAt >= writeRateLimitWindowMs) writeRateLimitEntries.delete(key);
    }
  }

  const forwardedFor = typeof request.headers['x-forwarded-for'] === 'string'
    ? request.headers['x-forwarded-for'].split(',')[0].trim()
    : '';
  const remoteAddress = forwardedFor || request.socket?.remoteAddress || 'unknown';
  incrementRateLimit(`ip:${remoteAddress}`, ipWriteRateLimitMax, now);
  incrementRateLimit(`device:${deviceId || remoteAddress}`, writeRateLimitMax, now);
}

function incrementRateLimit(identity, maxRequests, now) {
  const entry = writeRateLimitEntries.get(identity);

  if (!entry || now - entry.windowStartedAt >= writeRateLimitWindowMs) {
    writeRateLimitEntries.set(identity, { count: 1, windowStartedAt: now });
    return;
  }

  if (entry.count >= maxRequests) {
    throw new HttpError(429, 'Too many changes were submitted. Please try again later.');
  }

  entry.count += 1;
}

function applyCorsHeaders(request, response) {
  const origin = typeof request.headers.origin === 'string' ? request.headers.origin : '';

  if (origin && isAllowedOrigin(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
}

function isAllowedOrigin(origin) {
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([
    'https://weather-check-web.onrender.com',
    ...configuredOrigins,
  ]);

  if (allowedOrigins.has(origin)) return true;

  return /^http:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})(?::\d+)?$/.test(origin);
}

function normalizeAccent(value) {
  const accent = optionalText(value, 'accent', 20);
  if (!accent) return '#d6d2c4';
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) {
    throw new HttpError(400, 'accent must be a six-digit hex color.');
  }
  return accent.toLowerCase();
}

function requiredText(value, fieldName, maxLength) {
  const clean = optionalText(value, fieldName, maxLength);
  if (!clean) throw new HttpError(400, `${fieldName} is required.`);
  return clean;
}

function optionalText(value, fieldName, maxLength) {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') throw new HttpError(400, `${fieldName} must be text.`);
  const clean = value.trim();
  if (!clean) return undefined;
  if (clean.length > maxLength) throw new HttpError(400, `${fieldName} is too long.`);
  return clean;
}

function validateOptionalId(value) {
  if (value == null || value === '') return undefined;
  const id = optionalText(value, 'id', 180);
  validateId(id, 'id');
  return id;
}

function validateId(value, fieldName) {
  if (!value || !/^[A-Za-z0-9._:-]{1,180}$/.test(value)) {
    throw new HttpError(400, `${fieldName} is invalid.`);
  }
}

function validateCoordinatePair(latitudeValue, longitudeValue, required) {
  const latitude = finiteNumber(latitudeValue);
  const longitude = finiteNumber(longitudeValue);
  const hasLatitude = latitudeValue != null && latitudeValue !== '';
  const hasLongitude = longitudeValue != null && longitudeValue !== '';

  if ((required || hasLatitude || hasLongitude) && (latitude == null || longitude == null)) {
    throw new HttpError(400, 'A valid latitude and longitude pair is required.');
  }
  if (latitude != null && (latitude < -90 || latitude > 90)) {
    throw new HttpError(400, 'Latitude is out of range.');
  }
  if (longitude != null && (longitude < -180 || longitude > 180)) {
    throw new HttpError(400, 'Longitude is out of range.');
  }
}

function getDistanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value) => value * Math.PI / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB))
    * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
