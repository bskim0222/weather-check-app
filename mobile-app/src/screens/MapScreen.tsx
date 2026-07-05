import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { FieldReportList } from '../components/FieldReportList';
import { FieldReportMapCard } from '../components/FieldReportMapCard';
import { formatRadius } from '../domain/location';
import { getNearbySectionTitle } from '../domain/locationDisplay';
import { getMockFieldReportSnapshot } from '../services/fieldReports';
import { styles } from '../styles/appStyles';
import type { LocalReport, MapReportCluster, SearchContext, WeatherPreset } from '../types/weather';

type MapScreenProps = {
  current: WeatherPreset;
  reports: LocalReport[];
  searchContext: SearchContext;
  onMapGestureChange: (isInteracting: boolean) => void;
  onReportIssue: (report: LocalReport) => void;
};

export function MapScreen({
  current,
  reports,
  searchContext,
  onMapGestureChange,
  onReportIssue,
}: MapScreenProps) {
  const fieldSnapshot = useMemo(
    () => getMockFieldReportSnapshot(reports, searchContext),
    [reports, searchContext],
  );
  const orderedReports = fieldSnapshot.reports;
  const radiusLabel = formatRadius(searchContext.target);
  const visibleClusters = useMemo(
    () => createMapReportClusters(orderedReports, searchContext.place),
    [orderedReports, searchContext.place],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedCluster = resolveSelectedCluster(visibleClusters, selectedIndex);
  const clusterReports = selectedCluster?.reports ?? [];
  const nearbySectionTitle = getNearbySectionTitle(searchContext);

  return (
    <View>
      <View style={styles.mapControlCard}>
        <View style={styles.mapControlHeader}>
          <Text numberOfLines={1} style={styles.mapControlTitle}>
            {searchContext.place} 주변 현장 날씨
          </Text>
          <View style={styles.mapDecisionPill}>
            <Text numberOfLines={1} style={styles.mapDecisionPillText}>
              {getMapDecisionLabel(current.condition)} · {current.temp}°C
            </Text>
          </View>
        </View>
        <Text style={styles.mapControlCaption}>
          정확한 위치 대신 약 700m 생활권 단위로 묶어 보여줘요.
        </Text>
      </View>

      <FieldReportMapCard
        decisionSummary={`${getMapDecisionLabel(current.condition)} · ${current.temp}°C`}
        radiusLabel={radiusLabel}
        searchContext={searchContext}
        selectedIndex={selectedIndex}
        visibleClusters={visibleClusters}
        onSelectCluster={setSelectedIndex}
        onMapGestureChange={onMapGestureChange}
      />

      {selectedCluster ? (
        <View style={styles.mapSelectedCard}>
          <View>
            <Text style={styles.mapSelectedKicker}>
              위치 보호 묶음 · {selectedCluster.privacyRadiusLabel}
            </Text>
            <Text style={styles.mapSelectedPlace}>{selectedCluster.label}</Text>
            <Text style={styles.mapSelectedBody}>
              포함된 현장 글 {selectedCluster.count}개 · 정확한 위치는 공개하지 않아요
            </Text>
          </View>
          <View style={styles.mapSelectedSide}>
            <Text style={styles.mapSelectedCondition}>{selectedCluster.dominantCondition}</Text>
          </View>
        </View>
      ) : (
        <EmptyState
          title="지도에 표시할 현장 글이 없어요"
          body={`${nearbySectionTitle} 글이 생기면 지도와 목록에 바로 표시합니다.`}
          action="제보 탭에서 먼저 요청을 올려보세요."
        />
      )}

      {orderedReports.length > 0 && (
        <View style={styles.mapListHeader}>
          <Text style={styles.mapListTitle}>{selectedCluster?.label ?? nearbySectionTitle}</Text>
          <Text style={styles.mapListAction}>{clusterReports.length}개</Text>
        </View>
      )}
      <FieldReportList
        reports={clusterReports}
        selectedIndex={0}
        onSelectReport={() => undefined}
        onReportIssue={onReportIssue}
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
    label: `${label} 일대`,
    count: group.length,
    dominantCondition: getDominantCondition(group),
    privacyRadiusLabel: '약 700m 묶음',
    reports: group,
  }));
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

function normalizeClusterLabel(place: string) {
  const clean = place.trim();
  if (!clean) return '이 주변';

  const parts = clean.split(/\s+/).filter(Boolean);
  const dong = parts.find((part) => /동$|읍$|면$|리$/.test(part));
  if (dong) return dong;

  return parts.at(-1) ?? clean;
}

function getDominantCondition(reports: LocalReport[]) {
  const counts = new Map<string, number>();

  reports.forEach((report) => {
    counts.set(report.condition, (counts.get(report.condition) ?? 0) + 1);
  });

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '현장 제보';
}

function getMapDecisionLabel(condition: string) {
  if (condition.includes('소나기')) return '소나기';
  if (condition.includes('천둥') || condition.includes('번개')) return '천둥';
  if (condition.includes('무지개')) return '무지개';
  if (condition.includes('밤')) return '밤맑음';
  if (condition.includes('비')) return '비 우세';
  if (condition.includes('눈')) return '눈';
  if (condition.includes('안개')) return '안개';
  if (condition.includes('황사') || condition.includes('미세먼지')) return '황사';
  if (condition.includes('폭염')) return '폭염';
  if (condition.includes('태풍')) return '태풍';
  if (condition.includes('맑')) return '맑음';
  if (condition.includes('흐림') || condition.includes('구름')) return '흐림';

  return condition;
}
