import type { LocalReport, ReportRequest, SearchContext } from '../types/weather';
import { isApiModeEnabled } from '../config/appConfig';
import { reportRequests } from '../data/mockWeather';
import { visibleReportsOnly } from '../domain/moderation';
import { buildMapContextReports, buildReportPromptRows, orderReportsBySearchContext } from '../domain/reports';
import { sendApiJson, writeApiJson } from './apiClient';
import type {
  ApiCreateFieldReportRequest,
  ApiCreateReportRequestRequest,
  ApiAnswerReportRequestRequest,
  ApiDeleteResponse,
  ApiFieldReportSnapshot,
  ApiFieldReportSnapshotRequest,
  ApiModerateReportRequest,
  ApiModerateReportResponse,
  ApiUpdateFieldReportRequest,
  ApiUpdateReportRequestRequest,
} from '../types/api';

export type FieldReportSnapshot = {
  context: SearchContext;
  generatedAt: string;
  source: 'mock' | 'api';
  reports: LocalReport[];
  requests: ReportRequest[];
};

export function getMockMapReports(reports: LocalReport[], searchContext: SearchContext) {
  const visibleReports = visibleReportsOnly(reports);

  if (searchContext.place === '현재 위치') return visibleReports;

  const ordered = orderReportsBySearchContext(visibleReports, searchContext);

  return ordered === visibleReports ? [...buildMapContextReports(searchContext), ...visibleReports] : ordered;
}

export function getMockReportFeed(reports: LocalReport[], searchContext: SearchContext) {
  const visibleReports = visibleReportsOnly(reports);

  if (searchContext.place === '현재 위치') return visibleReports;

  const ordered = orderReportsBySearchContext(visibleReports, searchContext);

  return ordered === visibleReports ? [...buildReportPromptRows(searchContext), ...visibleReports] : ordered;
}

export function getMockReportRequests(searchContext: SearchContext, requests: ReportRequest[] = reportRequests) {
  if (searchContext.place === '현재 위치') return requests;

  const related = requests.filter((request) => request.place.includes(searchContext.place));
  const others = requests.filter((request) => !request.place.includes(searchContext.place));

  return related.length > 0 ? [...related, ...others] : requests;
}

export function getMockFieldReportSnapshot(
  reports: LocalReport[],
  searchContext: SearchContext,
  requests: ReportRequest[] = reportRequests,
): FieldReportSnapshot {
  return {
    context: searchContext,
    generatedAt: new Date().toISOString(),
    source: 'mock',
    reports: getMockReportFeed(reports, searchContext),
    requests: getMockReportRequests(searchContext, requests),
  };
}

export async function fetchFieldReports(reports: LocalReport[], searchContext: SearchContext) {
  const snapshot = await fetchFieldReportSnapshot(reports, searchContext);

  return snapshot.reports;
}

export async function fetchFieldReportSnapshot(
  reports: LocalReport[],
  searchContext: SearchContext,
  requests: ReportRequest[] = reportRequests,
): Promise<FieldReportSnapshot> {
  if (isApiModeEnabled()) {
    const response = await writeApiJson<ApiFieldReportSnapshot, ApiFieldReportSnapshotRequest>(
      '/field-reports/snapshot',
      {
        context: searchContext,
        localReports: reports,
        localRequests: requests,
      },
    );

    if (response.ok && response.data) {
      return normalizeFieldReportSnapshot(response.data, searchContext);
    }
  }

  return getMockFieldReportSnapshot(reports, searchContext, requests);
}

export async function createRemoteFieldReport(report: LocalReport) {
  if (!isApiModeEnabled()) return null;

  const response = await writeApiJson<LocalReport, ApiCreateFieldReportRequest>(
    '/field-reports',
    report,
  );

  return response.ok && response.data ? response.data : null;
}

export async function updateRemoteFieldReport(reportId: string, updates: ApiUpdateFieldReportRequest) {
  if (!isApiModeEnabled()) return null;

  const response = await sendApiJson<LocalReport, ApiUpdateFieldReportRequest>(
    `/field-reports/${encodeURIComponent(reportId)}`,
    'PATCH',
    updates,
  );

  return response.ok && response.data ? response.data : null;
}

export async function deleteRemoteFieldReport(reportId: string) {
  if (!isApiModeEnabled()) return null;

  const response = await sendApiJson<ApiDeleteResponse>(
    `/field-reports/${encodeURIComponent(reportId)}`,
    'DELETE',
  );

  return response.ok && response.data ? response.data : null;
}

export async function createRemoteReportRequest(request: ReportRequest) {
  if (!isApiModeEnabled()) return null;

  const response = await writeApiJson<ReportRequest, ApiCreateReportRequestRequest>(
    '/report-requests',
    request,
  );

  return response.ok && response.data ? response.data : null;
}

export async function updateRemoteReportRequest(
  requestId: string,
  updates: ApiUpdateReportRequestRequest,
) {
  if (!isApiModeEnabled()) return null;

  const response = await sendApiJson<ReportRequest, ApiUpdateReportRequestRequest>(
    `/report-requests/${encodeURIComponent(requestId)}`,
    'PATCH',
    updates,
  );

  return response.ok && response.data ? response.data : null;
}

export async function deleteRemoteReportRequest(requestId: string) {
  if (!isApiModeEnabled()) return null;

  const response = await sendApiJson<ApiDeleteResponse>(
    `/report-requests/${encodeURIComponent(requestId)}`,
    'DELETE',
  );

  return response.ok && response.data ? response.data : null;
}

export async function answerRemoteReportRequest(requestId: string, status: string, hint: string) {
  if (!isApiModeEnabled()) return null;

  const response = await writeApiJson<ReportRequest, ApiAnswerReportRequestRequest>(
    `/report-requests/${encodeURIComponent(requestId)}/answer`,
    {
      status,
      hint,
    },
  );

  return response.ok && response.data ? response.data : null;
}

export async function moderateRemoteFieldReport(reportId: string, reason: string) {
  if (!isApiModeEnabled()) return null;

  const response = await writeApiJson<ApiModerateReportResponse, ApiModerateReportRequest>(
    `/reports/${encodeURIComponent(reportId)}/moderation`,
    {
      moderationStatus: 'pending',
      reason,
    },
  );

  return response.ok && response.data ? response.data : null;
}

export function normalizeFieldReportSnapshot(
  snapshot: ApiFieldReportSnapshot,
  fallbackContext: SearchContext,
): FieldReportSnapshot {
  return {
    context: snapshot.context ?? fallbackContext,
    generatedAt: snapshot.generatedAt ?? new Date().toISOString(),
    source: snapshot.source ?? 'api',
    reports: Array.isArray(snapshot.reports) ? snapshot.reports : [],
    requests: Array.isArray(snapshot.requests) ? snapshot.requests : [],
  };
}

function hasItems<T>(value: T[] | undefined) {
  return Array.isArray(value) && value.length > 0;
}
