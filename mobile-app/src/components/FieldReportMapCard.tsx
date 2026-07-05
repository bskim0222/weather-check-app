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
  const visibleMapClusters = visibleClusters.slice(0, mapClusterPositions.length);

  return (
    <View style={styles.mapCard}>
      <NativeMapLayer searchContext={searchContext} />

      {visibleMapClusters.map((cluster, index) => {
        const position = mapClusterPositions[index];
        const isActive = index === selectedIndex;
        const isDark = isDarkCluster(cluster);

        return (
          <Pressable
            key={cluster.id}
            accessibilityRole="button"
            accessibilityLabel={`${cluster.label} 현장 글 ${cluster.count}개 보기`}
            onPress={() => onSelectCluster(index)}
            style={[
              styles.mapClusterBubble,
              position,
              { backgroundColor: getClusterTone(cluster) },
              isActive && styles.mapClusterBubbleActive,
            ]}
          >
            <Text style={[styles.mapClusterBubbleText, isDark && styles.mapClusterBubbleTextDark]}>
              {cluster.count}
            </Text>
          </Pressable>
        );
      })}

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

const mapClusterPositions = [
  { top: '23%', left: '18%' },
  { top: '39%', right: '16%' },
  { top: '58%', left: '30%' },
  { top: '66%', right: '26%' },
  { top: '47%', left: '10%' },
  { top: '27%', right: '34%' },
] as const;

function getClusterTone(cluster: MapReportCluster) {
  const condition = cluster.dominantCondition;

  if (condition.includes('비') || condition.includes('소나기')) return 'rgba(47, 134, 217, 0.76)';
  if (condition.includes('눈')) return 'rgba(216, 239, 248, 0.82)';
  if (condition.includes('천둥') || condition.includes('번개')) return 'rgba(48, 43, 63, 0.78)';
  if (condition.includes('안개')) return 'rgba(216, 208, 193, 0.80)';
  if (condition.includes('황사') || condition.includes('미세')) return 'rgba(215, 189, 122, 0.82)';
  if (condition.includes('맑')) return 'rgba(255, 240, 90, 0.80)';
  if (condition.includes('흐') || condition.includes('구름')) return 'rgba(191, 201, 189, 0.82)';

  return 'rgba(36, 36, 36, 0.72)';
}

function isDarkCluster(cluster: MapReportCluster) {
  const condition = cluster.dominantCondition;
  return (
    condition.includes('비')
    || condition.includes('소나기')
    || condition.includes('천둥')
    || condition.includes('번개')
  );
}
