import { visibleReportsOnly } from './moderation';
import type { LocalReport, MapReportCluster, ReportRequest, SearchContext } from '../types/weather';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export const KOREA_MAP_BOUNDS = {
  minLatitude: 32.8,
  maxLatitude: 38.7,
  minLongitude: 124.0,
  maxLongitude: 132.2,
} as const;

export const MAP_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAP_PRIVACY_GRID_DEGREES = 0.015;

export function requestToMapReport(request: ReportRequest): LocalReport {
  return {
    id: `map-request-${request.id}`,
    requestId: request.id,
    place: request.place,
    time: request.time,
    condition: '현장 문의',
    body: request.question,
    createdAt: request.createdAt,
    moderationStatus: 'visible',
    source: request.source,
    // Question markers must represent the requested place, never the
    // requester's GPS position. Resolve the public place label on the map.
    mapItemKind: 'question',
    privacyRadiusMeters: request.privacyRadiusMeters,
  };
}

export function getRecentMapReports(reports: LocalReport[], now = Date.now()) {
  const cutoff = now - MAP_ACTIVITY_WINDOW_MS;

  return visibleReportsOnly(reports)
    .filter((report) => report.source !== 'mock')
    .filter((report) => {
      const createdAt = report.createdAt ? Date.parse(report.createdAt) : Number.NaN;
      return Number.isFinite(createdAt) && createdAt >= cutoff;
    });
}

export function createMapReportClusters(
  reports: LocalReport[],
  coordinatesByPlace: Record<string, MapCoordinate | null>,
  gridDegrees = MAP_PRIVACY_GRID_DEGREES,
): MapReportCluster[] {
  const groups = new Map<string, { coordinate: MapCoordinate; reports: LocalReport[] }>();
  const safeGridDegrees = Math.max(MAP_PRIVACY_GRID_DEGREES, gridDegrees);

  reports.forEach((report) => {
    const sourcePlace = report.place.trim();
    const coordinate = hasStoredClusterCoordinate(report)
      ? {
          latitude: report.clusterLatitude,
          longitude: report.clusterLongitude,
        }
      : coordinatesByPlace[sourcePlace];
    if (!sourcePlace || !coordinate || !isValidKoreaMapCoordinate(coordinate)) return;

    const aggregateCoordinate = {
      latitude: roundToGrid(coordinate.latitude, safeGridDegrees),
      longitude: roundToGrid(coordinate.longitude, safeGridDegrees),
    };
    const key = `${aggregateCoordinate.latitude.toFixed(4)}:${aggregateCoordinate.longitude.toFixed(4)}`;
    const group = groups.get(key) ?? { coordinate: aggregateCoordinate, reports: [] };
    group.reports.push(report);
    groups.set(key, group);
  });

  return Array.from(groups.entries()).map(([gridKey, group], index) => {
    const sourcePlace = group.reports[0]?.place ?? '현재 위치';
    const label = normalizeClusterLabel(sourcePlace);

    return {
      id: `cluster-${index}-${gridKey}`,
      label: `${label} 주변`,
      count: group.reports.length,
      dominantCondition: getDominantCondition(group.reports),
      privacyRadiusLabel: '최근 24시간 현장 글',
      reports: group.reports,
      latitude: group.coordinate.latitude,
      longitude: group.coordinate.longitude,
      kind: getClusterKind(group.reports),
    };
  });
}

export function roundToPrivacyGrid(value: number) {
  return roundToGrid(value, MAP_PRIVACY_GRID_DEGREES);
}

export function hasMapTargetCoordinates(searchContext: SearchContext) {
  return isValidKoreaMapCoordinate(searchContext.target);
}

export function isValidKoreaMapCoordinate(
  coordinate: { latitude?: number; longitude?: number } | null | undefined,
): coordinate is MapCoordinate {
  if (!coordinate) return false;
  const { latitude, longitude } = coordinate;

  return typeof latitude === 'number'
    && typeof longitude === 'number'
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= KOREA_MAP_BOUNDS.minLatitude
    && latitude <= KOREA_MAP_BOUNDS.maxLatitude
    && longitude >= KOREA_MAP_BOUNDS.minLongitude
    && longitude <= KOREA_MAP_BOUNDS.maxLongitude;
}

function roundToGrid(value: number, gridDegrees: number) {
  return Math.round(value / gridDegrees) * gridDegrees;
}

export function hasStoredClusterCoordinate(
  report: LocalReport,
): report is LocalReport & { clusterLatitude: number; clusterLongitude: number } {
  const latitude = report.clusterLatitude;
  const longitude = report.clusterLongitude;

  return isValidKoreaMapCoordinate({ latitude, longitude });
}

function getClusterKind(reports: LocalReport[]): MapReportCluster['kind'] {
  const hasQuestions = reports.some((report) => report.mapItemKind === 'question');
  const hasReports = reports.some((report) => report.mapItemKind !== 'question');

  if (hasQuestions && hasReports) return 'mixed';
  return hasQuestions ? 'question' : 'report';
}

function normalizeClusterLabel(place: string) {
  const clean = normalizePlaceText(place);
  if (!clean) return '현재 위치';

  const parts = clean.split(/\s+/).filter(Boolean);
  const neighborhood = parts.find((part) => /(동|읍|면|리|가)$/.test(part));
  if (neighborhood) return neighborhood.replace(/[0-9-]/g, '');

  const district = parts.find((part) => /(구|군|시)$/.test(part));
  if (district) return district;

  return parts.at(-1) ?? clean;
}

function normalizePlaceText(place: string) {
  return place
    .replace(/대한민국/g, ' ')
    .replace(/현재\s*위치/g, ' ')
    .replace(/[()·,]/g, ' ')
    .replace(/\d+(?:-\d+)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDominantCondition(reports: LocalReport[]) {
  const counts = new Map<string, number>();

  reports.forEach((report) => {
    counts.set(report.condition, (counts.get(report.condition) ?? 0) + 1);
  });

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '현장 제보';
}
