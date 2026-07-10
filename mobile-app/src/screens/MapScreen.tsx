import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { FieldReportMapCard } from '../components/FieldReportMapCard';
import { visibleReportsOnly } from '../domain/moderation';
import { styles } from '../styles/appStyles';
import type { LocalReport, MapReportCluster, SearchContext, WeatherPreset } from '../types/weather';

type MapScreenProps = {
  current: WeatherPreset;
  reports: LocalReport[];
  searchContext: SearchContext;
  onUseCurrentLocation: () => void;
  onReportIssue: (report: LocalReport) => void;
};

export function MapScreen({
  current,
  reports,
  searchContext,
  onUseCurrentLocation,
  onReportIssue,
}: MapScreenProps) {
  const mapReports = useMemo(() => getMapReportsForContext(reports, searchContext), [reports, searchContext]);
  const visibleClusters = useMemo(
    () => createMapReportClusters(mapReports, searchContext.place),
    [mapReports, searchContext.place],
  );
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchContext.place]);

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
        onSelectCluster={setSelectedIndex}
        onUseCurrentLocation={onUseCurrentLocation}
      />
    </View>
  );
}

function getMapReportsForContext(reports: LocalReport[], searchContext: SearchContext) {
  const visibleReports = visibleReportsOnly(reports);

  if (isCurrentLocationContext(searchContext)) return visibleReports;

  const relatedReports = visibleReports.filter((report) =>
    isRelatedPlace(report.place, searchContext.place),
  );

  return relatedReports;
}

function createMapReportClusters(reports: LocalReport[], fallbackPlace: string): MapReportCluster[] {
  const groups = new Map<string, LocalReport[]>();

  reports.forEach((report) => {
    const key = normalizeClusterLabel(report.place || fallbackPlace);
    const group = groups.get(key) ?? [];
    group.push(report);
    groups.set(key, group);
  });

  return Array.from(groups.entries()).map(([label, group], index) => ({
    id: `cluster-${index}-${label}`,
    label: label.includes('주변') ? label : `${label} 주변`,
    count: group.length,
    dominantCondition: getDominantCondition(group),
    privacyRadiusLabel: '약 700m 묶음',
    reports: group,
  }));
}

function normalizeClusterLabel(place: string) {
  const clean = place.trim();
  if (!clean) return '내 주변';

  const parts = clean.split(/\s+/).filter(Boolean);
  const neighborhood = parts.find((part) => /(동|읍|면|리|가)$/.test(part));
  if (neighborhood) return neighborhood;

  return parts.at(-1) ?? clean;
}

function isCurrentLocationContext(searchContext: SearchContext) {
  return searchContext.target.kind === 'current' || searchContext.place === '?꾩옱 ?꾩튂';
}

function isRelatedPlace(reportPlace: string, contextPlace: string) {
  const reportTokens = tokenizePlace(reportPlace);
  const contextTokens = tokenizePlace(contextPlace);

  return contextTokens.some((token) =>
    reportTokens.some((reportToken) => reportToken.includes(token) || token.includes(reportToken)),
  );
}

function tokenizePlace(place: string) {
  return place
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function getDominantCondition(reports: LocalReport[]) {
  const counts = new Map<string, number>();

  reports.forEach((report) => {
    counts.set(report.condition, (counts.get(report.condition) ?? 0) + 1);
  });

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '현장 제보';
}
