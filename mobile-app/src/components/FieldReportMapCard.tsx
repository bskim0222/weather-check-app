import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { NativeMapLayer } from './NativeMapLayer';
import type { MapCoordinate } from '../domain/mapClustering';
import { formatPostTime } from '../domain/timeDisplay';
import { searchRemotePlaces, type PlaceCandidate } from '../services/geocoding';
import { styles } from '../styles/appStyles';
import type { LocalReport, LocationReference, MapReportCluster, SearchContext } from '../types/weather';

type FieldReportMapCardProps = {
  questionText: string;
  currentLocation?: MapCoordinate;
  currentLocationLabel: string;
  searchContext: SearchContext;
  selectedCluster?: MapReportCluster;
  selectedIndex: number;
  visibleClusters: MapReportCluster[];
  onCloseCluster: () => void;
  onClusterGridChange: (gridDegrees: number) => void;
  onReportIssue: (report: LocalReport) => void;
  onSearchLocation: (query?: string, location?: LocationReference) => void;
  onSelectCluster: (index: number) => void;
  onUseCurrentLocation: () => void;
};

export function FieldReportMapCard({
  questionText,
  currentLocation,
  currentLocationLabel,
  searchContext,
  selectedCluster,
  selectedIndex,
  visibleClusters,
  onCloseCluster,
  onClusterGridChange,
  onReportIssue,
  onSearchLocation,
  onSelectCluster,
  onUseCurrentLocation,
}: FieldReportMapCardProps) {
  const sheetProgress = useRef(new Animated.Value(selectedCluster ? 1 : 0)).current;
  const [mapQuery, setMapQuery] = useState(questionText);
  const [placeCandidates, setPlaceCandidates] = useState<PlaceCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    Animated.spring(sheetProgress, {
      toValue: selectedCluster ? 1 : 0,
      damping: 18,
      mass: 0.9,
      stiffness: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [selectedCluster, sheetProgress]);

  useEffect(() => {
    setMapQuery(questionText);
  }, [questionText]);

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
        currentLocation={currentLocation}
        currentLocationLabel={currentLocationLabel}
        onClusterGridChange={onClusterGridChange}
        searchContext={searchContext}
        selectedIndex={selectedIndex}
        visibleClusters={visibleClusters}
        onSelectCluster={onSelectCluster}
      />

      <View style={styles.mapSearchOverlay}>
        <View style={styles.mapSearchBox}>
          <Ionicons color="rgba(36,36,36,0.58)" name="search" size={24} style={styles.mapSearchIcon} />
          <TextInput
            value={mapQuery}
            onChangeText={(nextValue) => {
              setPlaceCandidates([]);
              setMapQuery(nextValue);
            }}
            onSubmitEditing={() => submitMapSearch(mapQuery)}
            placeholder="예: 광안리, 청와대, 설악산"
            placeholderTextColor="rgba(36,36,36,0.38)"
            returnKeyType="search"
            selectTextOnFocus
            style={styles.mapSearchInput}
          />
          <Pressable
            accessibilityLabel="지도에서 장소 검색"
            accessibilityRole="button"
            disabled={isSearching}
            onPress={() => submitMapSearch(mapQuery)}
            style={[styles.mapSearchSubmit, isSearching && styles.searchSubmitDisabled]}
          >
            <Text style={styles.mapSearchSubmitText}>{isSearching ? '…' : '↗'}</Text>
          </Pressable>
        </View>
        {placeCandidates.length > 0 ? (
          <View style={styles.mapPlaceCandidatePanel}>
            {placeCandidates.map((candidate) => (
              <Pressable
                key={`${candidate.location.id}-${candidate.location.latitude}-${candidate.location.longitude}`}
                accessibilityRole="button"
                onPress={() => submitMapCandidate(candidate)}
                style={styles.mapPlaceCandidateRow}
              >
                <View style={styles.mapPlaceCandidateText}>
                  <Text numberOfLines={1} style={styles.mapPlaceCandidateName}>
                    {candidate.location.label}
                  </Text>
                  {candidate.subtitle ? (
                    <Text numberOfLines={1} style={styles.mapPlaceCandidateSubtitle}>
                      {candidate.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.mapPlaceCandidateAction}>이동</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="현재 위치로 이동"
        onPress={onUseCurrentLocation}
        style={styles.mapCurrentButton}
      >
        <Ionicons color="#ffffff" name="locate" size={21} />
        <Text style={styles.mapCurrentButtonLabel}>내 위치</Text>
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
                      {formatPostTime(report.createdAt)} · {report.place}
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
                        {report.moderationStatus === 'pending' ? '신고됨' : '신고'}
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

  async function submitMapSearch(value: string) {
    const clean = value.trim();
    if (!clean) return;

    setIsSearching(true);
    const candidates = await searchRemotePlaces(clean, clean);
    setIsSearching(false);

    if (candidates.length === 1) {
      setPlaceCandidates([]);
      onSearchLocation(clean, candidates[0].location);
      return;
    }

    if (candidates.length > 1) {
      setPlaceCandidates(candidates.slice(0, 5));
      return;
    }

    setPlaceCandidates([]);
    onSearchLocation(clean);
  }

  function submitMapCandidate(candidate: PlaceCandidate) {
    const query = candidate.location.label;

    setMapQuery(query);
    setPlaceCandidates([]);
    onSearchLocation(query, candidate.location);
  }
}
