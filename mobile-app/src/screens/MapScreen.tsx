import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { FieldReportList } from '../components/FieldReportList';
import { FieldReportMapCard } from '../components/FieldReportMapCard';
import { formatRadius } from '../domain/location';
import { getNearbySectionTitle } from '../domain/locationDisplay';
import { getMockFieldReportSnapshot } from '../services/fieldReports';
import { styles } from '../styles/appStyles';
import type { LocalReport, SearchContext, WeatherPreset } from '../types/weather';

type MapScreenProps = {
  current: WeatherPreset;
  reports: LocalReport[];
  searchContext: SearchContext;
  onReportIssue: (report: LocalReport) => void;
};

export function MapScreen({ current, reports, searchContext, onReportIssue }: MapScreenProps) {
  const fieldSnapshot = useMemo(
    () => getMockFieldReportSnapshot(reports, searchContext),
    [reports, searchContext],
  );
  const orderedReports = fieldSnapshot.reports;
  const radiusLabel = formatRadius(searchContext.target);
  const visibleReports = orderedReports.slice(0, 5);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedReport = orderedReports[selectedIndex] ?? orderedReports[0];
  const nearbySectionTitle = getNearbySectionTitle(searchContext);

  return (
    <View>
      <View style={styles.mapControlCard}>
        <View style={styles.mapControlHeader}>
          <Text numberOfLines={1} style={styles.mapControlTitle}>
            {searchContext.place} 주변 현장 날씨
          </Text>
          <View style={styles.mapDecisionPill}>
            <Text numberOfLines={1} style={styles.mapDecisionPillText}>
              {getMapDecisionLabel(current.condition)} · {current.temp}°C
            </Text>
          </View>
        </View>
        <Text style={styles.mapControlCaption}>
          지도 위에서 최근 현장 글 {fieldSnapshot.reports.length}개를 확인해요.
        </Text>
      </View>

      <FieldReportMapCard
        decisionSummary={`${getMapDecisionLabel(current.condition)} · ${current.temp}°C`}
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
          body={`${nearbySectionTitle} 글이 생기면 지도와 목록에 바로 표시합니다.`}
          action="제보 탭에서 먼저 요청을 올려보세요."
        />
      )}

      {orderedReports.length > 0 && (
        <View style={styles.mapListHeader}>
          <Text style={styles.mapListTitle}>{nearbySectionTitle}</Text>
          <Text style={styles.mapListAction}>전체</Text>
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

function getMapDecisionLabel(condition: string) {
  if (condition.includes('소나기')) return '소나기';
  if (condition.includes('천둥') || condition.includes('번개')) return '천둥';
  if (condition.includes('무지개')) return '무지개';
  if (condition.includes('밤')) return '밤맑음';
  if (condition.includes('비')) return '비 우세';
  if (condition.includes('눈')) return '눈';
  if (condition.includes('안개')) return '안개';
  if (condition.includes('황사') || condition.includes('미세먼지')) return '황사';
  if (condition.includes('폭염')) return '폭염';
  if (condition.includes('태풍')) return '태풍';
  if (condition.includes('맑')) return '맑음';
  if (condition.includes('흐림') || condition.includes('구름')) return '흐림';

  return condition;
}
