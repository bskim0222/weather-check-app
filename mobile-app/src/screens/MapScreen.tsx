import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { FieldReportMapCard } from '../components/FieldReportMapCard';
import { visibleReportsOnly } from '../domain/moderation';
import { searchRemotePlaces } from '../services/geocoding';
import { styles } from '../styles/appStyles';
import type { LocalReport, MapReportCluster, ReportRequest, SearchContext, WeatherPreset } from '../types/weather';

type MapScreenProps = {
  current: WeatherPreset;
  requests: ReportRequest[];
  reports: LocalReport[];
  searchContext: SearchContext;
  questionText: string;
  onUseCurrentLocation: () => void;
  onSearchLocation: (query?: string, location?: SearchContext['target']) => void;
  onReportIssue: (report: LocalReport) => void;
};

export function MapScreen({
  current,
  requests,
  reports,
  searchContext,
  questionText,
  onUseCurrentLocation,
  onSearchLocation,
  onReportIssue,
}: MapScreenProps) {
  const mapReports = useMemo(
    () => getRecentMapReports([...reports, ...requests.map(requestToMapReport)]),
    [reports, requests],
  );
  const [coordinatesByPlace, setCoordinatesByPlace] = useState<Record<string, MapCoordinate | null>>({});
  const visibleClusters = useMemo(
    () => createMapReportClusters(mapReports, coordinatesByPlace),
    [coordinatesByPlace, mapReports],
  );
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchContext.place]);

  useEffect(() => {
    let cancelled = false;
    const places = Array.from(
      new Set(
        mapReports
          .filter((report) => !hasStoredClusterCoordinate(report))
          .map((report) => report.place.trim())
          .filter(Boolean),
      ),
    );
    const unresolvedPlaces = places.filter((place) => !(place in coordinatesByPlace));

    if (unresolvedPlaces.length === 0) return;

    Promise.all(
      unresolvedPlaces.map(async (place) => {
        const candidates = await searchRemotePlaces(place, place);
        const location = candidates[0]?.location;

        return [
          place,
          location?.latitude != null && location?.longitude != null
            ? {
              latitude: roundToPrivacyGrid(location.latitude),
              longitude: roundToPrivacyGrid(location.longitude),
            }
            : null,
        ] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setCoordinatesByPlace((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });

    return () => {
      cancelled = true;
    };
  }, [coordinatesByPlace, mapReports]);

  const selectedCluster = selectedIndex >= 0 ? visibleClusters[selectedIndex] : undefined;

  return (
    <View style={styles.mapScreenRoot}>
      <FieldReportMapCard
        current={current}
        searchContext={searchContext}
        selectedCluster={selectedCluster}
        selectedIndex={selectedIndex}
        visibleClusters={visibleClusters}
        onCloseCluster={() => setSelectedIndex(-1)}
        onReportIssue={onReportIssue}
        questionText={questionText}
        onSearchLocation={onSearchLocation}
        onSelectCluster={setSelectedIndex}
        onUseCurrentLocation={onUseCurrentLocation}
      />
    </View>
  );
}

type MapCoordinate = {
  latitude: number;
  longitude: number;
};

const MAP_ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAP_PRIVACY_GRID_DEGREES = 0.015;

function requestToMapReport(request: ReportRequest): LocalReport {
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
    clusterLatitude: request.clusterLatitude,
    clusterLongitude: request.clusterLongitude,
    privacyRadiusMeters: request.privacyRadiusMeters,
  };
}

function getRecentMapReports(reports: LocalReport[]) {
  const cutoff = Date.now() - MAP_ACTIVITY_WINDOW_MS;
  return visibleReportsOnly(reports)
    .filter((report) => report.source !== 'mock')
    .filter((report) => {
      const createdAt = report.createdAt ? Date.parse(report.createdAt) : Number.NaN;
      return Number.isFinite(createdAt) && createdAt >= cutoff;
    });
}

function createMapReportClusters(
  reports: LocalReport[],
  coordinatesByPlace: Record<string, MapCoordinate | null>,
): MapReportCluster[] {
  const groups = new Map<string, { coordinate: MapCoordinate; reports: LocalReport[] }>();

  reports.forEach((report) => {
    const sourcePlace = report.place.trim();
    const coordinate = hasStoredClusterCoordinate(report)
      ? {
          latitude: report.clusterLatitude,
          longitude: report.clusterLongitude,
        }
      : coordinatesByPlace[sourcePlace];
    if (!sourcePlace || !coordinate) return;
    const key = `${coordinate.latitude.toFixed(4)}:${coordinate.longitude.toFixed(4)}`;
    const group = groups.get(key) ?? { coordinate, reports: [] };
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
      privacyRadiusLabel: '최근 24시간 · 약 1.5km 묶음',
      reports: group.reports,
      latitude: group.coordinate.latitude,
      longitude: group.coordinate.longitude,
    };
  });
}

function hasStoredClusterCoordinate(
  report: LocalReport,
): report is LocalReport & { clusterLatitude: number; clusterLongitude: number } {
  return Number.isFinite(report.clusterLatitude) && Number.isFinite(report.clusterLongitude);
}

function roundToPrivacyGrid(value: number) {
  return Math.round(value / MAP_PRIVACY_GRID_DEGREES) * MAP_PRIVACY_GRID_DEGREES;
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
