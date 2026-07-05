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
  { top: '39%', left: '45%', tone: '#f4f5f2' },
  { top: '51%', left: '20%', tone: '#b8cbd6' },
  { top: '25%', left: '69%', tone: '#d6c8c0' },
  { top: '62%', left: '72%', tone: '#74c9ee' },
  { top: '31%', left: '28%', tone: '#fff05a' },
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
      <View pointerEvents="none" style={styles.mapScrim} />
      <View pointerEvents="none" style={styles.mapGlowZoneOne} />
      <View pointerEvents="none" style={styles.mapGlowZoneTwo} />
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
            <Text style={styles.mapReportMarkerText}>{getMarkerCount(index, report)}</Text>
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
        <Text style={styles.mapTitle}>주변 제보는 {dominantCondition} 쪽이에요</Text>
        <Text style={styles.mapCaption}>
          손가락으로 지도를 움직이고 확대해 주변 제보와 질문 위치를 확인합니다.
        </Text>
      </View>
    </View>
  );
}

function getMarkerCount(index: number, report?: LocalReport) {
  if (!report) return '0';

  const counts = ['24', '8', '3'];

  return counts[index] ?? '1';
}
