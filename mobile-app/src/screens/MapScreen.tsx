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
  questionText: string;
  onUseCurrentLocation: () => void;
  onSearchLocation: (query?: string, location?: SearchContext['target']) => void;
  onReportIssue: (report: LocalReport) => void;
};

export function MapScreen({
  current,
  reports,
  searchContext,
  questionText,
  onUseCurrentLocation,
  onSearchLocation,
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
        questionText={questionText}
        onSearchLocation={onSearchLocation}
        onSelectCluster={setSelectedIndex}
        onUseCurrentLocation={onUseCurrentLocation}
      />
    </View>
  );
}

function getMapReportsForContext(reports: LocalReport[], searchContext: SearchContext) {
  const contextPlaces = [
    searchContext.place,
    searchContext.target.label,
    searchContext.locationQuery ?? '',
  ].filter(Boolean);

  return visibleReportsOnly(reports)
    .filter((report) => report.source !== 'mock')
    .filter((report) => contextPlaces.some((contextPlace) => isRelatedPlace(report.place, contextPlace)));
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
    label: `${label} 주변`,
    count: group.length,
    dominantCondition: getDominantCondition(group),
    privacyRadiusLabel: '약 1.5km 묶음',
    reports: group,
  }));
}

function normalizeClusterLabel(place: string) {
  const clean = normalizePlaceText(place);
  if (!clean) return '현재 위치';

  const parts = clean.split(/\s+/).filter(Boolean);
  const neighborhood = parts.find((part) => /(동|읍|면|리|가)$/.test(part));
  if (neighborhood) return neighborhood.replace(/[0-9-]/g, '');

  const district = parts.find((part) => /(구|군|시)$/.test(part) && !isBroadPlaceToken(part));
  if (district) return district;

  return parts.at(-1) ?? clean;
}

function isRelatedPlace(reportPlace: string, contextPlace: string) {
  const reportTokens = tokenizePlace(reportPlace);
  const contextTokens = tokenizePlace(contextPlace);

  if (reportTokens.length === 0 || contextTokens.length === 0) return false;

  return contextTokens.some((token) => {
    if (isBroadPlaceToken(token)) return false;

    return reportTokens.some((reportToken) => {
      if (isBroadPlaceToken(reportToken)) return false;
      return reportToken.includes(token) || token.includes(reportToken);
    });
  });
}

function tokenizePlace(place: string) {
  return normalizePlaceText(place)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !/^\d+$/.test(token));
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

function isBroadPlaceToken(token: string) {
  return [
    '서울',
    '서울시',
    '서울특별시',
    '부산',
    '부산시',
    '부산광역시',
    '대구',
    '대구시',
    '인천',
    '인천시',
    '광주',
    '광주시',
    '대전',
    '대전시',
    '울산',
    '울산시',
    '세종',
    '세종시',
    '경기',
    '경기도',
    '강원',
    '강원도',
    '충북',
    '충청북도',
    '충남',
    '충청남도',
    '전북',
    '전라북도',
    '전남',
    '전라남도',
    '경북',
    '경상북도',
    '경남',
    '경상남도',
    '제주',
    '제주도',
    '제주특별자치도',
  ].includes(token);
}

function getDominantCondition(reports: LocalReport[]) {
  const counts = new Map<string, number>();

  reports.forEach((report) => {
    counts.set(report.condition, (counts.get(report.condition) ?? 0) + 1);
  });

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '현장 제보';
}
