import type { LocationStatus } from '../types/appState';
import type { LocalReport, ReportRequest } from '../types/weather';

export const QUESTION_ACTIVE_WINDOW_MS = 2 * 60 * 60 * 1000;
export const FIELD_REPORT_VISIBLE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MY_QUESTION_HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const ANSWER_RADIUS_METERS = 3000;

export function isQuestionActive(request: ReportRequest, now = Date.now()) {
  return isWithinWindow(request.createdAt, QUESTION_ACTIVE_WINDOW_MS, now);
}

export function isFieldReportVisible(report: LocalReport, now = Date.now()) {
  return isWithinWindow(report.createdAt, FIELD_REPORT_VISIBLE_WINDOW_MS, now);
}

export function isMyQuestionVisible(request: ReportRequest, now = Date.now()) {
  return request.source === 'local'
    && isWithinWindow(request.createdAt, MY_QUESTION_HISTORY_WINDOW_MS, now);
}

export function getQuestionStatus(request: ReportRequest, now = Date.now()) {
  if (!isQuestionActive(request, now)) return '종료';
  if (request.answers > 0) return `답변 ${request.answers}개`;
  return '답변 대기';
}

export function getAnswerDistanceMeters(
  request: ReportRequest,
  locationStatus: LocationStatus,
) {
  if (
    !Number.isFinite(locationStatus.latitude)
    || !Number.isFinite(locationStatus.longitude)
    || !Number.isFinite(request.clusterLatitude)
    || !Number.isFinite(request.clusterLongitude)
  ) {
    return null;
  }

  return getDistanceMeters(
    locationStatus.latitude!,
    locationStatus.longitude!,
    request.clusterLatitude!,
    request.clusterLongitude!,
  );
}

export function canAnswerQuestion(
  request: ReportRequest,
  locationStatus: LocationStatus,
  now = Date.now(),
) {
  const distanceMeters = getAnswerDistanceMeters(request, locationStatus);

  return isQuestionActive(request, now)
    && distanceMeters != null
    && distanceMeters <= ANSWER_RADIUS_METERS;
}

export function getAnswerableQuestions(
  requests: ReportRequest[],
  locationStatus: LocationStatus,
  now = Date.now(),
) {
  return requests
    .filter((request) => request.source !== 'local')
    .filter((request) => canAnswerQuestion(request, locationStatus, now))
    .sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
}

export function getVisibleFieldReports(reports: LocalReport[], now = Date.now()) {
  return reports
    .filter((report) => isFieldReportVisible(report, now))
    .sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
}

export function formatDistance(distanceMeters: number | null) {
  if (distanceMeters == null) return '';
  if (distanceMeters < 1000) {
    return `${Math.max(100, Math.round(distanceMeters / 100) * 100)}m`;
  }

  return `${(distanceMeters / 1000).toFixed(distanceMeters >= 10_000 ? 0 : 1)}km`;
}

function isWithinWindow(createdAt: string | undefined, windowMs: number, now: number) {
  const createdAtMs = getTimestamp(createdAt);
  return createdAtMs > 0 && createdAtMs <= now && createdAtMs >= now - windowMs;
}

function getTimestamp(value: string | undefined) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getDistanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB))
    * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
