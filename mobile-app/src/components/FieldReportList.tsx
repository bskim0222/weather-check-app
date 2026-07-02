import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { LocalReport } from '../types/weather';

type FieldReportListProps = {
  reports: LocalReport[];
  selectedIndex: number;
  onSelectReport: (index: number) => void;
  onReportIssue: (report: LocalReport) => void;
};

export function FieldReportList({ reports, selectedIndex, onSelectReport, onReportIssue }: FieldReportListProps) {
  if (reports.length === 0) return null;

  return (
    <View style={styles.reportList}>
      {reports.map((report, index) => (
        <Pressable
          key={`${report.body}-${index}`}
          accessibilityLabel={`${report.place} 현장 글 선택`}
          accessibilityRole="button"
          onPress={() => onSelectReport(index)}
          style={[styles.mapReportItem, selectedIndex === index && styles.mapReportItemActive]}
        >
          <View style={styles.mapReportContent}>
            <Text style={styles.reportMeta}>{report.time} · {report.place}</Text>
            <Text style={styles.reportBody}>{report.body}</Text>
          </View>
          <View style={styles.reportSide}>
            <Text style={styles.reportCondition}>{report.condition}</Text>
            <Pressable
              disabled={report.moderationStatus === 'pending'}
              onPress={() => onReportIssue(report)}
              style={[
                styles.reportIssueButton,
                report.moderationStatus === 'pending' && styles.reportIssueButtonPending,
              ]}
            >
              <Text style={styles.reportIssueText}>
                {report.moderationStatus === 'pending' ? '검토중' : '신고'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
