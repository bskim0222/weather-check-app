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
      <Text style={styles.mapNativeFallbackText}>
        {searchContext.place} 주변 현장 제보 지도
      </Text>
    </View>
  );
}
