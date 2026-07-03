import { Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { LocalReport, SearchContext } from '../types/weather';

type NativeMapLayerProps = {
  searchContext: SearchContext;
  selectedIndex: number;
  visibleReports: LocalReport[];
};

export function NativeMapLayer({ searchContext }: NativeMapLayerProps) {
  return (
    <View style={styles.mapNativeFallback}>
      <View style={styles.mapNativeBlockOne} />
      <View style={styles.mapNativeBlockTwo} />
      <View style={styles.mapNativeBlockThree} />
      <View style={styles.mapNativeLaneOne} />
      <View style={styles.mapNativeLaneTwo} />
      <View style={styles.mapNativeLaneThree} />
      <View style={styles.mapNativeWater} />
      <Text style={styles.mapNativeFallbackText}>{searchContext.place} 주변 현장 지도</Text>
    </View>
  );
}
