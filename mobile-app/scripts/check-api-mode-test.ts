import { createQuestionJudgement } from '../src/domain/judgement';
import {
  answerRemoteReportRequest,
  createRemoteFieldReport,
  createRemoteReportRequest,
  fetchFieldReportSnapshot,
  moderateRemoteFieldReport,
} from '../src/services/fieldReports';
import { fetchProviderSnapshot } from '../src/services/weatherProviders';
import { appConfig, isApiModeEnabled, isBackendConfigured } from '../src/config/appConfig';
import { writeApiJson } from '../src/services/apiClient';
import type { ApiWeatherProviderSnapshot, ApiWeatherProviderSnapshotRequest } from '../src/types/api';

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

export async function runApiModeSmokeCheck() {
  expectEqual(isApiModeEnabled(), true, 'api mode enabled');
  expectEqual(isBackendConfigured(), true, 'backend configured');
  expectTruthy(appConfig.apiBaseUrl.includes('127.0.0.1'), 'api base url');

  const judgement = createQuestionJudgement('잠실운동장 지금 비 와?');
  const directResponse = await fetch(`${appConfig.apiBaseUrl}/health`);
  expectEqual(directResponse.ok, true, 'direct health fetch');

  const apiClientResponse = await writeApiJson<ApiWeatherProviderSnapshot, ApiWeatherProviderSnapshotRequest>(
    '/weather/provider-snapshot',
    { context: judgement.searchContext },
  );
  expectEqual(apiClientResponse.ok, true, `api client provider response ${apiClientResponse.error ?? ''}`);

  const providerSnapshot = await fetchProviderSnapshot(judgement.searchContext);
  const createdReport = await createRemoteFieldReport({
    id: 'api-mode-report',
    place: judgement.searchContext.place,
    time: '방금',
    condition: '비 안 옴',
    body: 'API mode smoke report',
    createdAt: new Date().toISOString(),
    moderationStatus: 'visible',
    source: 'local',
  });
  const createdRequest = await createRemoteReportRequest({
    id: 'api-mode-request',
    question: 'API mode smoke request',
    hint: 'smoke',
    place: judgement.searchContext.place,
    distance: '근처',
    answers: 0,
    time: '방금',
    status: '답변 대기',
    mark: '요',
    accent: '#d6d2c4',
    createdAt: new Date().toISOString(),
    source: 'local',
  });
  const answeredRequest = await answerRemoteReportRequest(String(createdRequest?.id), '답변 있음', '방금 답변됨');
  const moderation = await moderateRemoteFieldReport(String(createdReport?.id), 'api mode smoke moderation');
  const fieldSnapshot = await fetchFieldReportSnapshot([], judgement.searchContext, []);

  expectEqual(providerSnapshot.source, 'api', 'provider source');
  expectEqual(fieldSnapshot.source, 'api', 'field source');
  expectEqual(providerSnapshot.context.place, judgement.searchContext.place, 'provider context place');
  expectEqual(fieldSnapshot.context.place, judgement.searchContext.place, 'field context place');
  expectEqual(providerSnapshot.sources.length, 3, 'provider source count');
  expectTruthy(providerSnapshot.hourlyRows.length > 0, 'provider hourly rows');
  expectTruthy(providerSnapshot.dailyRows.length > 0, 'provider daily rows');
  expectTruthy(fieldSnapshot.reports.length > 0, 'field reports');
  expectTruthy(fieldSnapshot.requests.length > 0, 'field requests');
  expectTruthy(createdReport?.id, 'created API-mode report');
  expectTruthy(createdRequest?.id, 'created API-mode request');
  expectEqual(answeredRequest?.answers, 1, 'answered API-mode request count');
  expectEqual(moderation?.ok, true, 'API-mode moderation ok');
}
