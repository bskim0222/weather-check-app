import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { EmptyState } from '../components/EmptyState';
import { DecisionCard } from '../components/DecisionCard';
import { weatherPresets } from '../data/mockWeather';
import { styles } from '../styles/appStyles';
import type { LocationStatus } from '../types/appState';
import type {
  ForecastProviderId,
  ForecastSource,
  LocalReport,
  SearchContext,
  WeatherKey,
  WeatherPreset,
} from '../types/weather';

const providerIcons: Partial<Record<ForecastProviderId, ImageSourcePropType>> = {
  kma: require('../../assets/icon-kma.png'),
  yr: require('../../assets/icon-yr.png'),
  fmi: require('../../assets/icon-fmi.png'),
};

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
  const actionHint = searchContext.needsClarification
    ? '장소나 시간을 더 구체적으로 물어보면 판정이 더 또렷해져요.'
    : `${searchContext.detectedWeather} 기준으로 보면 첫 1~3시간 변화가 가장 중요해요.`;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weatherSwitch}
      >
        {weatherOptions.map(([key, item]) => {
          const isActive = weatherKey === key;
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
          <Text style={styles.mockSectionTitle}>이렇게 판단했어요!</Text>
          <Pressable style={styles.mockSectionButton}>
            <Text style={styles.mockSectionButtonText}>비교</Text>
          </Pressable>
        </View>
        <View style={styles.reasonSummary}>
          <Text style={styles.reasonSummaryTitle}>서비스별 현재값을 서로 맞춰봤어요</Text>
          <Text style={styles.reasonSummaryText}>
            같은 장소와 시간의 서비스별 날씨, 기온, 근처 제보를 함께 보고 판정 문장을 만들어요.
          </Text>
        </View>
        <View style={styles.sourceGrid}>
          {current.sources.map((source) => (
            <View key={source.name} style={styles.evidenceRow}>
              <ServiceIcon source={source} />
              <View style={styles.evidenceContent}>
                <Text style={styles.evidenceName}>{normalizeProviderName(source.name)}</Text>
                <Text style={styles.evidenceSub}>현재 예보</Text>
              </View>
              <View style={styles.sourceWeatherPillCompact}>
                <WeatherStatusIcon condition={source.condition} tone={source.color} />
                <Text style={styles.sourceTempCompact}>{formatSourceTemperature(source.temp)}</Text>
              </View>
            </View>
          ))}
          <View style={styles.evidenceRow}>
            <View style={[styles.sourceLogoFallback, { backgroundColor: '#ffd36b' }]}>
              <Text style={[styles.sourceLogoFallbackText, { color: '#301a22' }]}>현</Text>
            </View>
            <View style={styles.evidenceContent}>
              <Text style={styles.evidenceName}>생생날씨특파원</Text>
              <Text style={styles.evidenceSub}>현장 제보가 쌓이면 예보와 함께 비교해요.</Text>
            </View>
            <View style={styles.liveEvidenceBadge}>
              <Text style={styles.liveEvidenceBadgeText}>{current.live}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.mockSection}>
        <View style={styles.mockSectionHead}>
          <Text style={styles.mockSectionTitle}>다음 6시간 날씨</Text>
          <Pressable style={styles.mockSectionButton}>
            <Text style={styles.mockSectionButtonText}>예보 흐름</Text>
          </Pressable>
        </View>
        <View style={styles.forecastPanel}>
          <View style={styles.forecastLead}>
            <Text style={styles.forecastLeadLabel}>흐름</Text>
            <Text style={styles.forecastLeadText}>{current.forecastLead}</Text>
            <View style={styles.forecastHint}>
              <Text style={styles.forecastHintLabel}>행동 힌트</Text>
              <Text style={styles.forecastHintText}>{actionHint}</Text>
            </View>
          </View>
          <View style={styles.forecastRows}>
            {current.forecastRows.map((row) => (
              <View key={`${row.time}-${row.title}`} style={styles.forecastRow}>
                <View style={styles.forecastWeatherIconFrame}>
                  <WeatherStatusIcon condition={row.title} tone={getForecastIconTone(row.title, current.accent)} />
                </View>
                <View style={styles.forecastMain}>
                  <Text style={styles.forecastTime}>{row.time}</Text>
                  <Text style={styles.forecastTitle}>{row.title}</Text>
                </View>
                <View style={styles.forecastSide}>
                  <Text style={styles.forecastTemp}>{row.temp}</Text>
                  <Text style={styles.forecastNote}>{row.note}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
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

function ServiceIcon({ source }: { source: ForecastSource }) {
  const localIcon = source.providerId ? providerIcons[source.providerId] : undefined;

  if (localIcon) {
    return (
      <View style={styles.sourceLogoFrame}>
        <Image source={localIcon} style={styles.sourceLogoImage} />
      </View>
    );
  }

  if (!source.iconUri) {
    return (
      <View style={[styles.sourceLogoFallback, { backgroundColor: source.color }]}>
        <Text style={styles.sourceLogoFallbackText}>{source.mark}</Text>
      </View>
    );
  }

  return (
    <View style={styles.sourceLogoFrame}>
      <Text style={styles.sourceLogoBehind}>{source.mark}</Text>
      <Image source={{ uri: source.iconUri }} style={styles.sourceLogoImage} />
    </View>
  );
}

function WeatherStatusIcon({ condition, tone }: { condition: string; tone: string }) {
  const kind = getWeatherIconKind(condition);
  const softTone = getSoftTone(kind);

  if (kind === 'sunny') {
    return (
      <View style={styles.miniWeatherDrawing}>
        <View style={[styles.miniSunHalo, { borderColor: tone }]} />
        <View style={[styles.miniSunCore, { backgroundColor: tone }]} />
      </View>
    );
  }

  return (
    <View style={styles.miniWeatherDrawing}>
      <View style={[styles.miniCloudBase, { backgroundColor: tone }]} />
      <View style={[styles.miniCloudPuff, { backgroundColor: tone }]} />
      <View style={[styles.miniCloudSmall, { backgroundColor: softTone }]} />
      {kind === 'rain' && (
        <View style={styles.miniRainDrops}>
          <View style={[styles.miniRainDrop, { backgroundColor: softTone }]} />
          <View style={[styles.miniRainDrop, styles.miniRainDropLower, { backgroundColor: softTone }]} />
        </View>
      )}
      {kind === 'snow' && (
        <View style={styles.miniSnowDots}>
          <View style={styles.miniSnowDot} />
          <View style={styles.miniSnowDot} />
        </View>
      )}
      {kind === 'thunder' && (
        <View style={styles.miniThunder}>
          <View style={styles.miniThunderTop} />
          <View style={styles.miniThunderBottom} />
        </View>
      )}
      {kind === 'fog' && (
        <View style={styles.miniFogLines}>
          <View style={[styles.miniFogLine, { backgroundColor: softTone }]} />
          <View style={[styles.miniFogLineShort, { backgroundColor: softTone }]} />
        </View>
      )}
    </View>
  );
}

function getWeatherIconKind(condition: string) {
  if (condition.includes('천둥') || condition.includes('번개') || condition.includes('불안정')) return 'thunder';
  if (condition.includes('비') || condition.includes('강수')) return 'rain';
  if (condition.includes('소나기')) return 'rain';
  if (condition.includes('눈')) return 'snow';
  if (condition.includes('안개') || condition.includes('시야') || condition.includes('습')) return 'fog';
  if (condition.includes('맑') || condition.includes('비 없음')) return 'sunny';

  return 'cloudy';
}

function getForecastIconTone(condition: string, fallback: string) {
  const kind = getWeatherIconKind(condition);

  if (kind === 'rain') return '#7faed0';
  if (kind === 'snow') return '#eef8ff';
  if (kind === 'thunder') return '#5e5276';
  if (kind === 'fog') return '#d7d2cf';
  if (kind === 'cloudy') return '#f1d7d0';

  return fallback;
}

function getSoftTone(kind: string) {
  if (kind === 'rain') return '#b8d7ef';
  if (kind === 'snow') return '#ffffff';
  if (kind === 'thunder') return '#ffd33d';
  if (kind === 'fog') return '#bbb5b7';

  return '#fff2e9';
}

function normalizeProviderName(name: string) {
  if (name === '기상청') return '대한민국 기상청';
  if (name === 'Yr.no') return '노르웨이 기상청';
  if (name === 'FMI ECMWF') return '핀란드 기상청';

  return name;
}

function formatSourceTemperature(value: string) {
  return value.replace('도', '℃');
}
