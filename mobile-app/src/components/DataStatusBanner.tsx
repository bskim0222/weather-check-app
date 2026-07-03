import { Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { DataStatus } from '../types/appState';

type DataStatusBannerProps = {
  status: DataStatus;
};

export function DataStatusBanner({ status }: DataStatusBannerProps) {
  const isHidden = status.phase === 'ready' || status.phase === 'mock';

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
        <Text style={[styles.dataStatusLabel, isWarning && styles.dataStatusLabelWarning]}>{status.label}</Text>
        <Text style={[styles.dataStatusMessage, isWarning && styles.dataStatusMessageWarning]}>{status.message}</Text>
      </View>
    </View>
  );
}
