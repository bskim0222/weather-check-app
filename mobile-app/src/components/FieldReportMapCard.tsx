import { View } from 'react-native';

import { NativeMapLayer } from './NativeMapLayer';
import { styles } from '../styles/appStyles';
import type { MapReportCluster, SearchContext } from '../types/weather';

type FieldReportMapCardProps = {
  searchContext: SearchContext;
  selectedIndex: number;
  visibleClusters: MapReportCluster[];
  onSelectCluster: (index: number) => void;
};

export function FieldReportMapCard({
  searchContext,
  selectedIndex,
  visibleClusters,
  onSelectCluster,
}: FieldReportMapCardProps) {
  return (
    <View style={styles.mapCard}>
      <NativeMapLayer
        searchContext={searchContext}
        selectedIndex={selectedIndex}
        visibleClusters={visibleClusters}
        onSelectCluster={onSelectCluster}
      />
    </View>
  );
}
