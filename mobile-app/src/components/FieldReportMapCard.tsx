import { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';

import { NativeMapLayer } from './NativeMapLayer';
import { styles } from '../styles/appStyles';
import type { LocalReport, MapReportCluster, SearchContext, WeatherPreset } from '../types/weather';

type FieldReportMapCardProps = {
  current: WeatherPreset;
  searchContext: SearchContext;
  selectedCluster?: MapReportCluster;
  selectedIndex: number;
  visibleClusters: MapReportCluster[];
  onCloseCluster: () => void;
  onReportIssue: (report: LocalReport) => void;
  onSelectCluster: (index: number) => void;
  onUseCurrentLocation: () => void;
};

export function FieldReportMapCard({
  current,
  searchContext,
  selectedCluster,
  selectedIndex,
  visibleClusters,
  onCloseCluster,
  onReportIssue,
  onSelectCluster,
  onUseCurrentLocation,
}: FieldReportMapCardProps) {
  const sheetProgress = useRef(new Animated.Value(selectedCluster ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(sheetProgress, {
      toValue: selectedCluster ? 1 : 0,
      damping: 18,
      mass: 0.9,
      stiffness: 180,
      useNativeDriver: true,
    }).start();
  }, [selectedCluster, sheetProgress]);

  const sheetStyle = {
    opacity: sheetProgress,
    transform: [
      {
        translateY: sheetProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [240, 0],
        }),
      },
    ],
  };

  return (
    <View style={styles.mapCard}>
      <NativeMapLayer
        searchContext={searchContext}
        selectedIndex={selectedIndex}
        visibleClusters={visibleClusters}
        onSelectCluster={onSelectCluster}
      />

      <View pointerEvents="none" style={styles.mapTopHud}>
        <Text numberOfLines={1} style={styles.mapTopHudTitle}>
          {searchContext.place} 주변 현장
        </Text>
        <Text numberOfLines={1} style={styles.mapTopHudMeta}>
          {current.condition} · {current.temp}°C · 제보 묶음 {visibleClusters.length}곳
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="현재 위치로 이동"
        onPress={onUseCurrentLocation}
        style={styles.mapCurrentButton}
      >
        <Text style={styles.mapCurrentButtonText}>⌖</Text>
      </Pressable>

      <Animated.View
        pointerEvents={selectedCluster ? 'auto' : 'none'}
        style={[styles.mapBottomSheet, sheetStyle]}
      >
        {selectedCluster && (
          <>
            <View style={styles.mapSheetHandle} />
            <View style={styles.mapSheetHeader}>
              <View style={styles.mapSheetHeaderText}>
                <Text style={styles.mapSheetKicker}>{selectedCluster.privacyRadiusLabel}</Text>
                <Text numberOfLines={1} style={styles.mapSheetTitle}>
                  {selectedCluster.label}
                </Text>
              </View>
              <Pressable accessibilityRole="button" onPress={onCloseCluster} style={styles.mapSheetCloseButton}>
                <Text style={styles.mapSheetCloseText}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.mapSheetSummary}>
              {selectedCluster.dominantCondition} 제보 {selectedCluster.count}개가 이 근처에 모여 있어요.
            </Text>
            <ScrollView style={styles.mapSheetList} showsVerticalScrollIndicator={false}>
              {selectedCluster.reports.map((report, index) => (
                <View key={`${report.id ?? report.body}-${index}`} style={styles.mapSheetReportItem}>
                  <View style={styles.mapSheetReportMain}>
                    <Text numberOfLines={1} style={styles.mapSheetReportMeta}>
                      {report.time} · {report.place}
                    </Text>
                    <Text numberOfLines={2} style={styles.mapSheetReportBody}>
                      {report.body}
                    </Text>
                  </View>
                  <View style={styles.mapSheetReportSide}>
                    <Text style={styles.mapSheetReportCondition}>{report.condition}</Text>
                    <Pressable
                      disabled={report.moderationStatus === 'pending'}
                      onPress={() => onReportIssue(report)}
                      style={[
                        styles.mapSheetIssueButton,
                        report.moderationStatus === 'pending' && styles.reportIssueButtonPending,
                      ]}
                    >
                      <Text style={styles.mapSheetIssueText}>
                        {report.moderationStatus === 'pending' ? '검토중' : '신고'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </Animated.View>
    </View>
  );
}
