import { Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { DataStatus } from '../types/appState';

type DataStatusBannerProps = {
  status: DataStatus;
};

export function DataStatusBanner({ status }: DataStatusBannerProps) {
  const isHidden = status.phase === 'ready';

  if (isHidden) return null;

  const isLoading = status.phase === 'loading';
  const isWarning = status.phase === 'fallback' || status.phase === 'error';

  return (
    <View
      style={[
        styles.dataStatusBanner,
        isLoading && styles.dataStatusBannerLoading,
        isWarning && styles.dataStatusBannerWarning,
      ]}
    >
      <View style={[styles.dataStatusDot, isLoading && styles.dataStatusDotLoading]} />
      <View style={styles.dataStatusContent}>
        <Text style={styles.dataStatusLabel}>{status.label}</Text>
        <Text style={styles.dataStatusMessage}>{status.message}</Text>
      </View>
    </View>
  );
}
