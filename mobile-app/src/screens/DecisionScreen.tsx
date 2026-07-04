import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { DecisionCard } from '../components/DecisionCard';
import { weatherPresets } from '../data/mockWeather';
import { styles } from '../styles/appStyles';
import type { LocationStatus } from '../types/appState';
import type {
  LocalReport,
  SearchContext,
  WeatherKey,
  WeatherPreset,
} from '../types/weather';

type DecisionScreenProps = {
  current: WeatherPreset;
  locationStatus: LocationStatus;
  reportCondition: string;
  reportText: string;
  reports: LocalReport[];
  searchContext: SearchContext;
  weatherKey: WeatherKey;
  onReportConditionChange: (value: string) => void;
  onReportTextChange: (value: string) => void;
  onSubmitReport: () => void;
  onReportIssue: (report: LocalReport) => void;
  onWeatherChange: (weather: WeatherKey) => void;
};

export function DecisionScreen({
  current,
  locationStatus,
  reportCondition,
  reportText,
  reports,
  searchContext,
  weatherKey,
  onReportConditionChange,
  onReportTextChange,
  onSubmitReport,
  onReportIssue,
  onWeatherChange,
}: DecisionScreenProps) {
  const weatherOptions = Object.entries(weatherPresets) as [WeatherKey, WeatherPreset][];
  const activeWeatherKey = getWeatherKeyFromCondition(current.condition) ?? weatherKey;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weatherSwitch}
      >
        {weatherOptions.map(([key, item]) => {
          const isActive = activeWeatherKey === key;
          return (
            <Pressable
              key={key}
              onPress={() => onWeatherChange(key)}
              style={[
                styles.weatherChip,
                isActive && {
                  backgroundColor: item.accent,
                  borderColor: item.accent,
                },
              ]}
            >
              <Text
                style={[
                  styles.weatherChipText,
                  isActive && styles.weatherChipTextActive,
                  isActive && { color: item.accentInk },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <DecisionCard current={current} locationStatus={locationStatus} searchContext={searchContext} />

      <View style={styles.localReportCard}>
        <View style={styles.localReportHead}>
          <View style={styles.localReportTitleBlock}>
            <View style={styles.localReportTitleRow}>
              <Text style={styles.localReportTitle}>현재 위치의 날씨상황을 알려주세요</Text>
              <Text style={styles.localReportPlace}>{searchContext.place}</Text>
            </View>
            <Text style={styles.localReportCaption}>
              지금 보이는 날씨를 한 줄로 남기면 생생날씨특파원에 반영돼요.
            </Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.localOptions}
        >
          {['비 안 와요', '비 와요', '소나기', '눈', '천둥', '강풍'].map((option, index) => {
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
        <Text style={styles.localReportStatus}>최근 30분 제보와 함께 판정 근거에 반영됩니다.</Text>
      </View>

      <View style={styles.mockSection}>
        <View style={styles.mockSectionHead}>
          <Text style={styles.mockSectionTitle}>근처 현장</Text>
          <Pressable style={styles.mockSectionButton}>
            <Text style={styles.mockSectionButtonText}>제보</Text>
          </Pressable>
        </View>
        {reports.length > 0 ? (
          <View style={styles.reportList}>
            {reports.map((report, index) => (
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
            body={`${searchContext.place} 근처의 실제 날씨 글이 올라오면 판정 근거에 함께 반영됩니다.`}
            action="첫 제보를 한 줄로 남겨주세요"
          />
        )}
      </View>
    </View>
  );
}

function getWeatherKeyFromCondition(condition: string): WeatherKey | null {
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
