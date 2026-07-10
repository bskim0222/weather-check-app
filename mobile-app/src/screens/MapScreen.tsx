import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { FieldReportMapCard } from '../components/FieldReportMapCard';
import { getMockFieldReportSnapshot } from '../services/fieldReports';
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
  const fieldSnapshot = useMemo(
    () => getMockFieldReportSnapshot(reports, searchContext),
    [reports, searchContext],
  );
  const visibleClusters = useMemo(
    () => createMapReportClusters(fieldSnapshot.reports, searchContext.place),
    [fieldSnapshot.reports, searchContext.place],
  );
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchContext.place]);

  const selectedCluster = selectedIndex >= 0 ? visibleClusters[selectedIndex] : undefined;

  return (
    <View>
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

function getDominantCondition(reports: LocalReport[]) {
  const counts = new Map<string, number>();

  reports.forEach((report) => {
    counts.set(report.condition, (counts.get(report.condition) ?? 0) + 1);
  });

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '현장 제보';
}
