import { Text, View } from 'react-native';

import { NativeMapLayer } from './NativeMapLayer';
import { styles } from '../styles/appStyles';
import type { MapReportCluster, SearchContext } from '../types/weather';

type FieldReportMapCardProps = {
  decisionSummary: string;
  radiusLabel: string;
  searchContext: SearchContext;
  selectedIndex: number;
  visibleClusters: MapReportCluster[];
  onMapGestureChange: (isInteracting: boolean) => void;
  onSelectCluster: (index: number) => void;
};

export function FieldReportMapCard({
  decisionSummary,
  radiusLabel,
  searchContext,
  selectedIndex,
  visibleClusters,
  onMapGestureChange,
  onSelectCluster,
}: FieldReportMapCardProps) {
  const selectedCluster = resolveSelectedCluster(visibleClusters, selectedIndex);
  const dominantCondition = selectedCluster?.dominantCondition ?? searchContext.detectedWeather;

  return (
    <View style={styles.mapCard}>
      <NativeMapLayer
        searchContext={searchContext}
        selectedIndex={selectedIndex}
        visibleClusters={visibleClusters}
        onMapGestureChange={onMapGestureChange}
        onSelectCluster={onSelectCluster}
      />

      <View pointerEvents="box-none" style={styles.mapOverlay}>
        <View style={styles.mapOverlayTop}>
          <View style={styles.mapRadiusChip}>
            <Text style={styles.mapRadiusChipText}>{searchContext.place} · 위치보호 묶음</Text>
          </View>
          <Text numberOfLines={1} style={styles.mapOverlayCount}>{decisionSummary}</Text>
        </View>
        <Text numberOfLines={1} style={styles.mapTitle}>주변 제보는 {dominantCondition} 쪽이에요</Text>
        {!!selectedCluster && (
          <Text numberOfLines={2} style={styles.mapCaption}>
            {selectedCluster.label} · 최근 제보 {selectedCluster.count}개를 익명 묶음으로 보여줘요
          </Text>
        )}
      </View>
    </View>
  );
}

function resolveSelectedCluster(clusters: MapReportCluster[], selectedIndex: number) {
  if (selectedIndex === -1) return mergeClusters('지도 화면 안', clusters);
  if (selectedIndex === -2) return mergeClusters('주변 나머지', clusters.slice(3));

  return clusters[selectedIndex] ?? clusters[0];
}

function mergeClusters(label: string, clusters: MapReportCluster[]) {
  const reports = clusters.flatMap((cluster) => cluster.reports);
  const firstCluster = clusters[0];

  if (!firstCluster) return undefined;

  return {
    ...firstCluster,
    id: `merged-${label}`,
    label,
    count: reports.length,
    dominantCondition: getDominantCondition(reports),
    reports,
  };
}

function getDominantCondition(reports: MapReportCluster['reports']) {
  const counts = new Map<string, number>();

  reports.forEach((report) => {
    counts.set(report.condition, (counts.get(report.condition) ?? 0) + 1);
  });

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '현장 제보';
}
