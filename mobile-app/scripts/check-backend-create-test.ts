import { createQuestionJudgement } from '../src/domain/judgement';
import {
  createRemoteFieldReport,
  createRemoteReportRequest,
  fetchFieldReportSnapshot,
  moderateRemoteFieldReport,
} from '../src/services/fieldReports';
import { appConfig, isApiModeEnabled, isBackendConfigured } from '../src/config/appConfig';

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

export async function runBackendCreateSmokeCheck() {
  expectEqual(isApiModeEnabled(), true, 'api mode enabled');
  expectEqual(isBackendConfigured(), true, 'backend configured');
  expectTruthy(appConfig.apiBaseUrl.includes('127.0.0.1'), 'api base url');

  const judgement = createQuestionJudgement('잠실운동장 지금 비 와?');
  const stamp = Date.now();
  const createdReport = await createRemoteFieldReport({
    id: `backend-mode-report-${stamp}`,
    place: judgement.searchContext.place,
    time: '방금',
    condition: '비 없음',
    body: 'Backend mode smoke report',
    createdAt: new Date().toISOString(),
    moderationStatus: 'visible',
    source: 'local',
  });
  const createdRequest = await createRemoteReportRequest({
    id: `backend-mode-request-${stamp}`,
    question: 'Backend mode smoke request',
    hint: 'smoke',
    place: judgement.searchContext.place,
    distance: '근처',
    answers: 0,
    time: '방금',
    status: '답변 대기',
    mark: '현',
    accent: '#d6d2c4',
    createdAt: new Date().toISOString(),
    source: 'local',
    latitude: 37.515,
    longitude: 127.0728,
  });

  expectTruthy(createdReport?.id, 'created remote report');
  expectTruthy(createdRequest?.id, 'created remote request');

  const answerReport = await createRemoteFieldReport({
    id: `backend-mode-answer-${stamp}`,
    requestId: createdRequest?.id,
    place: judgement.searchContext.place,
    time: '방금',
    condition: '비 없음',
    body: 'Backend mode linked answer',
    createdAt: new Date().toISOString(),
    moderationStatus: 'visible',
    source: 'local',
    latitude: 37.515,
    longitude: 127.0728,
  });
  expectTruthy(answerReport?.id, 'created linked answer');

  const moderation = await moderateRemoteFieldReport(String(createdReport?.id), 'backend mode smoke moderation');
  expectEqual(moderation?.ok, true, 'moderation ok');
  expectEqual(moderation?.moderationStatus, 'pending', 'moderation status');

  const fieldSnapshot = await fetchFieldReportSnapshot([], judgement.searchContext, []);
  const answeredRequest = fieldSnapshot.requests.find((request) => request.id === createdRequest?.id);
  expectEqual(answeredRequest?.answers, 1, 'answered remote request count');
  expectEqual(answeredRequest?.status, '답변 있음', 'answered remote request status');
  expectTruthy(
    fieldSnapshot.reports.some((report) => report.id === createdReport?.id),
    'created report appears in snapshot',
  );
  expectTruthy(
    fieldSnapshot.requests.some((request) => request.id === createdRequest?.id),
    'created request appears in snapshot',
  );
}
