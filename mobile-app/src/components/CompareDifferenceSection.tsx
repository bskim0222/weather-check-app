import { Text, View } from 'react-native';

import { ProviderServiceIcon } from './ProviderServiceIcon';
import { styles } from '../styles/appStyles';
import type { CompareDifference } from '../types/weather';

type CompareDifferenceSectionProps = {
  differences: CompareDifference[];
  focusText: string;
  weather: string;
};

export function CompareDifferenceSection({
  differences,
  focusText,
  weather,
}: CompareDifferenceSectionProps) {
  return (
    <>
      <View style={styles.reportSectionHeader}>
        <Text style={styles.reportSectionTitle}>서비스별 차이</Text>
        <Text style={styles.reportSectionAction}>{weather} 기준</Text>
      </View>

      <View style={styles.compareInsightCard}>
        <Text style={styles.compareInsightLabel}>이번 비교 포인트</Text>
        <Text style={styles.compareInsightText}>{focusText}</Text>
      </View>

      <View style={styles.compareDifferenceList}>
        {differences.map((item) => (
          <View key={item.name} style={styles.compareDifferenceItem}>
            <ProviderServiceIcon mark={item.mark} name={item.name} style={styles.compareDifferenceLogo} />
            <View style={styles.compareDifferenceContent}>
              <Text style={styles.compareDifferenceName}>{item.name}</Text>
              <Text style={styles.compareDifferenceBody}>{item.body}</Text>
            </View>
            <Text style={styles.compareDifferenceBadge}>{item.badge}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
