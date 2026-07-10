import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { DecisionCard } from '../components/DecisionCard';
import { EmptyState } from '../components/EmptyState';
import { getFieldReportPlaceDisplay, getNearbySectionTitle } from '../domain/locationDisplay';
import type { WeatherProviderSnapshot } from '../services/weatherProviders';
import { styles } from '../styles/appStyles';
import type { DataStatus, LocationStatus } from '../types/appState';
import type {
  LocalReport,
  SearchContext,
  WeatherKey,
  WeatherPreset,
} from '../types/weather';

type DecisionScreenProps = {
  current: WeatherPreset;
  dataStatus: DataStatus;
  lastUpdatedAt: Date | null;
  locationStatus: LocationStatus;
  providerSnapshot: WeatherProviderSnapshot;
  reportCondition: string;
  reportText: string;
  reports: LocalReport[];
  searchContext: SearchContext;
  onReportConditionChange: (value: string) => void;
  onReportTextChange: (value: string) => void;
  onSubmitReport: () => void;
  onReportIssue: (report: LocalReport) => void;
  onAskFieldQuestion: () => void;
};

export function DecisionScreen({
  current,
  dataStatus,
  lastUpdatedAt,
  locationStatus,
  providerSnapshot,
  reportCondition,
  reportText,
  reports,
  searchContext,
  onReportConditionChange,
  onReportTextChange,
  onSubmitReport,
  onReportIssue,
  onAskFieldQuestion,
}: DecisionScreenProps) {
  const [isReportComposerOpen, setIsReportComposerOpen] = useState(false);
  const currentLocationLabel = getFieldReportPlaceDisplay(locationStatus);
  const nearbySectionTitle = getNearbySectionTitle(searchContext);
  const nearbyReports = getNearbyDecisionReports(reports, currentLocationLabel, searchContext);

  return (
    <View>
      <DecisionCard
        current={current}
        lastUpdatedAt={lastUpdatedAt}
        locationStatus={locationStatus}
        providerSnapshot={providerSnapshot}
        searchContext={searchContext}
      />

      <View style={styles.summaryActionGrid}>
        <Pressable onPress={onAskFieldQuestion} style={[styles.summaryActionCard, styles.summaryAskCard]}>
          <Text style={styles.summaryActionKicker}>궁금한 지역</Text>
          <Text style={styles.summaryActionTitle}>현장에{'\n'}물어보기</Text>
          <View style={styles.summaryActionCircle}>
            <Text style={styles.summaryActionCircleText}>↗</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => setIsReportComposerOpen((open) => !open)}
          style={[styles.summaryActionCard, styles.summaryPostCard, isReportComposerOpen && styles.summaryActionCardActive]}
        >
          <Text style={styles.summaryActionKicker}>내 현재위치</Text>
          <Text style={styles.summaryActionTitle}>지금 날씨{'\n'}남기기</Text>
          <View style={styles.summaryActionCircle}>
            <Text style={styles.summaryActionCircleText}>{isReportComposerOpen ? '×' : '+'}</Text>
          </View>
        </Pressable>
      </View>

      {isReportComposerOpen && <View style={styles.localReportCard}>
        <View style={styles.localReportTitleRow}>
          <Text style={styles.localReportTitle}>현재 위치 날씨 남기기</Text>
          <Text style={styles.localReportPlace}>{currentLocationLabel}</Text>
        </View>
        <Text style={styles.localReportCaption}>
          지금 보이는 날씨를 한 줄로 남기면 생생날씨특파원에 반영돼요.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.localOptions}
        >
          {['비 안 와요', '비 와요', '소나기', '눈', '천둥', '강풍', '황사', '미세먼지'].map((option, index) => {
            const isSelected = reportCondition ? reportCondition === option : index === 0;
            return (
              <Pressable
                key={option}
                onPress={() => onReportConditionChange(option)}
                style={[styles.localOptionChip, isSelected && styles.localOptionChipActive]}
              >
                <Text style={[styles.localOptionText, isSelected && styles.localOptionTextActive]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.reportBox}>
          <TextInput
            value={reportText}
            onChangeText={onReportTextChange}
            placeholder="예: 바닥은 말라 있고 우산 쓴 사람은 없어요"
            placeholderTextColor="rgba(34,36,38,0.36)"
            style={styles.reportInput}
          />
          <Pressable onPress={onSubmitReport} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>올리기</Text>
          </Pressable>
        </View>
        <Text style={styles.localReportStatus}>최근 현장 제보와 함께 요약 화면에 참고돼요.</Text>
      </View>}

      <View style={styles.nearbyFieldCard}>
        <View style={styles.mockSectionHead}>
          <Text style={styles.mockSectionTitle}>{nearbySectionTitle}</Text>
          <Text style={styles.nearbyFieldMeta}>{searchContext.place} 기준</Text>
        </View>
        {nearbyReports.length > 0 ? (
          <View style={styles.reportList}>
            {nearbyReports.map((report, index) => (
              <View key={`${report.place}-${index}`} style={styles.reportItem}>
                <View style={styles.reportContent}>
                  <Text style={styles.reportMeta}>
                    {report.place} · {report.time}
                  </Text>
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
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title="아직 근처 제보가 없어요"
            body={`${nearbySectionTitle} 글이 올라오면 요약 화면에 함께 참고돼요.`}
            action="첫 제보를 한 줄로 남겨주세요"
          />
        )}
      </View>
    </View>
  );
}

function getWeatherKeyFromCondition(condition: string): WeatherKey | null {
  if (condition.includes('태풍') || condition.includes('강풍')) {
    return 'typhoon';
  }
  if (condition.includes('폭염') || condition.includes('더위') || condition.includes('고온')) {
    return 'heat';
  }
  if (condition.includes('황사') || condition.includes('미세먼지') || condition.includes('먼지')) {
    return 'dust';
  }
  if (condition.includes('무지개')) {
    return 'rainbow';
  }
  if (condition.includes('맑은 밤')) {
    return 'night';
  }
  if (condition.includes('소나기')) {
    return 'shower';
  }
  if (condition.includes('천둥') || condition.includes('번개') || condition.includes('소나기')) {
    return 'thunder';
  }
  if (condition.includes('눈') || condition.includes('진눈')) {
    return 'snow';
  }
  if (condition.includes('안개') || condition.includes('시야')) {
    return 'fog';
  }
  if (condition.includes('맑') || condition.includes('비 없음') || condition.includes('건조')) {
    return 'sunny';
  }
  if (condition.includes('비') || condition.includes('강수')) {
    return 'rain';
  }
  if (condition.includes('흐림') || condition.includes('구름')) {
    return 'cloudy';
  }
  return null;
}

function getNearbyDecisionReports(
  reports: LocalReport[],
  currentLocationLabel: string,
  searchContext: SearchContext,
) {
  const currentPlace = normalizePlace(currentLocationLabel);
  const contextPlace = normalizePlace(searchContext.place);
  const isCurrentContext = searchContext.target.kind === 'current';
  const referencePlace = isCurrentContext ? currentPlace : contextPlace;

  if (!referencePlace || referencePlace === '현재위치') {
    return reports.filter((report) => report.source === 'local').slice(0, 6);
  }

  const matchedReports = reports.filter((report) => {
    const place = normalizePlace(report.place);

    return Boolean(place) && (place.includes(referencePlace) || referencePlace.includes(place));
  });

  if (matchedReports.length > 0) return matchedReports.slice(0, 6);

  if (!isCurrentContext && contextPlace) {
    return [
      {
        place: searchContext.place,
        time: '확인 필요',
        condition: searchContext.detectedWeather,
        body: `${searchContext.place} 주변 현장 제보가 아직 없어요. 가까운 분의 제보가 필요해요.`,
        source: 'mock' as const,
      },
    ];
  }

  return [];
}

function normalizePlace(place: string) {
  return place
    .replace(/\s+/g, '')
    .replace(/현재위치확인됨|현재위치|내위치|주변/g, '')
    .trim();
}
