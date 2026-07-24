import http from 'node:http';
import { pathToFileURL } from 'node:url';

const port = Number(process.env.MOCK_API_PORT ?? 8793);

const providerColors = {
  kma: '#e6465f',
  yr: '#65a6ff',
  windy: '#f6c453',
  fmi: '#7f9f8d',
};

export function createMockApiServer() {
  const storedReports = [];
  const storedRequests = [];

  return http.createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'content-type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, { ok: true, service: 'weather-check-mock-api' });
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  const body = await readRequestBody(request);
  const payload = safeJsonParse(body);
  const context = payload?.context ?? createFallbackContext();

  if (request.url === '/weather/provider-snapshot') {
    sendJson(response, 200, createProviderSnapshot(context));
    return;
  }

  if (request.url === '/field-reports/snapshot') {
    sendJson(response, 200, createFieldReportSnapshot(context, payload, storedReports, storedRequests));
    return;
  }

  if (request.url === '/field-reports') {
    const report = {
      ...payload,
      id: typeof payload.id === 'string' ? payload.id : createId('api-report'),
      createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : new Date().toISOString(),
      moderationStatus: payload.moderationStatus ?? 'visible',
      source: 'api',
    };
    storedReports.unshift(report);
    if (report.requestId) {
      const linkedRequest = storedRequests.find((item) => item.id === report.requestId);
      if (linkedRequest) {
        linkedRequest.answers = storedReports.filter((item) => item.requestId === report.requestId).length;
        linkedRequest.status = `답변 ${linkedRequest.answers}개`;
        linkedRequest.hint = `${linkedRequest.answers}개의 현장 답변이 있어요.`;
        linkedRequest.lastAnsweredAt = report.createdAt;
      }
    }
    sendJson(response, 201, report);
    return;
  }

  if (request.url === '/report-requests') {
    const reportRequest = {
      ...payload,
      id: typeof payload.id === 'string' ? payload.id : createId('api-request'),
      answers: Number.isFinite(payload.answers) ? payload.answers : 0,
      createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : new Date().toISOString(),
      source: 'api',
    };
    storedRequests.unshift(reportRequest);
    sendJson(response, 201, reportRequest);
    return;
  }

  const requestAnswerMatch = request.url?.match(/^\/report-requests\/([^/]+)\/answer$/);

  if (requestAnswerMatch) {
    const requestId = decodeURIComponent(requestAnswerMatch[1]);
    const existingRequest = storedRequests.find((item) => item.id === requestId);

    if (!existingRequest) {
      sendJson(response, 404, { error: 'Report request not found.' });
      return;
    }

    const updatedRequest = {
      ...existingRequest,
      answers: Number.isFinite(existingRequest.answers) ? existingRequest.answers + 1 : 1,
      status: typeof payload.status === 'string' ? payload.status : '답변 대기',
      hint: typeof payload.hint === 'string' ? payload.hint : '방금 답변됨',
      lastAnsweredAt: new Date().toISOString(),
    };
    const index = storedRequests.findIndex((item) => item.id === requestId);
    storedRequests.splice(index, 1, updatedRequest);
    sendJson(response, 200, updatedRequest);
    return;
  }

  const moderationMatch = request.url?.match(/^\/reports\/([^/]+)\/moderation$/);

  if (moderationMatch) {
    const reportId = decodeURIComponent(moderationMatch[1]);
    const index = storedReports.findIndex((item) => item.id === reportId);
    const moderationStatus = payload.moderationStatus === 'hidden' ? 'hidden' : 'pending';

    if (index >= 0) {
      storedReports[index] = {
        ...storedReports[index],
        moderationStatus,
      };
    }

    sendJson(response, 200, {
      ok: true,
      reportId,
      moderationStatus,
    });
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createMockApiServer();

  server.listen(port, '0.0.0.0', () => {
    console.log(`Mock API server listening on http://0.0.0.0:${port}`);
  });
}

function createProviderSnapshot(context) {
  const weather = normalizeWeather(context.detectedWeather);
  const generatedAt = new Date().toISOString();

  return {
    generatedAt,
    source: 'api',
    context,
    sources: [
      {
        providerId: 'kma',
        iconUri: 'https://www.kma.go.kr/favicon.ico',
        name: '대한민국 기상청',
        mark: 'K',
        condition: weather.kma.condition,
        temp: weather.kma.temp,
        detail: weather.kma.detail,
        badge: weather.kma.badge,
        color: providerColors.kma,
      },
      {
        providerId: 'yr',
        iconUri: 'https://www.yr.no/favicon.ico',
        name: '노르웨이 기상청',
        mark: 'Yr',
        condition: weather.yr.condition,
        temp: weather.yr.temp,
        detail: weather.yr.detail,
        badge: weather.yr.badge,
        color: providerColors.yr,
      },
      {
        providerId: 'fmi',
        name: '핀란드 기상청',
        mark: 'FMI',
        condition: weather.windy.condition,
        temp: weather.windy.temp,
        detail: weather.windy.detail,
        badge: weather.windy.badge,
        color: providerColors.fmi,
      },
    ],
    summaries: [
      createSummary('대한민국 기상청', 'K', 'KMA', weather.kma.condition, weather.kma.value, providerColors.kma),
      createSummary('노르웨이 기상청', 'Yr', 'MET Norway', weather.yr.condition, weather.yr.value, providerColors.yr),
      createSummary('핀란드 기상청', 'FMI', 'FMI', weather.windy.condition, weather.windy.value, providerColors.fmi),
    ],
    differences: [
      {
        name: '대한민국 기상청',
        mark: 'K',
        body: '국내 단기예보 기준으로 현재 시간대의 강수 가능성을 우선 확인합니다.',
        badge: '국내 예보',
        color: providerColors.kma,
      },
      {
        name: '노르웨이 기상청',
        mark: 'Yr',
        body: '강수량과 온도 흐름을 함께 보며 약한 비 가능성을 비교합니다.',
        badge: '강수량',
        color: providerColors.yr,
      },
      {
        name: '핀란드 기상청',
        mark: 'FMI',
        body: 'ECMWF 기반 지점 예보로 같은 위치의 기온, 강수량, 구름량을 비교합니다.',
        badge: 'ECMWF 예보',
        color: providerColors.fmi,
      },
    ],
    hourlyRows: createCompareRows(weather, 'hourly'),
    dailyRows: createCompareRows(weather, 'daily'),
  };
}

function createFieldReportSnapshot(context, payload, storedReports = [], storedRequests = []) {
  const localReports = Array.isArray(payload?.localReports) ? payload.localReports : [];
  const localRequests = Array.isArray(payload?.localRequests) ? payload.localRequests : [];
  const place = context.place ?? '현재 위치';

  const reports = [
    ...storedReports.filter((report) => report.moderationStatus !== 'hidden'),
    {
      id: `api-report-${Date.now()}`,
      place: `${place} 근처`,
      time: '방금',
      condition: context.detectedWeather ?? '확인 필요',
      body: 'API 모드 테스트용 현장 제보입니다. 실제 서버가 붙으면 이 자리에 사용자 제보가 들어옵니다.',
      createdAt: new Date().toISOString(),
      moderationStatus: 'visible',
      source: 'api',
    },
    ...localReports,
  ].slice(0, 8);

  const mergedRequests = [...storedRequests, ...localRequests];
  const requests = mergedRequests.length > 0
    ? mergedRequests.slice(0, 12)
    : [
        {
          id: 'api-request-current-place',
          question: `${place} 지금 날씨 어떤가요?`,
          hint: '근처라면 바로 답변 가능',
          place,
          distance: '근처',
          answers: 0,
          time: '방금',
          status: '답변 대기',
          mark: '현',
          accent: '#d6d2c4',
        },
      ];

  return {
    generatedAt: new Date().toISOString(),
    source: 'api',
    context,
    reports,
    requests,
  };
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeWeather(detectedWeather) {
  if (detectedWeather === '맑음') {
    return {
      kma: createProviderWeather('구름 조금', '28도', '현재 강수 신호가 거의 없어요.', '맑음', '10%'),
      yr: createProviderWeather('맑음', '27도', '강수량을 0에 가깝게 보고 있어요.', '건조', '0mm'),
      windy: createProviderWeather('비구름 없음', '28도', '비구름 흐름이 위치를 벗어나 있어요.', '안정', '약함'),
    };
  }

  if (detectedWeather === '천둥번개') {
    return {
      kma: createProviderWeather('소나기', '24도', '짧은 시간 강한 비 가능성이 있어요.', '주의', '55%'),
      yr: createProviderWeather('불안정', '23도', '국지성 소나기 가능성을 봅니다.', '불안정', '0.8mm'),
      windy: createProviderWeather('강한 구름', '24도', '비구름 핵이 빠르게 지날 수 있어요.', '강함', '접근'),
    };
  }

  return {
    kma: createProviderWeather('약한 비', '23도', '현재 강수 신호가 있고 조금 더 짙어질 수 있어요.', '비', '50%'),
    yr: createProviderWeather('흐림', '22도', '강수량은 작지만 구름대가 걸쳐 있어요.', '흐림', '0.4mm'),
    windy: createProviderWeather('비구름 접근', '23도', '남서쪽 비구름 흐름이 접근 중이에요.', '접근', '남서풍'),
  };
}

function createProviderWeather(condition, temp, detail, badge, value) {
  return { condition, temp, detail, badge, value };
}

function createSummary(name, mark, subtitle, weather, value, color) {
  return {
    name,
    mark,
    subtitle,
    summary: `${weather} 기준으로 현재 위치를 보고 있어요.`,
    weather,
    value,
    color,
  };
}

function createCompareRows(weather, mode) {
  const labels = mode === 'daily'
    ? ['오늘', '내일', '모레', '주말', '월요일', '화요일']
    : ['지금', '1시간 뒤', '3시간 뒤', '6시간 뒤', '9시간 뒤', '12시간 뒤'];

  return labels.map((label, index) => ({
    label,
    kma: createCell(weather.kma, index),
    yr: createCell(weather.yr, index),
    windy: createCell(weather.windy, index),
  }));
}

function createCell(providerWeather, index) {
  const mark = providerWeather.condition.slice(0, 1);
  const suffix = index === 0 ? providerWeather.value : index < 3 ? '변화 가능' : '재확인';

  return {
    mark,
    weather: providerWeather.condition,
    detail: `${providerWeather.temp} · ${suffix}`,
    tone: '#64748b',
  };
}

function createFallbackContext() {
  return {
    raw: '현재 위치 기준',
    place: '현재 위치',
    target: {
      id: 'current-location',
      label: '현재 위치',
      kind: 'current',
      radiusMeters: 1200,
    },
    timeLabel: '지금',
    detectedWeather: '비',
    interpretationNote: '기본 위치 기준으로 보여주고 있어요.',
    needsClarification: false,
  };
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}
