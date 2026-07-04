import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { FieldReportList } from '../components/FieldReportList';
import { FieldReportMapCard } from '../components/FieldReportMapCard';
import { formatRadius } from '../domain/location';
import { getNearbySectionTitle } from '../domain/locationDisplay';
import { getMockFieldReportSnapshot } from '../services/fieldReports';
import { styles } from '../styles/appStyles';
import type { LocalReport, SearchContext } from '../types/weather';

type MapScreenProps = {
  reports: LocalReport[];
  searchContext: SearchContext;
  onReportIssue: (report: LocalReport) => void;
};

export function MapScreen({ reports, searchContext, onReportIssue }: MapScreenProps) {
  const [mapScope, setMapScope] = useState<'searched' | 'nearby'>(
    searchContext.target.kind === 'current' ? 'nearby' : 'searched',
  );
  const [mapFilter, setMapFilter] = useState<'all' | 'rain' | 'question'>('all');
  const fieldSnapshot = useMemo(
    () => getMockFieldReportSnapshot(reports, searchContext),
    [reports, searchContext],
  );
  const orderedReports = filterMapReports(fieldSnapshot.reports, mapFilter);
  const radiusLabel = formatRadius(searchContext.target);
  const visibleReports = orderedReports.slice(0, 5);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedReport = orderedReports[selectedIndex] ?? orderedReports[0];
  const nearbySectionTitle = getNearbySectionTitle(searchContext);

  return (
    <View>
      <View style={styles.mapControlCard}>
        <Text style={styles.mapControlTitle}>
          {mapScope === 'searched' ? `${searchContext.place} 주변 현장 날씨` : '내 주변 현장 날씨'}
        </Text>
        <Text style={styles.mapControlCaption}>
          제보 {fieldSnapshot.reports.length}개 · 최근 현장글 기준
        </Text>
        <View style={styles.mapControlRow}>
          <Pressable
            onPress={() => setMapScope('nearby')}
            style={[styles.mapControlChip, mapScope === 'nearby' && styles.mapControlChipActive]}
          >
            <Text style={[styles.mapControlChipText, mapScope === 'nearby' && styles.mapControlChipTextActive]}>
              내 주변
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMapScope('searched')}
            style={[styles.mapControlChip, mapScope === 'searched' && styles.mapControlChipActive]}
          >
            <Text style={[styles.mapControlChipText, mapScope === 'searched' && styles.mapControlChipTextActive]}>
              검색 지역
            </Text>
          </Pressable>
        </View>
        <View style={styles.mapControlRow}>
          {[
            ['all', '전체'],
            ['rain', '비'],
            ['question', '질문'],
          ].map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setMapFilter(key as 'all' | 'rain' | 'question')}
              style={[styles.mapFilterChip, mapFilter === key && styles.mapFilterChipActive]}
            >
              <Text style={[styles.mapFilterChipText, mapFilter === key && styles.mapFilterChipTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FieldReportMapCard
        radiusLabel={radiusLabel}
        searchContext={searchContext}
        selectedIndex={selectedIndex}
        visibleReports={visibleReports}
        onSelectReport={setSelectedIndex}
      />

      {selectedReport ? (
        <View style={styles.mapSelectedCard}>
          <View>
            <Text style={styles.mapSelectedKicker}>선택한 현장 글</Text>
            <Text style={styles.mapSelectedPlace}>{selectedReport.place}</Text>
            <Text style={styles.mapSelectedBody}>{selectedReport.body}</Text>
          </View>
          <View style={styles.mapSelectedSide}>
            <Text style={styles.mapSelectedCondition}>{selectedReport.condition}</Text>
            <Pressable
              disabled={selectedReport.moderationStatus === 'pending'}
              onPress={() => onReportIssue(selectedReport)}
              style={[
                styles.reportIssueButton,
                selectedReport.moderationStatus === 'pending' && styles.reportIssueButtonPending,
              ]}
            >
              <Text style={styles.reportIssueText}>
                {selectedReport.moderationStatus === 'pending' ? '검토중' : '신고'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <EmptyState
          title="지도에 표시할 현장 글이 없어요"
          body={`${nearbySectionTitle} 글이 생기면 지도 핀과 목록에 바로 표시됩니다.`}
          action="제보 탭에서 요청을 먼저 올려보세요"
        />
      )}

      {orderedReports.length > 0 && (
        <View style={styles.mapListHeader}>
          <Text style={styles.mapListTitle}>{nearbySectionTitle}</Text>
          <Text style={styles.mapListAction}>{mapFilter === 'all' ? '전체' : mapFilter === 'rain' ? '비 제보' : '질문'}</Text>
        </View>
      )}
      <FieldReportList
        reports={orderedReports}
        selectedIndex={selectedIndex}
        onSelectReport={setSelectedIndex}
        onReportIssue={onReportIssue}
      />
    </View>
  );
}

function filterMapReports(reports: LocalReport[], filter: 'all' | 'rain' | 'question') {
  if (filter === 'all') return reports;
  if (filter === 'rain') return reports.filter((report) => report.condition.includes('비') || report.body.includes('비'));

  return reports.filter((report) => report.body.includes('?') || report.body.includes('어때') || report.body.includes('궁금'));
}
