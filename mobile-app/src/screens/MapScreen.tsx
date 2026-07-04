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
  const fieldSnapshot = useMemo(
    () => getMockFieldReportSnapshot(reports, searchContext),
    [reports, searchContext],
  );
  const orderedReports = fieldSnapshot.reports;
  const radiusLabel = formatRadius(searchContext.target);
  const visibleReports = orderedReports.slice(0, 3);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedReport = orderedReports[selectedIndex] ?? orderedReports[0];
  const nearbySectionTitle = getNearbySectionTitle(searchContext);

  return (
    <View>
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
          <Text style={styles.mapListAction}>제보</Text>
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
