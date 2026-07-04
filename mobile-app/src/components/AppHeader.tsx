import { Pressable, Text, View } from 'react-native';

import { getCurrentLocationDisplay } from '../domain/locationDisplay';
import { styles } from '../styles/appStyles';
import type { LocationStatus } from '../types/appState';

type AppHeaderProps = {
  locationStatus: LocationStatus;
  onRefresh: () => void;
  refreshLabel: string;
};

export function AppHeader({ locationStatus, onRefresh, refreshLabel }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>웨더체크</Text>
        <Text style={styles.headerSub}>현재위치 · {getCurrentLocationDisplay(locationStatus)}</Text>
      </View>
      <Pressable
        accessibilityHint={refreshLabel}
        accessibilityLabel="현재 위치 기준으로 새로고침"
        accessibilityRole="button"
        onPress={onRefresh}
        style={styles.refreshButton}
      >
        <Text style={styles.refreshText}>↻</Text>
      </Pressable>
    </View>
  );
}
