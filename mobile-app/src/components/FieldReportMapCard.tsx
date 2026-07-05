import { Text, View } from 'react-native';

import { NativeMapLayer } from './NativeMapLayer';
import { styles } from '../styles/appStyles';
import type { LocalReport, SearchContext } from '../types/weather';

type FieldReportMapCardProps = {
  decisionSummary: string;
  radiusLabel: string;
  searchContext: SearchContext;
  selectedIndex: number;
  visibleReports: LocalReport[];
  onSelectReport: (index: number) => void;
};

export function FieldReportMapCard({
  decisionSummary,
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
        onSelectReport={onSelectReport}
      />

      <View pointerEvents="none" style={styles.mapCurrentLocation}>
        <View style={styles.mapCurrentDot} />
      </View>

      <View pointerEvents="box-none" style={styles.mapOverlay}>
        <View style={styles.mapOverlayTop}>
          <View style={styles.mapRadiusChip}>
            <Text style={styles.mapRadiusChipText}>{searchContext.place} 반경 {radiusLabel}</Text>
          </View>
          <Text numberOfLines={1} style={styles.mapOverlayCount}>{decisionSummary}</Text>
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
