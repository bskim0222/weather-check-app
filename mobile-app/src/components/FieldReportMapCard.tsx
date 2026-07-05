import { Pressable, Text, View } from 'react-native';

import { NativeMapLayer } from './NativeMapLayer';
import { styles } from '../styles/appStyles';
import type { LocalReport, SearchContext } from '../types/weather';

type FieldReportMapCardProps = {
  radiusLabel: string;
  searchContext: SearchContext;
  selectedIndex: number;
  visibleReports: LocalReport[];
  onSelectReport: (index: number) => void;
};

const markerPositions = [
  { top: '42%', left: '48%', tone: '#242424' },
  { top: '54%', left: '22%', tone: '#74c9ee' },
  { top: '27%', left: '70%', tone: '#fff05a' },
  { top: '66%', left: '72%', tone: '#f1b2aa' },
  { top: '32%', left: '29%', tone: '#c8e8f8' },
] as const;

export function FieldReportMapCard({
  radiusLabel,
  searchContext,
  selectedIndex,
  visibleReports,
  onSelectReport,
}: FieldReportMapCardProps) {
  const selectedReport = visibleReports[selectedIndex] ?? visibleReports[0];
  const dominantCondition = selectedReport?.condition ?? searchContext.detectedWeather;

  return (
    <View style={styles.mapCard}>
      <NativeMapLayer
        searchContext={searchContext}
        selectedIndex={selectedIndex}
        visibleReports={visibleReports}
      />

      {visibleReports.map((report, index) => {
        const marker = markerPositions[index] ?? markerPositions[0];
        const isActive = selectedIndex === index;

        return (
          <Pressable
            key={`${report.place}-${index}`}
            accessibilityLabel={`${report.place} 현장 글 보기`}
            accessibilityRole="button"
            onPress={() => onSelectReport(index)}
            style={[
              styles.mapReportMarker,
              isActive && styles.mapReportMarkerActive,
              { top: marker.top, left: marker.left, backgroundColor: marker.tone },
            ]}
          >
            <Text style={[styles.mapReportMarkerText, marker.tone === '#242424' && styles.mapReportMarkerTextDark]}>
              {getMarkerLabel(report)}
            </Text>
          </Pressable>
        );
      })}

      <View pointerEvents="none" style={styles.mapCurrentLocation}>
        <View style={styles.mapCurrentDot} />
      </View>

      <View pointerEvents="box-none" style={styles.mapOverlay}>
        <View style={styles.mapOverlayTop}>
          <View style={styles.mapRadiusChip}>
            <Text style={styles.mapRadiusChipText}>{searchContext.place} 반경 {radiusLabel}</Text>
          </View>
          <Text style={styles.mapOverlayCount}>{visibleReports.length}곳</Text>
        </View>
        <Text numberOfLines={1} style={styles.mapTitle}>주변 제보는 {dominantCondition} 쪽이에요</Text>
        {!!selectedReport && (
          <Text numberOfLines={2} style={styles.mapCaption}>
            {selectedReport.place} · {selectedReport.body}
          </Text>
        )}
      </View>
    </View>
  );
}

function getMarkerLabel(report?: LocalReport) {
  const condition = report?.condition ?? '';

  if (condition.includes('천둥') || condition.includes('번개')) return '번';
  if (condition.includes('소나기')) return '소';
  if (condition.includes('비')) return '비';
  if (condition.includes('눈')) return '눈';
  if (condition.includes('안개')) return '안';
  if (condition.includes('맑')) return '맑';
  if (condition.includes('흐') || condition.includes('구름')) return '흐';

  return '현';
}
