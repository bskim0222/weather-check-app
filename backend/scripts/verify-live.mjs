const baseUrl = (process.env.WEATHER_CHECK_LIVE_API_URL
  ?? 'https://weather-check-backend-hvfs.onrender.com').replace(/\/$/, '');
const adminToken = process.env.WEATHER_CHECK_ADMIN_TOKEN?.trim() ?? '';
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const deviceA = `live-verify-owner-${suffix}`;
const deviceB = `live-verify-other-${suffix}`;
const requestId = `live-request-${suffix}`;
const answerId = `live-answer-${suffix}`;
const standaloneId = `live-report-${suffix}`;
const context = {
  raw: '서울 송파구 지금 날씨',
  place: '서울 송파구',
  timeLabel: '지금',
  detectedWeather: '흐림',
  target: { kind: 'current', latitude: 37.51, longitude: 127.1 },
};

try {
  const health = await jsonRequest('/health');
  assert(health.status === 200, 'health endpoint');
  assert(health.data?.storage?.ok === true, 'database health');
  assert(health.data?.storage?.mode === 'postgres', 'postgres storage mode');

  const providerSnapshot = await jsonRequest('/weather/provider-snapshot', 'POST', { context });
  assert(providerSnapshot.status === 200, 'provider snapshot endpoint');
  assert(providerSnapshot.data?.source === 'api', 'provider snapshot uses live data');
  assert(providerSnapshot.data?.hourlyRows?.length > 0, 'provider hourly forecast rows');
  assert(providerSnapshot.data?.dailyRows?.length > 0, 'provider daily forecast rows');
  for (const providerId of ['kma', 'yr', 'fmi']) {
    assert(
      providerSnapshot.data?.meta?.liveProviderIds?.includes(providerId),
      `${providerId} live provider connection`,
    );
  }

  const createdRequest = await jsonRequest('/report-requests', 'POST', {
    id: requestId,
    place: '서울 송파구 잠실동',
    question: '운영 DB 검수용 질문입니다.',
    latitude: 37.51,
    longitude: 127.1,
  }, deviceA);
  assert(createdRequest.status === 201, 'create request');
  assert(createdRequest.data?.source === 'local', 'owner request marker');
  assert(!('authorDeviceId' in createdRequest.data), 'request owner id privacy');

  const collision = await jsonRequest('/report-requests', 'POST', {
    id: requestId,
    place: '부산',
    question: '다른 기기의 덮어쓰기 시도',
  }, deviceB);
  assert(collision.status === 409, 'request id collision protection');

  const farAnswer = await jsonRequest('/field-reports', 'POST', {
    id: `live-far-answer-${suffix}`,
    requestId,
    place: 'Far test place',
    condition: 'Clear',
    body: 'This answer must be rejected.',
    latitude: 35.1796,
    longitude: 129.0756,
  }, deviceB);
  assert(farAnswer.status === 403, 'far-away answer protection');

  const createdAnswer = await jsonRequest('/field-reports', 'POST', {
    id: answerId,
    requestId,
    place: '서울 송파구 잠실동',
    condition: '흐림',
    body: '운영 DB 검수용 답변입니다.',
    latitude: 37.51,
    longitude: 127.1,
  }, deviceB);
  assert(createdAnswer.status === 201, 'create answer');
  assert(createdAnswer.data?.latitude === undefined, 'answer exact latitude privacy');
  assert(Number.isFinite(createdAnswer.data?.clusterLatitude), 'answer cluster latitude');

  const createdStandalone = await jsonRequest('/field-reports', 'POST', {
    id: standaloneId,
    place: '서울특별시 송파구 잠실동 501동',
    condition: '비 없음',
    body: '운영 DB 검수용 현장 제보입니다.',
    latitude: 37.51,
    longitude: 127.1,
  }, deviceA);
  assert(createdStandalone.status === 201, 'create standalone report');
  assert(!createdStandalone.data?.place.includes('501동'), 'precise building label privacy');
  assert(!('authorDeviceId' in createdStandalone.data), 'report owner id privacy');

  const forbiddenHide = await jsonRequest(`/reports/${standaloneId}/moderation`, 'POST', {
    moderationStatus: 'hidden',
    reason: 'public hide attempt',
  });
  assert(forbiddenHide.status === 400, 'public hide protection');

  const reviewRequest = await jsonRequest(`/reports/${standaloneId}/moderation`, 'POST', {
    moderationStatus: 'pending',
    reason: 'live verification review request',
  });
  assert(reviewRequest.status === 200, 'public review request');
  assert(reviewRequest.data?.moderationStatus === 'pending', 'review status remains pending');

  if (adminToken) {
    const pendingReports = await jsonRequest('/admin/reports?status=pending', 'GET', undefined, '', adminToken);
    assert(pendingReports.status === 200, 'admin pending report list');
    assert(pendingReports.data?.reports?.some((item) => item.id === standaloneId), 'admin list includes review request');
    assert(!('authorDeviceId' in pendingReports.data.reports.find((item) => item.id === standaloneId)), 'admin list hides device id');

    const restoredReport = await jsonRequest(`/admin/reports/${standaloneId}/moderation`, 'POST', {
      moderationStatus: 'visible',
      reason: 'live verification restore',
    }, '', adminToken);
    assert(restoredReport.status === 200, 'admin restores report');
    assert(restoredReport.data?.moderationStatus === 'visible', 'admin restore status');
  }

  await delay(1200);
  const ownerSnapshot = await jsonRequest('/field-reports/snapshot', 'POST', { context }, deviceA);
  const ownerRequest = ownerSnapshot.data?.requests?.find((item) => item.id === requestId);
  const ownerReport = ownerSnapshot.data?.reports?.find((item) => item.id === standaloneId);
  assert(ownerRequest?.answers === 1, 'derived answer count');
  assert(ownerRequest?.source === 'local', 'owner request remains editable');
  assert(ownerReport?.source === 'local', 'owner report remains editable');

  const otherSnapshot = await jsonRequest('/field-reports/snapshot', 'POST', { context }, deviceB);
  assert(otherSnapshot.data?.requests?.find((item) => item.id === requestId)?.source === 'api', 'other device request is read-only');

  const forbiddenEdit = await jsonRequest(`/report-requests/${requestId}`, 'PATCH', {
    question: '다른 기기 수정 시도',
  }, deviceB);
  assert(forbiddenEdit.status === 403, 'other device edit protection');

  const ownerEdit = await jsonRequest(`/report-requests/${requestId}`, 'PATCH', {
    question: '운영 DB 검수용 수정 질문입니다.',
  }, deviceA);
  assert(ownerEdit.status === 200, 'owner edit');

  const deleteAnswer = await jsonRequest(`/field-reports/${answerId}`, 'DELETE', undefined, deviceB);
  assert(deleteAnswer.status === 200, 'delete answer');
  const afterDelete = await jsonRequest('/field-reports/snapshot', 'POST', { context }, deviceA);
  assert(afterDelete.data?.requests?.find((item) => item.id === requestId)?.answers === 0, 'answer count after deletion');

  console.log('Live Postgres CRUD, ownership, proximity, moderation, privacy, and answer-count checks passed.');
} finally {
  await jsonRequest(`/field-reports/${answerId}`, 'DELETE', undefined, deviceB).catch(() => {});
  await jsonRequest(`/field-reports/${standaloneId}`, 'DELETE', undefined, deviceA).catch(() => {});
  await jsonRequest(`/report-requests/${requestId}`, 'DELETE', undefined, deviceA).catch(() => {});
}

async function jsonRequest(path, method = 'GET', body, deviceId = '', bearerToken = '') {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(deviceId ? { 'X-WeatherCheck-Device-Id': deviceId } : {}),
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  } finally {
    clearTimeout(timeoutId);
  }
}

function assert(value, label) {
  if (!value) throw new Error(`Live verification failed: ${label}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
