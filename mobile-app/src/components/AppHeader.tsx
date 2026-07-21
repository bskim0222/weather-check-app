import Ionicons from '@expo/vector-icons/Ionicons';
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
      <View style={styles.headerLocationBlock}>
        <Text style={styles.headerLocationLabel}>현재위치</Text>
        <Text numberOfLines={1} style={styles.headerLocationName}>
          {getCurrentLocationDisplay(locationStatus)}
        </Text>
      </View>
      <Pressable
        accessibilityHint={refreshLabel}
        accessibilityLabel="현재 위치 기준으로 새로고침"
        accessibilityRole="button"
        onPress={onRefresh}
        style={styles.refreshButton}
      >
        <Ionicons color="#2f7894" name="refresh" size={22} />
        <Text style={styles.refreshButtonLabel}>새로고침</Text>
      </Pressable>
    </View>
  );
}
