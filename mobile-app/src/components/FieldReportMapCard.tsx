import { Pressable, Text, View } from 'react-native';

import { NativeMapLayer } from './NativeMapLayer';
import { styles } from '../styles/appStyles';
import type { MapReportCluster, SearchContext } from '../types/weather';

type FieldReportMapCardProps = {
  searchContext: SearchContext;
  selectedIndex: number;
  visibleClusters: MapReportCluster[];
  onSelectCluster: (index: number) => void;
  onUseCurrentLocation: () => void;
};

export function FieldReportMapCard({
  searchContext,
  selectedIndex,
  visibleClusters,
  onSelectCluster,
  onUseCurrentLocation,
}: FieldReportMapCardProps) {
  return (
    <View style={styles.mapCard}>
      <NativeMapLayer
        searchContext={searchContext}
        selectedIndex={selectedIndex}
        visibleClusters={visibleClusters}
        onSelectCluster={onSelectCluster}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="현재 위치로 이동"
        onPress={onUseCurrentLocation}
        style={styles.mapCurrentButton}
      >
        <Text style={styles.mapCurrentButtonText}>◎</Text>
      </Pressable>
    </View>
  );
}
