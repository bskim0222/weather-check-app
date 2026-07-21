import { useEffect, useRef } from 'react';
import { useState } from 'react';
import { Animated, Easing, Image, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { ProviderServiceIcon } from './ProviderServiceIcon';
import { WeatherIcon } from './WeatherIcon';
import { normalizeHourlyLabels } from '../domain/forecastLabels';
import { getCurrentLocationDisplay } from '../domain/locationDisplay';
import type { WeatherProviderSnapshot } from '../services/weatherProviders';
import { styles } from '../styles/appStyles';
import type { CompareForecastCell, ForecastSource, SearchContext, WeatherPreset } from '../types/weather';
import type { LocationStatus } from '../types/appState';

const AnimatedCircle = Animated.createAnimatedComponent(Circle as any);
const AnimatedG = Animated.createAnimatedComponent(G as any);
const AnimatedLine = Animated.createAnimatedComponent(Line as any);
const AnimatedPath = Animated.createAnimatedComponent(Path as any);

type SelectedForecastSource = {
  source: ForecastSource;
  sourceIndex: number;
};

type DecisionCardProps = {
  current: WeatherPreset;
  lastUpdatedAt: Date | null;
  locationStatus: LocationStatus;
  providerSnapshot: WeatherProviderSnapshot;
  searchContext: SearchContext;
};

export function DecisionCard({ current, lastUpdatedAt, locationStatus, providerSnapshot, searchContext }: DecisionCardProps) {
  const [selectedSource, setSelectedSource] = useState<SelectedForecastSource | null>(null);
  const normalizedCondition = normalizeWeatherCondition(current.condition);
  const placeLabel = getDecisionPlaceLabel(searchContext, locationStatus);
  const title = getDisplayTitle(current.title);
  const artworkCaption = getArtworkCaption(normalizedCondition, current.level);
  const figma = getFigmaPreset(normalizedCondition);
  const forecastSources = getSyncedForecastSources(current);

  return (
    <View style={[styles.decisionCard, styles.figmaWeatherCard, { backgroundColor: figma.bg }]}>
      <View style={[styles.figmaWeatherGlow, { backgroundColor: figma.glow }]} />

      <View style={styles.figmaWeatherTop}>
        <View style={styles.figmaWeatherLocation}>
          <Text numberOfLines={1} style={[styles.figmaWeatherEyebrow, { color: figma.dim }]}>
            {searchContext.timeLabel}
          </Text>
          <Text style={[styles.figmaWeatherCity, { color: figma.ink }]}>
            {placeLabel}
          </Text>
        </View>
        <Text style={[styles.figmaWeatherTime, { color: figma.dim }]}>{formatUpdatedAt(lastUpdatedAt)}</Text>
      </View>

      <View style={styles.figmaWeatherScene}>
        <WeatherLineArtwork condition={normalizedCondition} stroke={figma.stroke} dim={figma.dim} />
      </View>

      <View style={styles.figmaWeatherTempWrap}>
        <View style={styles.figmaWeatherTempRow}>
          <Text style={[styles.figmaWeatherTemp, { color: figma.ink }]}>{current.temp}</Text>
          <Text style={[styles.figmaWeatherDegree, { color: figma.dim }]}>°C</Text>
        </View>
        <Text style={[styles.figmaWeatherCondition, { color: figma.ink }]}>
          {getDecisionSignalValue(normalizedCondition, current.level)}
        </Text>
        <Text numberOfLines={2} style={[styles.figmaWeatherSub, { color: figma.dim }]}>
          {artworkCaption}
        </Text>
      </View>

      <View style={styles.figmaWeatherMessage}>
        <Text
          numberOfLines={3}
          adjustsFontSizeToFit
          style={[styles.figmaWeatherTitle, { color: figma.ink }]}
        >
          {title}
        </Text>
        <Text style={[styles.figmaWeatherSummary, { color: figma.dim }]}>
          {current.summary}
        </Text>
      </View>

      <View style={styles.figmaWeatherHourly}>
        <View style={styles.figmaWeatherHourlyContent}>
        {forecastSources.map((source, sourceIndex) => (
          <ForecastSourceMiniCard
            key={`${source.name}-${source.mark}`}
            source={source}
            figma={figma}
            onPress={() => setSelectedSource({ source, sourceIndex })}
          />
        ))}
        </View>
      </View>

      <ProviderForecastDetailModal
        selected={selectedSource}
        visible={selectedSource !== null}
        placeLabel={placeLabel}
        providerSnapshot={providerSnapshot}
        searchContext={searchContext}
        onClose={() => setSelectedSource(null)}
      />
    </View>
  );
}

function ForecastSourceMiniCard({
  figma,
  onPress,
  source,
}: {
  figma: ReturnType<typeof createFigmaPreset>;
  onPress: () => void;
  source: ForecastSource;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.figmaWeatherSourceCard,
        { backgroundColor: figma.sourceSurface },
        pressed && styles.figmaWeatherSourceCardPressed,
      ]}
    >
      <View style={styles.figmaWeatherSourceTop}>
        <ProviderServiceIcon
          name={source.name}
          mark={source.mark}
          style={styles.figmaWeatherSourceLogo}
        />
        <Text numberOfLines={1} style={[styles.figmaWeatherSourceName, { color: figma.dim }]}>
          {shortForecastSourceName(source.name)}
        </Text>
      </View>
      <View style={styles.figmaWeatherSourceBody}>
        <ForecastMiniIcon condition={source.condition} stroke={figma.ink} dim={figma.dim} />
        <View style={styles.figmaWeatherSourceTextBlock}>
          <Text style={[styles.figmaWeatherSourceWeather, { color: figma.ink }]}>
            {source.condition}
          </Text>
          <Text style={[styles.figmaWeatherSourceTemp, { color: figma.ink }]}>
            {source.temp}
          </Text>
        </View>
      </View>
      <Text style={[styles.figmaWeatherSourceDetail, { color: figma.dim }]}>
        {source.detail}
      </Text>
    </Pressable>
  );
}

function ProviderForecastDetailModal({
  onClose,
  placeLabel,
  providerSnapshot,
  searchContext,
  selected,
  visible,
}: {
  onClose: () => void;
  placeLabel: string;
  providerSnapshot: WeatherProviderSnapshot;
  searchContext: SearchContext;
  selected: SelectedForecastSource | null;
  visible: boolean;
}) {
  if (!selected) return null;

  const { source, sourceIndex } = selected;
  const hourlyRows = normalizeHourlyLabels(providerSnapshot.hourlyRows, searchContext).slice(0, 12);
  const dailyRows = providerSnapshot.dailyRows.slice(0, 7);

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.providerDetailBackdrop} onPress={onClose}>
        <Pressable style={styles.providerDetailSheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.providerDetailGrabber} />
          <View style={styles.providerDetailHeader}>
            <ProviderServiceIcon name={source.name} mark={source.mark} style={styles.providerDetailLogo} />
            <View style={styles.providerDetailTitleBlock}>
              <Text style={styles.providerDetailName}>{source.name}</Text>
              <Text numberOfLines={1} style={styles.providerDetailMeta}>
                {placeLabel} · {searchContext.timeLabel}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.providerDetailContent} showsVerticalScrollIndicator={false}>
            <View style={styles.providerDetailSummary}>
              <View style={styles.providerDetailSummaryText}>
                <Text style={styles.providerDetailCondition}>{source.condition}</Text>
                <Text style={styles.providerDetailNote}>서비스가 제공한 현재 시간대 예보</Text>
              </View>
              <Text style={styles.providerDetailTemp}>{source.temp}</Text>
            </View>

            <View style={styles.providerDetailRows}>
              {createProviderMetricRows(source).map((row) => (
                <ProviderDetailRow key={row.label} label={row.label} value={row.value} />
              ))}
            </View>

            <View style={styles.providerDetailSection}>
              <Text style={styles.providerDetailSectionTitle}>시간별 예보</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providerDetailTimeline}>
                {hourlyRows.map((row) => (
                  <ProviderTimelineCell
                    key={`hourly-${row.label}`}
                    label={row.label}
                    cell={getProviderCellByIndex(row, sourceIndex)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.providerDetailSection}>
              <Text style={styles.providerDetailSectionTitle}>일자별 예보</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providerDetailDailyList}>
                {dailyRows.map((row) => (
                  <ProviderDailyCell
                    key={`daily-${row.label}`}
                    label={row.label}
                    cell={getProviderCellByIndex(row, sourceIndex)}
                  />
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          <Pressable style={styles.providerDetailClose} onPress={onClose}>
            <Text style={styles.providerDetailCloseText}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ProviderTimelineCell({ cell, label }: { cell: CompareForecastCell; label: string }) {
  return (
    <View style={styles.providerDetailTimelineCell}>
      <Text numberOfLines={1} style={styles.providerDetailTimelineLabel}>{formatCompactTimeLabel(label)}</Text>
      <ForecastMiniIcon condition={cell.weather} stroke="#202020" dim="rgba(32,32,32,0.45)" />
      <Text numberOfLines={2} style={styles.providerDetailTimelineWeather}>{cell.weather}</Text>
      <Text numberOfLines={2} style={styles.providerDetailTimelineDetail}>{formatForecastCellDetail(cell.detail)}</Text>
    </View>
  );
}

function ProviderDailyCell({ cell, label }: { cell: CompareForecastCell; label: string }) {
  const morning = cell.morning ?? cell;
  const afternoon = cell.afternoon ?? cell;

  return (
    <View style={styles.providerDetailDailyCell}>
      <Text numberOfLines={1} style={styles.providerDetailDailyLabel}>{label}</Text>
      <View style={styles.providerDetailDailyPeriods}>
        <ProviderDailyPeriod label="오전" period={morning} />
        <ProviderDailyPeriod label="오후" period={afternoon} />
      </View>
    </View>
  );
}

function ProviderDailyPeriod({
  label,
  period,
}: {
  label: string;
  period: Pick<CompareForecastCell, 'detail' | 'weather'>;
}) {
  return (
    <View style={styles.providerDetailDailyPeriod}>
      <Text style={styles.providerDetailDailyPeriodLabel}>{label}</Text>
      <ForecastMiniIcon condition={period.weather} stroke="#202020" dim="rgba(32,32,32,0.45)" />
      <Text numberOfLines={2} style={styles.providerDetailDailyWeather}>{period.weather}</Text>
      <Text numberOfLines={2} style={styles.providerDetailDailyDetail}>{formatForecastCellDetail(period.detail)}</Text>
    </View>
  );
}

function ProviderDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.providerDetailRow}>
      <Text style={styles.providerDetailRowLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.providerDetailRowValue}>
        {value}
      </Text>
    </View>
  );
}

function getProviderCellByIndex(row: { kma: CompareForecastCell; yr: CompareForecastCell; windy: CompareForecastCell; fmi?: CompareForecastCell }, sourceIndex: number) {
  if (sourceIndex === 0) return row.kma;
  if (sourceIndex === 1) return row.yr;
  return row.fmi ?? row.windy;
}

function formatCompactTimeLabel(label: string) {
  return label.replace(/\s+/g, '').replace('오늘', '').replace('내일', '내일 ');
}

function compactDetail(detail: string) {
  return detail.replace(/\s+/g, ' ').replace(/강수\s*/g, '').trim();
}

function formatForecastCellDetail(detail: string) {
  const compact = compactDetail(detail);
  const temperature = extractForecastTemperature(compact);
  const rain = extractPrecipitationMetric(compact);
  const wind = extractWindDetail(compact);
  const parts = [temperature, rain !== compact ? rain : null, wind].filter(Boolean);

  return parts.length > 0 ? parts.join('\n') : compact;
}

function createProviderMetricRows(source: ForecastSource) {
  const detail = source.detail || '';

  return [
    { label: '강수', value: extractPrecipitationMetric(detail) || '제공값 없음' },
    { label: '바람', value: extractWindDetail(detail) || '제공값 없음' },
    { label: '습도', value: extractHumidityDetail(detail) || '제공값 없음' },
  ];
}

function extractPrecipitationMetric(detail: string) {
  const amount = detail.match(/\d+(?:\.\d+)?\s*mm/i);
  if (amount) return amount[0].replace(/\s+/g, '');

  const probability = detail.match(/\d+\s*%/);
  if (probability) return probability[0].replace(/\s+/g, '');

  return '';
}

function extractWindDetail(detail: string) {
  const match = detail.match(/바람\s*\d+(?:\.\d+)?\s*m\/s/i);
  if (match) return match[0].replace(/\s+/g, ' ');

  const direction = detail.match(/(?:북동풍|동풍|남동풍|남풍|남서풍|서풍|북서풍|북풍|약풍|강풍)/);
  if (direction) return direction[0];

  return '';
}

function extractHumidityDetail(detail: string) {
  const match = detail.match(/습도\s*\d+\s*%/);
  return match ? match[0].replace(/\s+/g, ' ') : '';
}

function getSyncedForecastSources(current: WeatherPreset) {
  return current.sources.slice(0, 3);
}

function extractForecastTemperature(detail: string) {
  const match = detail.match(/-?\d+(?:\.\d+)?\s*(?:°C|℃|도|°)/i);

  if (!match) return null;

  return match[0].replace(/\s+/g, '').replace(/℃|도/i, '°C').replace(/°$/, '°C');
}

function shortForecastSourceName(name: string) {
  if (name.includes('대한민국')) return '기상청';
  if (name.includes('노르웨이')) return '노르웨이';
  if (name.includes('핀란드')) return '핀란드';
  return name.replace('기상청', '').trim() || name;
}

function formatUpdatedAt(updatedAt: Date | null) {
  if (!updatedAt) return '갱신됨';

  const hour = String(updatedAt.getHours()).padStart(2, '0');
  const minute = String(updatedAt.getMinutes()).padStart(2, '0');
  return `${hour}:${minute} 갱신`;
}

function normalizeWeatherCondition(condition: string) {
  const value = condition.toLowerCase();

  if (includesAny(value, ['태풍', 'typhoon', 'cyclone'])) return '태풍';
  if (includesAny(value, ['폭풍우', 'stormy'])) return '폭풍우';
  if (includesAny(value, ['천둥', '번개', 'thunder', 'storm'])) return '천둥번개';
  if (includesAny(value, ['눈', '진눈', 'snow', 'sleet'])) return '눈';
  if (includesAny(value, ['안개', '시야', 'fog', 'mist'])) return '안개';
  if (includesAny(value, ['황사', '미세먼지', '먼지', 'dust'])) return '황사';
  if (includesAny(value, ['폭염', 'heatwave', '무더위'])) return '폭염';
  if (includesAny(value, ['무지개', 'rainbow'])) return '무지개';
  if (includesAny(value, ['맑은 밤', '밤', 'night'])) return '맑은 밤';

  if (includesAny(value, ['비 없음', '강수 없음', 'no rain', '맑', 'clear', 'sunny', '건조', '안정'])) {
    return '맑음';
  }

  if (includesAny(value, ['소나기', 'shower'])) return '소나기';
  if (includesAny(value, ['비', '강수', 'rain'])) return '비';
  if (includesAny(value, ['흐림', '구름', 'cloud', 'overcast'])) return '흐림';

  return condition === '맑음' ? '맑음' : '흐림';
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

function getDecisionPlaceLabel(searchContext: SearchContext, locationStatus: LocationStatus) {
  if (searchContext.target.kind !== 'current') return searchContext.place;
  return getCurrentLocationDisplay(locationStatus);
}

function getDisplayTitle(title: string) {
  if (title.includes('쪽이 ')) return title.replace('쪽이 ', '쪽이\n');
  if (title.includes('천둥 ')) return title.replace('천둥 ', '천둥\n');
  if (title.includes('하늘은 ')) return title.replace('하늘은 ', '하늘은\n');
  if (title.includes('진눈깨비 ')) return title.replace('진눈깨비 ', '진눈깨비\n');

  return title;
}

function getCompactSignal(condition: string, signal: string) {
  if (condition === '비') return '2곳 비';
  if (condition === '소나기') return '국지 비';
  if (condition === '맑음') return '3곳 비 없음';
  if (condition === '천둥번개' || condition === '폭풍우') return '강한 비';
  if (condition === '눈') return '눈 가능';
  if (condition === '안개') return '시야 확인';
  if (condition === '황사') return '대기질 주의';
  if (condition === '폭염') return '체감 고온';
  if (condition === '태풍') return '강풍 위험';

  return signal;
}

function getDecisionSignalValue(condition: string, level: string) {
  if (level === '갈림') return '예보 갈림';
  if (level === '확인 중') return '예보 확인 중';
  if (condition === '맑음') return '맑음 우세';
  if (condition === '비') return '비 우세';
  if (condition === '소나기') return '소나기 가능';
  if (condition === '천둥번개' || condition === '폭풍우') return '주의';
  if (condition === '눈') return '눈 가능';
  if (condition === '안개') return '안개 가능';
  if (condition === '황사') return '황사 주의';
  if (condition === '폭염') return '폭염 주의';
  if (condition === '태풍') return '태풍 주의';
  if (condition === '맑은 밤') return '맑은 밤';
  if (condition === '무지개') return '소나기 뒤 맑음';

  return '흐림 우세';
}

function getArtworkCaption(condition: string, level: string) {
  if (level === '갈림') return '같은 시간 예보가 서로 달라요';
  if (level === '확인 중') return '제공값을 다시 확인하고 있어요';
  if (condition === '맑음') return '비 신호는 거의 없어요';
  if (condition === '비') return '세 기상청 예보가 비 쪽으로 모여 있어요';
  if (condition === '소나기') return '짧고 강한 비 신호가 보여요';
  if (condition === '천둥번개' || condition === '폭풍우') return '강한 비와 천둥 신호가 보여요';
  if (condition === '눈') return '눈 또는 진눈깨비 신호가 있어요';
  if (condition === '안개') return '시야가 흐릴 수 있어요';
  if (condition === '황사') return '대기질과 시야를 같이 봐야 해요';
  if (condition === '폭염') return '체감온도가 크게 오를 수 있어요';
  if (condition === '태풍') return '강풍과 많은 비를 조심해야 해요';
  if (condition === '맑은 밤') return '구름 적고 하늘이 안정적이에요';
  if (condition === '무지개') return '소나기 뒤 하늘이 열리는 신호예요';

  return '구름 신호가 더 강해요';
}

function getFigmaPreset(condition: string) {
  const presets: Record<string, ReturnType<typeof createFigmaPreset>> = {
    맑음: createFigmaPreset('#ffe600', '#8a6400', '#2e2000', '#735300', 0.2),
    흐림: createFigmaPreset('#b0b8c1', '#3a4550', '#1a2028', '#4a5560', 0.18),
    비: createFigmaPreset('#cfe8f6', '#34708c', '#172933', '#5d7e8b', 0.32),
    소나기: createFigmaPreset('#bfe0f3', '#2f6f8e', '#172933', '#557c8d', 0.28),
    천둥번개: createFigmaPreset('#111111', '#e6e6e6', '#f2f2f2', '#969696', 0.06, true),
    폭풍우: createFigmaPreset('#111111', '#e6e6e6', '#f2f2f2', '#969696', 0.06, true),
    눈: createFigmaPreset('#f5f2e9', '#7d9aac', '#222621', '#7d7b72', 0.42),
    '맑은 밤': createFigmaPreset('#0d0b20', '#c4a8ff', '#ede8ff', '#9f89d8', 0.08, true),
    안개: createFigmaPreset('#d8d8d8', '#606060', '#1a1a1a', '#707070', 0.18),
    황사: createFigmaPreset('#d4a844', '#6a4400', '#2a1800', '#885a10', 0.16),
    폭염: createFigmaPreset('#e03010', '#4a0800', '#fff0ec', '#ffb09a', 0.08, true),
    무지개: createFigmaPreset('#70c8a8', '#1a4a38', '#062018', '#2a7858', 0.18),
    태풍: createFigmaPreset('#1a2040', '#9bb2ff', '#d0dcff', '#8fa8ec', 0.08, true),
  };

  return presets[condition] ?? presets.흐림;
}

function createFigmaPreset(bg: string, stroke: string, ink: string, dim: string, glowStrength: number, dark = false) {
  return {
    bg,
    surface: dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.24)',
    sourceSurface: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.34)',
    stroke,
    ink,
    dim,
    line: dark ? 'rgba(255,255,255,0.16)' : 'rgba(20,20,20,0.14)',
    glow: `rgba(255,255,255,${glowStrength})`,
  };
}

function getForecastStrip(
  temp: number,
  rows: WeatherPreset['forecastRows'],
  fallbackCondition: string,
  searchContext: SearchContext,
) {
  const fallbackRow = rows[rows.length - 1];
  const baseDate = getForecastBaseDate(searchContext);
  const isCurrentContext = isCurrentForecastContext(searchContext);

  return Array.from({ length: 10 }, (_, index) => {
    if (index === 0) {
      return {
        label: isCurrentContext ? '지금' : '기준',
        temp: `${temp}°`,
        condition: fallbackCondition,
        precipitation: null,
      };
    }

    const row = rows[index - 1] ?? fallbackRow;

    return {
      label: row?.time ? formatReadableTimeLabel(row.time) : formatForecastSequenceLabel(index, baseDate, isCurrentContext),
      temp: row ? formatForecastTemp(row.temp) : `${temp}°`,
      condition: row ? getForecastStripCondition(row.title, fallbackCondition) : fallbackCondition,
      precipitation: row ? getForecastPrecipitation(`${row.title} ${row.note} ${row.mark}`) : null,
    };
  });
}

function formatForecastSequenceLabel(index: number, baseDate: Date, isCurrentContext: boolean) {
  if (index === 0 && isCurrentContext) return '지금';
  if (index === 0) return '기준';

  const itemDate = new Date(baseDate.getTime() + index * 60 * 60 * 1000);

  return formatForecastDateHourLabel(itemDate, baseDate);
}

function getForecastBaseDate(searchContext: SearchContext) {
  const now = new Date();
  const clean = `${searchContext.raw} ${searchContext.timeLabel}`.replace(/\s+/g, '');

  if (isCurrentForecastContext(searchContext)) return now;

  const dayOffset = clean.includes('모레') ? 2 : clean.includes('내일') ? 1 : 0;
  const hour = getForecastBaseHour(clean, now.getHours());

  const baseDate = new Date(now);
  baseDate.setDate(now.getDate() + dayOffset);
  baseDate.setHours(hour, 0, 0, 0);

  return baseDate;
}

function isCurrentForecastContext(searchContext: SearchContext) {
  const raw = (searchContext.raw || '').replace(/\s+/g, '');
  const label = (searchContext.timeLabel || '').replace(/\s+/g, '');

  if (searchContext.target.kind === 'current' && (!raw || raw === '현재위치')) return true;
  if (label === '지금' || label === '현재') return true;

  return false;
}

function getForecastBaseHour(cleanLabel: string, fallbackHour: number) {
  const hourMatch = cleanLabel.match(/(\d{1,2})시/);

  if (hourMatch) {
    const rawHour = Number(hourMatch[1]);

    if (Number.isFinite(rawHour)) return normalizeForecastHour(cleanLabel, rawHour);
  }

  if (cleanLabel.includes('새벽')) return 6;
  if (cleanLabel.includes('아침') || cleanLabel.includes('오전')) return 9;
  if (cleanLabel.includes('점심') || cleanLabel.includes('낮')) return 12;
  if (cleanLabel.includes('오후')) return 15;
  if (cleanLabel.includes('저녁') || cleanLabel.includes('퇴근')) return 18;
  if (cleanLabel.includes('밤')) return 21;

  return fallbackHour;
}

function normalizeForecastHour(cleanLabel: string, rawHour: number) {
  if (rawHour < 0 || rawHour > 24) return new Date().getHours();
  if ((cleanLabel.includes('오후') || cleanLabel.includes('저녁') || cleanLabel.includes('밤')) && rawHour < 12) {
    return rawHour + 12;
  }
  if ((cleanLabel.includes('오전') || cleanLabel.includes('아침') || cleanLabel.includes('새벽')) && rawHour === 12) {
    return 0;
  }

  return rawHour === 24 ? 0 : rawHour;
}

function formatForecastDateHourLabel(date: Date, baseDate: Date) {
  const hour = `${String(date.getHours()).padStart(2, '0')}시`;

  if (isSameLocalDay(date, baseDate)) return hour;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayLabel = isSameLocalDay(date, tomorrow)
    ? '내일'
    : `${date.getMonth() + 1}/${date.getDate()}`;

  return `${dayLabel}\n${hour}`;
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
  );
}

function formatReadableTimeLabel(label: string) {
  const clean = label.replace(/\s+/g, '');
  const dateHourMatch = clean.match(/^0?(\d{1,2})\/0?(\d{1,2})(\d{1,2})시$/);

  if (dateHourMatch) {
    return `${Number(dateHourMatch[1])}/${Number(dateHourMatch[2])}\n${dateHourMatch[3].padStart(2, '0')}시`;
  }

  const spacedDateHourMatch = label.match(/0?(\d{1,2})\/0?(\d{1,2})\s*(\d{1,2})시/);
  if (spacedDateHourMatch) {
    return `${Number(spacedDateHourMatch[1])}/${Number(spacedDateHourMatch[2])}\n${spacedDateHourMatch[3].padStart(2, '0')}시`;
  }

  const relativeHourMatch = clean.match(/^(오늘|내일|모레|주말)?(?:아침|오전|오후|저녁|밤|새벽|점심|낮)?(\d{1,2})시$/);
  if (relativeHourMatch) {
    return `${relativeHourMatch[1] || '오늘'}\n${relativeHourMatch[2].padStart(2, '0')}시`;
  }

  const dayPartMatch = clean.match(/^(오늘|내일|모레|주말)?(아침|오전|오후|저녁|밤|새벽|점심|낮)$/);
  if (dayPartMatch) {
    return [dayPartMatch[1], dayPartMatch[2]].filter(Boolean).join('\n');
  }

  return label.replace(/\s+/g, '\n');
}

function formatForecastTemp(value: string | number) {
  if (typeof value === 'number') return `${value}°`;

  return value.replace(/도/g, '°').replace(/\s+/g, '');
}

function getForecastPrecipitation(text: string) {
  if (!includesAny(text.toLowerCase(), ['비', '강수', '소나기', '천둥', 'rain', 'shower', 'storm'])) return null;

  const match = text.match(/\d+(?:\.\d+)?\s*mm/i);

  if (!match) return null;

  const amount = Number(match[0].replace(/mm/i, '').trim());
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return match[0].replace(/\s+/g, '');
}

function getForecastStripCondition(text: string, fallbackCondition: string) {
  return normalizeWeatherCondition(text.trim().length > 0 ? text : fallbackCondition);
}

function ForecastMiniIcon({ condition, stroke, dim }: { condition: string; stroke: string; dim: string }) {
  return <WeatherIcon condition={condition} style={styles.figmaWeatherHourIcon} />;
}

function WeatherMiniSvgIcon({ condition, stroke, dim }: { condition: string; stroke: string; dim: string }) {
  if (condition === '맑음') {
    const angles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

    return (
      <>
        <Circle cx="50" cy="50" r="22" fill={stroke} fillOpacity="0.15" />
        {angles.map((angle) => {
          const r1 = 26;
          const r2 = angle % 60 === 0 ? 36 : 31;
          const rad = (angle * Math.PI) / 180;

          return (
            <Line
              key={angle}
              x1={50 + r1 * Math.cos(rad)}
              y1={50 + r1 * Math.sin(rad)}
              x2={50 + r2 * Math.cos(rad)}
              y2={50 + r2 * Math.sin(rad)}
              stroke={stroke}
              strokeWidth={angle % 60 === 0 ? 2.2 : 1.4}
              strokeLinecap="round"
              strokeOpacity={angle % 60 === 0 ? 1 : 0.55}
            />
          );
        })}
        <Circle cx="50" cy="50" r="18" stroke={stroke} strokeWidth="2" />
        <Circle cx="50" cy="50" r="10" stroke={stroke} strokeWidth="1.6" strokeOpacity="0.4" />
      </>
    );
  }

  if (condition === '비') {
    const drops = [
      [26, 58, 23, 67],
      [36, 62, 33, 71],
      [46, 58, 43, 67],
      [56, 62, 53, 71],
      [66, 58, 63, 67],
      [31, 70, 28, 79],
      [51, 70, 48, 79],
      [71, 70, 68, 79],
    ];

    return (
      <>
        <Path
          d="M76 54 C82 54 87 49 87 43 C87 37 82 33 76 33 C75 26 68 20 60 21 C57 14 48 10 40 13 C33 11 25 17 24 25 C17 26 12 32 12 39 C12 46 18 52 25 52"
          stroke={stroke}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {drops.map(([x1, y1, x2, y2]) => (
          <Line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        ))}
      </>
    );
  }

  if (condition === '소나기') {
    return (
      <>
        <Path
          d="M74 50 C80 50 84 45 84 40 C84 35 80 31 74 31 C73 25 67 20 59 21 C56 15 48 11 40 14 C33 12 26 18 25 26 C18 27 13 33 13 40 C13 46 18 51 25 51"
          stroke={stroke}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <Circle cx="88" cy="20" r="7" stroke={stroke} strokeWidth="1.8" strokeOpacity="0.5" />
        {[30, 45, 60, 72].map((x) => (
          <Line key={x} x1={x} y1="56" x2={x - 3} y2="64" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        ))}
      </>
    );
  }

  if (condition === '천둥번개' || condition === '폭풍우') {
    return (
      <>
        <Path
          d="M76 46 C83 46 88 40 88 34 C88 28 83 23 76 23 C75 16 68 10 59 11 C56 4 47 0 39 3 C32 1 24 7 23 16 C16 17 11 23 11 31 C11 38 17 44 24 44"
          stroke={stroke}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <Path
          d="M54 46 L44 60 L50 60 L40 78 L60 58 L53 58 Z"
          stroke={stroke}
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={stroke}
          fillOpacity="0.12"
        />
        <Line x1="20" y1="48" x2="17" y2="58" stroke={dim} strokeWidth="1.5" strokeLinecap="round" />
        <Line x1="80" y1="48" x2="77" y2="58" stroke={dim} strokeWidth="1.5" strokeLinecap="round" />
      </>
    );
  }

  if (condition === '눈') {
    const flakes = [
      [24, 60, 6],
      [36, 66, 4.5],
      [50, 60, 7],
      [64, 66, 5],
      [76, 60, 4],
    ];

    return (
      <>
        <Path
          d="M74 50 C80 50 85 45 85 39 C85 33 80 29 74 29 C73 22 66 17 58 18 C55 11 46 7 38 10 C31 8 23 14 22 22 C15 23 10 29 10 36 C10 43 16 49 23 49"
          stroke={stroke}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {flakes.map(([cx, cy, r]) => (
          <G key={`${cx}-${cy}`}>
            {[0, 60, 120].map((angle) => {
              const rad = (angle * Math.PI) / 180;

              return (
                <Line
                  key={angle}
                  x1={cx - r * Math.cos(rad)}
                  y1={cy - r * Math.sin(rad)}
                  x2={cx + r * Math.cos(rad)}
                  y2={cy + r * Math.sin(rad)}
                  stroke={stroke}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              );
            })}
            <Circle cx={cx} cy={cy} r="1" fill={stroke} />
          </G>
        ))}
      </>
    );
  }

  if (condition === '안개') {
    return (
      <>
        {[
          [20, 32, 80, 0.35],
          [14, 44, 86, 0.55],
          [25, 56, 75, 0.72],
          [17, 68, 83, 0.55],
          [28, 80, 72, 0.35],
        ].map(([x1, y, x2, opacity]) => (
          <Line key={y} x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth="2.6" strokeLinecap="round" strokeOpacity={opacity} />
        ))}
      </>
    );
  }

  if (condition === '황사') {
    return (
      <>
        <Circle cx="50" cy="38" r="16" stroke={stroke} strokeWidth="2" strokeOpacity="0.4" />
        <Circle cx="50" cy="38" r="10" fill={stroke} fillOpacity="0.2" />
        {[58, 68, 78].map((y, index) => (
          <Line
            key={y}
            x1="15"
            y1={y}
            x2="85"
            y2={y}
            stroke={stroke}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeOpacity={0.5 - index * 0.08}
          />
        ))}
        {[30, 55, 70, 42, 65, 25, 80].map((cx, index) => (
          <Circle key={`${cx}-${index}`} cx={cx} cy={[45, 35, 50, 60, 68, 65, 40][index]} r={[3, 2, 2.5, 2, 3, 2, 1.5][index]} fill={stroke} fillOpacity="0.5" />
        ))}
      </>
    );
  }

  if (condition === '폭염') {
    return (
      <>
        <Circle cx="50" cy="36" r="18" fill={stroke} fillOpacity="0.2" />
        <Circle cx="50" cy="36" r="14" stroke={stroke} strokeWidth="2.2" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
          const rad = (angle * Math.PI) / 180;

          return (
            <Line
              key={angle}
              x1={50 + 18 * Math.cos(rad)}
              y1={36 + 18 * Math.sin(rad)}
              x2={50 + 26 * Math.cos(rad)}
              y2={36 + 26 * Math.sin(rad)}
              stroke={stroke}
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
        {[62, 72, 82].map((y, index) => (
          <Path
            key={y}
            d={`M18 ${y} C28 ${y - 4} 38 ${y + 4} 50 ${y} C62 ${y - 4} 72 ${y + 4} 82 ${y}`}
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
            strokeOpacity={1 - index * 0.2}
          />
        ))}
      </>
    );
  }

  if (condition === '맑은 밤') {
    return (
      <>
        <Path
          d="M55 18 C40 20 28 34 28 50 C28 66 40 80 56 80 C42 76 32 64 32 50 C32 35 44 22 58 20 C57 18.5 56 18 55 18 Z"
          stroke={stroke}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {[
          [68, 20, 3],
          [78, 38, 2],
          [60, 12, 2],
          [76, 52, 2.5],
        ].map(([cx, cy, r]) => (
          <G key={`${cx}-${cy}`}>
            <Line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
            <Line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          </G>
        ))}
      </>
    );
  }

  if (condition === '무지개') {
    return (
      <>
        {[
          [44, '#E04040'],
          [38, '#E08020'],
          [32, '#D4C000'],
          [26, '#40A040'],
          [20, '#2060C0'],
          [14, '#6020A0'],
        ].map(([radius, color]) => (
          <Path
            key={radius}
            d={`M ${50 - Number(radius)} 72 A ${radius} ${radius} 0 0 1 ${50 + Number(radius)} 72`}
            stroke={`${color}`}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        ))}
        <Circle cx="82" cy="30" r="10" stroke={stroke} strokeWidth="1.8" strokeOpacity="0.65" />
        <Path
          d="M28 55 C22 55 16 51 16 45 C16 39 22 35 28 36 C29 30 35 26 42 28 C46 22 54 24 56 30 C60 29 65 33 65 39 C65 44 60 48 55 48"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeOpacity="0.5"
        />
      </>
    );
  }

  if (condition === '태풍') {
    return (
      <>
        {[0, 90, 180, 270].map((startAngle) => (
          <Path
            key={startAngle}
            d={`M 50 50 Q ${50 + 30 * Math.cos((startAngle * Math.PI) / 180)} ${50 + 30 * Math.sin((startAngle * Math.PI) / 180)} ${50 + 42 * Math.cos(((startAngle + 60) * Math.PI) / 180)} ${50 + 42 * Math.sin(((startAngle + 60) * Math.PI) / 180)}`}
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}
        <Circle cx="50" cy="50" r="8" stroke={stroke} strokeWidth="2.2" />
        <Circle cx="50" cy="50" r="3" fill={stroke} fillOpacity="0.5" />
        <Circle cx="50" cy="50" r="38" stroke={stroke} strokeWidth="0.8" strokeOpacity="0.2" strokeDasharray="4 6" />
      </>
    );
  }

  return (
    <>
      <Path
        d="M72 62 C78 62 82 57 82 52 C82 47 78 43 72 43 C71 37 65 32 58 33 C55 27 48 23 40 26 C33 23 26 28 25 35 C19 36 15 41 15 47 C15 53 20 58 26 58"
        stroke={stroke}
        strokeWidth="1.8"
        strokeOpacity="0.35"
        strokeLinecap="round"
      />
      <Path
        d="M74 68 C80 68 85 63 85 57 C85 51 80 47 74 47 C73 40 67 34 59 35 C56 28 48 24 40 27 C33 24 25 30 24 38 C17 39 12 45 12 52 C12 59 18 65 25 65"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </>
  );
}

function WeatherLineArtwork({ condition, stroke, dim }: { condition: string; stroke: string; dim: string }) {
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const rainValues = useRef([0, 0.25, 0.1, 0.4, 0.15, 0.55, 0.35, 0.5].map(() => new Animated.Value(0))).current;
  const snowValues = useRef([0, 0.5, 0.2, 0.7, 0.35].map(() => new Animated.Value(0))).current;
  const rayValues = useRef(Array.from({ length: 12 }, () => new Animated.Value(0))).current;

  useEffect(() => {
    drift.setValue(0);
    pulse.setValue(0);
    fall.setValue(0);
    flash.setValue(0);
    spin.setValue(0);

    const driftAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );

    const fallAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(fall, {
          toValue: 1,
          duration: condition === '눈' ? 2100 : 980,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(fall, {
          toValue: 0,
          duration: 0,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]),
    );

    const flashAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(flash, {
          toValue: 1,
          duration: 90,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(flash, {
          toValue: 0,
          duration: 140,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(flash, {
          toValue: 1,
          duration: 80,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(flash, {
          toValue: 0,
          duration: 1800,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]),
    );

    const spinAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(spin, {
          toValue: 1,
          duration: condition === '태풍' ? 2200 : 5200,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.timing(spin, {
          toValue: 0,
          duration: 0,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]),
    );

    const rainAnimations = rainValues.map((value, index) => {
      value.setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.delay([0, 250, 100, 400, 150, 550, 350, 500][index]),
          Animated.timing(value, {
            toValue: 1,
            duration: condition === '소나기' ? 1400 : 1100,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
        ]),
      );
    });

    const snowAnimations = snowValues.map((value, index) => {
      value.setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.delay([0, 500, 200, 700, 350][index]),
          Animated.timing(value, {
            toValue: 1,
            duration: 2200,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
        ]),
      );
    });

    const rayAnimations = rayValues.map((value, index) => {
      value.setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(index * 80),
          Animated.timing(value, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      );
    });

    driftAnimation.start();
    pulseAnimation.start();
    fallAnimation.start();
    flashAnimation.start();
    spinAnimation.start();
    rainAnimations.forEach((animation) => animation.start());
    snowAnimations.forEach((animation) => animation.start());
    rayAnimations.forEach((animation) => animation.start());

    return () => {
      driftAnimation.stop();
      pulseAnimation.stop();
      fallAnimation.stop();
      flashAnimation.stop();
      spinAnimation.stop();
      rainAnimations.forEach((animation) => animation.stop());
      snowAnimations.forEach((animation) => animation.stop());
      rayAnimations.forEach((animation) => animation.stop());
    };
  }, [condition, drift, fall, flash, pulse, rainValues, rayValues, snowValues, spin]);

  const artMotionStyle = {
    transform: [
      {
        translateY: drift.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -6],
        }),
      },
    ],
  };

  const cloudBackStyle = {
    transform: [
      {
        translateX: drift.interpolate({
          inputRange: [0, 1],
          outputRange: [-2, 2],
        }),
      },
    ],
  };

  const cloudFrontStyle = {
    transform: [
      {
        translateX: drift.interpolate({
          inputRange: [0, 1],
          outputRange: [2, -2],
        }),
      },
    ],
  };

  const sunPulseProps = {
    r: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [18, 24],
    }),
  };

  return (
    <Animated.View style={[styles.figmaArtworkWrap, artMotionStyle]}>
      <Svg viewBox="0 0 100 100" fill="none" style={styles.figmaLineArt}>
        <WeatherSvgIcon
          condition={condition}
          stroke={stroke}
          dim={dim}
          cloudBackStyle={cloudBackStyle}
          cloudFrontStyle={cloudFrontStyle}
          flash={flash}
          pulse={pulse}
          rainValues={rainValues}
          rayValues={rayValues}
          snowValues={snowValues}
          spin={spin}
          sunPulseProps={sunPulseProps}
        />
      </Svg>
    </Animated.View>
  );
}

function WeatherSvgIcon({
  condition,
  stroke,
  dim,
  cloudBackStyle,
  cloudFrontStyle,
  flash,
  pulse,
  rainValues,
  rayValues,
  snowValues,
  spin,
  sunPulseProps,
}: {
  condition: string;
  stroke: string;
  dim: string;
  cloudBackStyle: object;
  cloudFrontStyle: object;
  flash: Animated.Value;
  pulse: Animated.Value;
  rainValues: Animated.Value[];
  rayValues: Animated.Value[];
  snowValues: Animated.Value[];
  spin: Animated.Value;
  sunPulseProps: { r: Animated.AnimatedInterpolation<number> };
}) {
  if (condition === '맑음') {
    return <SunSvgIcon stroke={stroke} rayValues={rayValues} sunPulseProps={sunPulseProps} />;
  }

  if (condition === '비') {
    return <RainSvgIcon stroke={stroke} rainValues={rainValues} />;
  }

  if (condition === '소나기') {
    return <ShowerSvgIcon stroke={stroke} rainValues={rainValues} pulse={pulse} />;
  }

  if (condition === '천둥번개' || condition === '폭풍우') {
    return <StormSvgIcon stroke={stroke} dim={dim} flash={flash} rainValues={rainValues} />;
  }

  if (condition === '눈') {
    return <SnowSvgIcon stroke={stroke} snowValues={snowValues} />;
  }

  if (condition === '안개') {
    return <FogSvgIcon stroke={stroke} pulse={pulse} />;
  }

  if (condition === '맑은 밤') {
    return <NightSvgIcon stroke={stroke} pulse={pulse} />;
  }

  if (condition === '황사') {
    return <DustSvgIcon stroke={stroke} pulse={pulse} />;
  }

  if (condition === '폭염') {
    return <HeatwaveSvgIcon stroke={stroke} pulse={pulse} rayValues={rayValues} />;
  }

  if (condition === '무지개') {
    return <RainbowSvgIcon stroke={stroke} pulse={pulse} />;
  }

  if (condition === '태풍') {
    return <TyphoonSvgIcon stroke={stroke} spin={spin} pulse={pulse} />;
  }

  return <CloudSvgIcon stroke={stroke} cloudBackStyle={cloudBackStyle} cloudFrontStyle={cloudFrontStyle} />;
}

function SunSvgIcon({
  stroke,
  rayValues,
  sunPulseProps,
}: {
  stroke: string;
  rayValues: Animated.Value[];
  sunPulseProps: { r: Animated.AnimatedInterpolation<number> };
}) {
  const angles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  return (
    <>
      <AnimatedCircle cx="50" cy="50" fill={stroke} fillOpacity="0.15" {...(sunPulseProps as any)} />
      {angles.map((angle, index) => {
        const r1 = 26;
        const r2 = angle % 60 === 0 ? 36 : 31;
        const rad = (angle * Math.PI) / 180;
        const opacity = rayValues[index].interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

        return (
          <AnimatedLine
            key={angle}
            x1={50 + r1 * Math.cos(rad)}
            y1={50 + r1 * Math.sin(rad)}
            x2={50 + r2 * Math.cos(rad)}
            y2={50 + r2 * Math.sin(rad)}
            stroke={stroke}
            strokeWidth={angle % 60 === 0 ? 2.2 : 1.4}
            strokeLinecap="round"
            strokeOpacity={opacity as any}
          />
        );
      })}
      <Circle cx="50" cy="50" r="18" stroke={stroke} strokeWidth="2" />
      <Circle cx="50" cy="50" r="10" stroke={stroke} strokeWidth="1.6" strokeOpacity="0.4" />
    </>
  );
}

function CloudSvgIcon({ stroke, cloudBackStyle, cloudFrontStyle }: { stroke: string; cloudBackStyle: object; cloudFrontStyle: object }) {
  return (
    <>
      <AnimatedPath
        d="M72 62 C78 62 82 57 82 52 C82 47 78 43 72 43 C71 37 65 32 58 33 C55 27 48 23 40 26 C33 23 26 28 25 35 C19 36 15 41 15 47 C15 53 20 58 26 58"
        stroke={stroke}
        strokeWidth="1.8"
        strokeOpacity="0.35"
        strokeLinecap="round"
        style={cloudBackStyle as any}
      />
      <AnimatedPath
        d="M74 68 C80 68 85 63 85 57 C85 51 80 47 74 47 C73 40 67 34 59 35 C56 28 48 24 40 27 C33 24 25 30 24 38 C17 39 12 45 12 52 C12 59 18 65 25 65"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
        style={cloudFrontStyle as any}
      />
    </>
  );
}

function RainSvgIcon({ stroke, rainValues }: { stroke: string; rainValues: Animated.Value[] }) {
  const drops = [
    { x: 26, d: 0 },
    { x: 36, d: 1 },
    { x: 46, d: 2 },
    { x: 56, d: 3 },
    { x: 66, d: 4 },
    { x: 31, d: 5 },
    { x: 51, d: 6 },
    { x: 71, d: 7 },
  ];

  return (
    <>
      <Path
        d="M76 54 C82 54 87 49 87 43 C87 37 82 33 76 33 C75 26 68 20 60 21 C57 14 48 10 40 13 C33 11 25 17 24 25 C17 26 12 32 12 39 C12 46 18 52 25 52"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {drops.map((drop) => (
        <AnimatedG
          key={`${drop.x}-${drop.d}`}
          style={{
            opacity: rainValues[drop.d].interpolate({ inputRange: [0, 0.18, 0.82, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ translateY: rainValues[drop.d].interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) }],
          } as any}
        >
          <Line x1={drop.x} y1="58" x2={drop.x - 3} y2="67" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </AnimatedG>
      ))}
    </>
  );
}

function StormSvgIcon({ stroke, dim, flash, rainValues }: { stroke: string; dim: string; flash: Animated.Value; rainValues: Animated.Value[] }) {
  return (
    <>
      <Path
        d="M76 46 C83 46 88 40 88 34 C88 28 83 23 76 23 C75 16 68 10 59 11 C56 4 47 0 39 3 C32 1 24 7 23 16 C16 17 11 23 11 31 C11 38 17 44 24 44"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <AnimatedPath
        d="M54 46 L44 60 L50 60 L40 78 L60 58 L53 58 Z"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill={stroke}
        fillOpacity="0.12"
        opacity={flash.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }) as any}
      />
      {[20, 80, 24].map((x, index) => (
        <AnimatedLine
          key={x}
          x1={x}
          y1={index === 2 ? 60 : 48}
          x2={x - 3}
          y2={index === 2 ? 70 : 58}
          stroke={dim}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={rainValues[index].interpolate({ inputRange: [0, 0.18, 0.82, 1], outputRange: [0, 0.9, 0.9, 0] }) as any}
        />
      ))}
    </>
  );
}

function SnowSvgIcon({ stroke, snowValues }: { stroke: string; snowValues: Animated.Value[] }) {
  const flakes = [
    { x: 24, y: 60, r: 6 },
    { x: 36, y: 66, r: 4.5 },
    { x: 50, y: 60, r: 7 },
    { x: 64, y: 66, r: 5 },
    { x: 76, y: 60, r: 4 },
  ];

  return (
    <>
      <Path
        d="M74 50 C80 50 85 45 85 39 C85 33 80 29 74 29 C73 22 66 17 58 18 C55 11 46 7 38 10 C31 8 23 14 22 22 C15 23 10 29 10 36 C10 43 16 49 23 49"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {flakes.map((flake, index) => (
        <AnimatedG
          key={`${flake.x}-${flake.y}`}
          style={{
            opacity: snowValues[index].interpolate({ inputRange: [0, 0.18, 0.78, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ translateY: snowValues[index].interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) }],
          } as any}
        >
          {[0, 60, 120].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <Line
                key={angle}
                x1={flake.x - flake.r * Math.cos(rad)}
                y1={flake.y - flake.r * Math.sin(rad)}
                x2={flake.x + flake.r * Math.cos(rad)}
                y2={flake.y + flake.r * Math.sin(rad)}
                stroke={stroke}
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            );
          })}
          <Circle cx={flake.x} cy={flake.y} r="1" fill={stroke} />
        </AnimatedG>
      ))}
    </>
  );
}

function NightSvgIcon({ stroke, pulse }: { stroke: string; pulse: Animated.Value }) {
  const moonStyle = {
    transform: [{ rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] }) }],
  };
  const stars = [
    { cx: 68, cy: 20, r: 3 },
    { cx: 78, cy: 38, r: 2 },
    { cx: 60, cy: 12, r: 2 },
    { cx: 76, cy: 52, r: 2.5 },
  ];

  return (
    <>
      <AnimatedPath
        d="M55 18 C40 20 28 34 28 50 C28 66 40 80 56 80 C42 76 32 64 32 50 C32 35 44 22 58 20 C57 18.5 56 18 55 18 Z"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        style={moonStyle as any}
      />
      {stars.map((star, index) => (
        <AnimatedG key={index} opacity={pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) as any}>
          <Line x1={star.cx - star.r} y1={star.cy} x2={star.cx + star.r} y2={star.cy} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <Line x1={star.cx} y1={star.cy - star.r} x2={star.cx} y2={star.cy + star.r} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </AnimatedG>
      ))}
    </>
  );
}

function FogSvgIcon({ stroke, pulse }: { stroke: string; pulse: Animated.Value }) {
  const lines = [
    { y: 32, w: 60, x: 20 },
    { y: 44, w: 72, x: 14 },
    { y: 56, w: 50, x: 25 },
    { y: 68, w: 66, x: 17 },
    { y: 80, w: 44, x: 28 },
  ];

  return (
    <>
      {lines.map((line, index) => (
        <AnimatedLine
          key={line.y}
          x1={line.x}
          y1={line.y}
          x2={line.x + line.w}
          y2={line.y}
          stroke={stroke}
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity={pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }) as any}
          style={{
            transform: [{ translateX: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, index % 2 === 0 ? 5 : -5] }) }],
          } as any}
        />
      ))}
    </>
  );
}

function DustSvgIcon({ stroke, pulse }: { stroke: string; pulse: Animated.Value }) {
  const particles = [
    { cx: 30, cy: 45, r: 3 },
    { cx: 55, cy: 35, r: 2 },
    { cx: 70, cy: 50, r: 2.5 },
    { cx: 42, cy: 60, r: 2 },
    { cx: 65, cy: 68, r: 3 },
    { cx: 25, cy: 65, r: 2 },
    { cx: 80, cy: 40, r: 1.5 },
  ];

  return (
    <>
      <Circle cx="50" cy="38" r="16" stroke={stroke} strokeWidth="2" strokeOpacity="0.4" />
      <AnimatedCircle cx="50" cy="38" fill={stroke} fillOpacity="0.2" r={pulse.interpolate({ inputRange: [0, 1], outputRange: [9, 12] }) as any} />
      {[58, 68, 78].map((y, index) => (
        <AnimatedLine
          key={y}
          x1="15"
          y1={y}
          x2="85"
          y2={y}
          stroke={stroke}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeOpacity="0.5"
          style={{
            transform: [{ translateX: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, index % 2 === 0 ? 4 : -4] }) }],
          } as any}
        />
      ))}
      {particles.map((particle, index) => (
        <AnimatedCircle
          key={index}
          cx={particle.cx}
          cy={particle.cy}
          r={particle.r}
          fill={stroke}
          fillOpacity={pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }) as any}
        />
      ))}
    </>
  );
}

function ShowerSvgIcon({ stroke, rainValues, pulse }: { stroke: string; rainValues: Animated.Value[]; pulse: Animated.Value }) {
  return (
    <>
      <Path
        d="M74 50 C80 50 84 45 84 40 C84 35 80 31 74 31 C73 25 67 20 59 21 C56 15 48 11 40 14 C33 12 26 18 25 26 C18 27 13 33 13 40 C13 46 18 51 25 51"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <AnimatedCircle cx="88" cy="20" r="7" stroke={stroke} strokeWidth="1.8" strokeOpacity={pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] }) as any} />
      {[30, 45, 60, 72].map((x, index) => (
        <AnimatedG
          key={x}
          style={{
            opacity: rainValues[index].interpolate({ inputRange: [0, 0.18, 0.82, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ translateY: rainValues[index].interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) }],
          } as any}
        >
          <Line x1={x} y1="56" x2={x - 3} y2="64" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </AnimatedG>
      ))}
    </>
  );
}

function HeatwaveSvgIcon({ stroke, pulse, rayValues }: { stroke: string; pulse: Animated.Value; rayValues: Animated.Value[] }) {
  return (
    <>
      <AnimatedCircle cx="50" cy="36" fill={stroke} fillOpacity="0.2" r={pulse.interpolate({ inputRange: [0, 1], outputRange: [16, 22] }) as any} />
      <Circle cx="50" cy="36" r="14" stroke={stroke} strokeWidth="2.2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, index) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <AnimatedLine
            key={angle}
            x1={50 + 18 * Math.cos(rad)}
            y1={36 + 18 * Math.sin(rad)}
            x2={50 + 26 * Math.cos(rad)}
            y2={36 + 26 * Math.sin(rad)}
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
            opacity={rayValues[index].interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) as any}
          />
        );
      })}
      {[62, 72, 82].map((y, index) => (
        <AnimatedPath
          key={y}
          d={`M18 ${y} C28 ${y - 4} 38 ${y + 4} 50 ${y} C62 ${y - 4} 72 ${y + 4} 82 ${y}`}
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          opacity={pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }) as any}
          style={{
            transform: [{ translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -3 - index] }) }],
          } as any}
        />
      ))}
    </>
  );
}

function RainbowSvgIcon({ stroke, pulse }: { stroke: string; pulse: Animated.Value }) {
  const arcs = [
    { r: 44, c: '#E04040' },
    { r: 38, c: '#E08020' },
    { r: 32, c: '#D4C000' },
    { r: 26, c: '#40A040' },
    { r: 20, c: '#2060C0' },
    { r: 14, c: '#6020A0' },
  ];

  return (
    <>
      {arcs.map((arc) => (
        <AnimatedPath
          key={arc.r}
          d={`M ${50 - arc.r} 72 A ${arc.r} ${arc.r} 0 0 1 ${50 + arc.r} 72`}
          stroke={arc.c}
          strokeWidth="1.4"
          strokeOpacity={pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) as any}
        />
      ))}
      <AnimatedCircle cx="82" cy="30" r="10" stroke={stroke} strokeWidth="1.8" strokeOpacity={pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) as any} />
      <Path
        d="M28 55 C22 55 16 51 16 45 C16 39 22 35 28 36 C29 30 35 26 42 28 C46 22 54 24 56 30 C60 29 65 33 65 39 C65 44 60 48 55 48"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
    </>
  );
}

function TyphoonSvgIcon({ stroke, spin, pulse }: { stroke: string; spin: Animated.Value; pulse: Animated.Value }) {
  const rotateStyle = {
    transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
  };

  return (
    <>
      <AnimatedG style={rotateStyle as any}>
        {[0, 90, 180, 270].map((startAngle) => (
          <Path
            key={startAngle}
            d={`M 50 50 Q ${50 + 30 * Math.cos((startAngle * Math.PI) / 180)} ${50 + 30 * Math.sin((startAngle * Math.PI) / 180)} ${50 + 42 * Math.cos(((startAngle + 60) * Math.PI) / 180)} ${50 + 42 * Math.sin(((startAngle + 60) * Math.PI) / 180)}`}
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}
      </AnimatedG>
      <Circle cx="50" cy="50" r="8" stroke={stroke} strokeWidth="2.2" />
      <AnimatedCircle cx="50" cy="50" fill={stroke} fillOpacity="0.5" r={pulse.interpolate({ inputRange: [0, 1], outputRange: [2.4, 3.6] }) as any} />
      <Circle cx="50" cy="50" r="38" stroke={stroke} strokeWidth="0.8" strokeOpacity="0.2" strokeDasharray="4 6" />
    </>
  );
}

function WeatherMotionLayer({
  condition,
  stroke,
  dim,
  fall,
  flash,
  pulse,
  spin,
}: {
  condition: string;
  stroke: string;
  dim: string;
  fall: Animated.Value;
  flash: Animated.Value;
  pulse: Animated.Value;
  spin: Animated.Value;
}) {
  const fallStyle = {
    opacity: fall.interpolate({
      inputRange: [0, 0.18, 0.82, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [
      {
        translateY: fall.interpolate({
          inputRange: [0, 1],
          outputRange: [-18, 24],
        }),
      },
    ],
  };

  const slowFloat = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.42, 0.9],
    }),
    transform: [
      {
        translateX: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [-8, 8],
        }),
      },
    ],
  };

  const spinStyle = {
    transform: [
      {
        rotate: spin.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  if (condition === '비' || condition === '소나기') {
    return (
      <Animated.View pointerEvents="none" style={[styles.figmaMotionLayer, fallStyle]}>
        {[0, 1, 2, 3, 4].map((index) => (
          <View
            key={index}
            style={[
              styles.figmaMotionRainDrop,
              {
                left: 46 + index * 19,
                top: 92 + (index % 2) * 12,
                backgroundColor: stroke,
                opacity: condition === '소나기' ? 0.9 : 0.72,
              },
            ]}
          />
        ))}
      </Animated.View>
    );
  }

  if (condition === '눈') {
    return (
      <Animated.View pointerEvents="none" style={[styles.figmaMotionLayer, fallStyle]}>
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <View
            key={index}
            style={[
              styles.figmaMotionSnowDot,
              {
                left: 30 + index * 20,
                top: 76 + (index % 3) * 18,
                backgroundColor: stroke,
                opacity: 0.72,
              },
            ]}
          />
        ))}
      </Animated.View>
    );
  }

  if (condition === '천둥번개' || condition === '폭풍우') {
    return (
      <Animated.View pointerEvents="none" style={[styles.figmaMotionLayer, { opacity: flash }]}>
        <View style={[styles.figmaMotionFlash, { backgroundColor: dim }]} />
      </Animated.View>
    );
  }

  if (condition === '안개' || condition === '황사') {
    return (
      <Animated.View pointerEvents="none" style={[styles.figmaMotionLayer, slowFloat]}>
        <View style={[styles.figmaMotionFogLine, { top: 62, backgroundColor: stroke }]} />
        <View style={[styles.figmaMotionFogLine, styles.figmaMotionFogLineShort, { top: 98, backgroundColor: stroke }]} />
        <View style={[styles.figmaMotionFogLine, { top: 134, backgroundColor: stroke, opacity: 0.36 }]} />
      </Animated.View>
    );
  }

  if (condition === '태풍') {
    return (
      <Animated.View pointerEvents="none" style={[styles.figmaMotionTyphoon, spinStyle]}>
        <View style={[styles.figmaMotionTyphoonRing, { borderColor: stroke }]} />
      </Animated.View>
    );
  }

  if (condition === '폭염' || condition === '맑음' || condition === '맑은 밤') {
    return (
      <Animated.View pointerEvents="none" style={[styles.figmaMotionHalo, { borderColor: stroke, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.28] }) }]} />
    );
  }

  return null;
}

function createWeatherSvgDataUri(condition: string, stroke: string, dim: string) {
  return `data:image/svg+xml;base64,${toBase64(createWeatherSvg(condition, stroke, dim))}`;
}

function createWeatherSvg(condition: string, stroke: string, dim: string) {
  const safeStroke = escapeSvgColor(stroke);
  const safeDim = escapeSvgColor(dim);

  if (condition === '맑음') return createSunSvg(safeStroke);
  if (condition === '맑은 밤') return createNightSvg(safeStroke);
  if (condition === '비') return createRainSvg(safeStroke);
  if (condition === '소나기') return createShowerSvg(safeStroke);
  if (condition === '천둥번개' || condition === '폭풍우') return createStormSvg(safeStroke, safeDim);
  if (condition === '눈') return createSnowSvg(safeStroke);
  if (condition === '안개') return createFogSvg(safeStroke);
  if (condition === '황사') return createDustSvg(safeStroke);
  if (condition === '폭염') return createHeatwaveSvg(safeStroke);
  if (condition === '무지개') return createRainbowSvg(safeStroke);
  if (condition === '태풍') return createTyphoonSvg(safeStroke);

  return createCloudSvg(safeStroke);
}

function createSvgFrame(content: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 100 100" fill="none">${content}</svg>`;
}

function createSunSvg(stroke: string) {
  const rays = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
    .map((angle) => {
      const r1 = 26;
      const r2 = angle % 60 === 0 ? 36 : 31;
      const rad = (angle * Math.PI) / 180;
      const x1 = 50 + r1 * Math.cos(rad);
      const y1 = 50 + r1 * Math.sin(rad);
      const x2 = 50 + r2 * Math.cos(rad);
      const y2 = 50 + r2 * Math.sin(rad);
      const width = angle % 60 === 0 ? 2.2 : 1.4;
      const opacity = angle % 60 === 0 ? 1 : 0.55;

      return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-opacity="${opacity}"/>`;
    })
    .join('');

  return createSvgFrame(`
    <circle cx="50" cy="50" r="22" fill="${stroke}" fill-opacity="0.15"/>
    ${rays}
    <circle cx="50" cy="50" r="18" stroke="${stroke}" stroke-width="2"/>
    <circle cx="50" cy="50" r="10" stroke="${stroke}" stroke-width="1.6" stroke-opacity="0.4"/>
  `);
}

function createCloudSvg(stroke: string) {
  return createSvgFrame(`
    <path d="M72 62 C78 62 82 57 82 52 C82 47 78 43 72 43 C71 37 65 32 58 33 C55 27 48 23 40 26 C33 23 26 28 25 35 C19 36 15 41 15 47 C15 53 20 58 26 58" stroke="${stroke}" stroke-width="1.8" stroke-opacity="0.35" stroke-linecap="round"/>
    <path d="M74 68 C80 68 85 63 85 57 C85 51 80 47 74 47 C73 40 67 34 59 35 C56 28 48 24 40 27 C33 24 25 30 24 38 C17 39 12 45 12 52 C12 59 18 65 25 65" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
  `);
}

function createRainSvg(stroke: string) {
  const drops = [
    [26, 58, 23, 67],
    [36, 62, 33, 71],
    [46, 58, 43, 67],
    [56, 62, 53, 71],
    [66, 58, 63, 67],
    [31, 70, 28, 79],
    [51, 70, 48, 79],
    [71, 70, 68, 79],
  ]
    .map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>`)
    .join('');

  return createSvgFrame(`
    <path d="M76 54 C82 54 87 49 87 43 C87 37 82 33 76 33 C75 26 68 20 60 21 C57 14 48 10 40 13 C33 11 25 17 24 25 C17 26 12 32 12 39 C12 46 18 52 25 52" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
    ${drops}
  `);
}

function createStormSvg(stroke: string, dim: string) {
  return createSvgFrame(`
    <path d="M76 46 C83 46 88 40 88 34 C88 28 83 23 76 23 C75 16 68 10 59 11 C56 4 47 0 39 3 C32 1 24 7 23 16 C16 17 11 23 11 31 C11 38 17 44 24 44" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M54 46 L44 60 L50 60 L40 78 L60 58 L53 58 Z" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" fill="${stroke}" fill-opacity="0.12"/>
    <line x1="20" y1="48" x2="17" y2="58" stroke="${dim}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="80" y1="48" x2="77" y2="58" stroke="${dim}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="24" y1="60" x2="21" y2="70" stroke="${dim}" stroke-width="1.5" stroke-linecap="round"/>
  `);
}

function createSnowSvg(stroke: string) {
  const flakes = [
    [24, 60, 6],
    [36, 66, 4.5],
    [50, 60, 7],
    [64, 66, 5],
    [76, 60, 4],
  ]
    .map(([cx, cy, r]) => createSnowFlake(cx, cy, r, stroke))
    .join('');

  return createSvgFrame(`
    <path d="M74 50 C80 50 85 45 85 39 C85 33 80 29 74 29 C73 22 66 17 58 18 C55 11 46 7 38 10 C31 8 23 14 22 22 C15 23 10 29 10 36 C10 43 16 49 23 49" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
    ${flakes}
  `);
}

function createFogSvg(stroke: string) {
  return createSvgFrame(`
    <line x1="20" y1="32" x2="80" y2="32" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round" stroke-opacity="0.35"/>
    <line x1="14" y1="44" x2="86" y2="44" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round" stroke-opacity="0.55"/>
    <line x1="25" y1="56" x2="75" y2="56" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round" stroke-opacity="0.72"/>
    <line x1="17" y1="68" x2="83" y2="68" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round" stroke-opacity="0.55"/>
    <line x1="28" y1="80" x2="72" y2="80" stroke="${stroke}" stroke-width="2.6" stroke-linecap="round" stroke-opacity="0.35"/>
  `);
}

function createNightSvg(stroke: string) {
  return createSvgFrame(`
    <path d="M55 18 C40 20 28 34 28 50 C28 66 40 80 56 80 C42 76 32 64 32 50 C32 35 44 22 58 20 C57 18.5 56 18 55 18 Z" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round"/>
    ${[
      [68, 20, 3],
      [78, 38, 2],
      [60, 12, 2],
      [76, 52, 2.5],
    ]
      .map(([cx, cy, r]) => `<line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/><line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>`)
      .join('')}
  `);
}

function createDustSvg(stroke: string) {
  const particles = [
    [30, 45, 3],
    [55, 35, 2],
    [70, 50, 2.5],
    [42, 60, 2],
    [65, 68, 3],
    [25, 65, 2],
    [80, 40, 1.5],
  ]
    .map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${stroke}" fill-opacity="0.5"/>`)
    .join('');

  return createSvgFrame(`
    <circle cx="50" cy="38" r="16" stroke="${stroke}" stroke-width="2" stroke-opacity="0.4"/>
    <circle cx="50" cy="38" r="10" fill="${stroke}" fill-opacity="0.2"/>
    <line x1="15" y1="58" x2="85" y2="58" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.5"/>
    <line x1="15" y1="68" x2="85" y2="68" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.42"/>
    <line x1="15" y1="78" x2="85" y2="78" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-opacity="0.34"/>
    ${particles}
  `);
}

function createShowerSvg(stroke: string) {
  const drops = [
    [30, 56, 27, 64],
    [45, 56, 42, 64],
    [60, 56, 57, 64],
    [72, 56, 69, 64],
  ]
    .map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>`)
    .join('');

  return createSvgFrame(`
    <path d="M74 50 C80 50 84 45 84 40 C84 35 80 31 74 31 C73 25 67 20 59 21 C56 15 48 11 40 14 C33 12 26 18 25 26 C18 27 13 33 13 40 C13 46 18 51 25 51" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="88" cy="20" r="7" stroke="${stroke}" stroke-width="1.8" stroke-opacity="0.5"/>
    ${drops}
  `);
}

function createHeatwaveSvg(stroke: string) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315]
    .map((angle) => {
      const rad = (angle * Math.PI) / 180;
      return `<line x1="${(50 + 18 * Math.cos(rad)).toFixed(2)}" y1="${(36 + 18 * Math.sin(rad)).toFixed(2)}" x2="${(50 + 26 * Math.cos(rad)).toFixed(2)}" y2="${(36 + 26 * Math.sin(rad)).toFixed(2)}" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>`;
    })
    .join('');

  return createSvgFrame(`
    <circle cx="50" cy="36" r="18" fill="${stroke}" fill-opacity="0.2"/>
    <circle cx="50" cy="36" r="14" stroke="${stroke}" stroke-width="2.2"/>
    ${rays}
    <path d="M18 62 C28 58 38 66 50 62 C62 58 72 66 82 62" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>
    <path d="M18 72 C28 68 38 76 50 72 C62 68 72 76 82 72" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-opacity="0.72"/>
    <path d="M18 82 C28 78 38 86 50 82 C62 78 72 86 82 82" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-opacity="0.54"/>
  `);
}

function createRainbowSvg(stroke: string) {
  const arcs = [
    [44, '#e04040'],
    [38, '#e08020'],
    [32, '#d4c000'],
    [26, '#40a040'],
    [20, '#2060c0'],
    [14, '#6020a0'],
  ]
    .map(([radius, color]) => `<path d="M ${50 - Number(radius)} 72 A ${radius} ${radius} 0 0 1 ${50 + Number(radius)} 72" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`)
    .join('');

  return createSvgFrame(`
    ${arcs}
    <circle cx="82" cy="30" r="10" stroke="${stroke}" stroke-width="1.8" stroke-opacity="0.65"/>
    <path d="M28 55 C22 55 16 51 16 45 C16 39 22 35 28 36 C29 30 35 26 42 28 C46 22 54 24 56 30 C60 29 65 33 65 39 C65 44 60 48 55 48" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-opacity="0.5"/>
  `);
}

function createTyphoonSvg(stroke: string) {
  return createSvgFrame(`
    <path d="M50 50 Q80 50 71 86" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M50 50 Q50 80 14 71" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M50 50 Q20 50 29 14" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M50 50 Q50 20 86 29" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="50" cy="50" r="8" stroke="${stroke}" stroke-width="2.2"/>
    <circle cx="50" cy="50" r="3" fill="${stroke}" fill-opacity="0.5"/>
    <circle cx="50" cy="50" r="38" stroke="${stroke}" stroke-width="0.8" stroke-opacity="0.2" stroke-dasharray="4 6"/>
  `);
}

function createSnowFlake(cx: number, cy: number, r: number, stroke: string) {
  return [0, 60, 120]
    .map((angle) => {
      const rad = (angle * Math.PI) / 180;
      const x1 = cx - r * Math.cos(rad);
      const y1 = cy - r * Math.sin(rad);
      const x2 = cx + r * Math.cos(rad);
      const y2 = cy + r * Math.sin(rad);

      return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="1.1" stroke-linecap="round"/>`;
    })
    .join('') + `<circle cx="${cx}" cy="${cy}" r="1" fill="${stroke}"/>`;
}

function escapeSvgColor(color: string) {
  return color.replace(/"/g, '');
}

function toBase64(input: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let index = 0;

  while (index < input.length) {
    const chr1 = input.charCodeAt(index++);
    const chr2 = input.charCodeAt(index++);
    const chr3 = input.charCodeAt(index++);
    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    let enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    let enc4 = chr3 & 63;

    if (Number.isNaN(chr2)) {
      enc3 = 64;
      enc4 = 64;
    } else if (Number.isNaN(chr3)) {
      enc4 = 64;
    }

    output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
  }

  return output;
}

function CloudLines({ stroke }: { stroke: string }) {
  return (
    <View style={styles.figmaCloudArt}>
      <View style={[styles.figmaCloudCircle, styles.figmaCloudLeft, { borderColor: stroke }]} />
      <View style={[styles.figmaCloudCircle, styles.figmaCloudCenter, { borderColor: stroke }]} />
      <View style={[styles.figmaCloudCircle, styles.figmaCloudRight, { borderColor: stroke }]} />
      <View style={[styles.figmaCloudBase, { borderColor: stroke }]} />
    </View>
  );
}

function RainLines({ stroke, compact = false }: { stroke: string; compact?: boolean }) {
  return (
    <View style={[styles.figmaRainGroup, compact && styles.figmaRainGroupCompact]}>
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          style={[
            styles.figmaRainLine,
            { backgroundColor: stroke },
            index === 1 && styles.figmaRainLineTwo,
            index === 2 && styles.figmaRainLineThree,
            index === 3 && styles.figmaRainLineFour,
          ]}
        />
      ))}
    </View>
  );
}

function getPosterPreset(condition: string) {
  if (condition === '맑음') return { background: '#f4f3df', dark: false, label: 'Clear' };
  if (condition === '비') return { background: '#203947', dark: true, label: 'Rain Signal' };
  if (condition === '천둥번개') return { background: '#191b1d', dark: true, label: 'Storm Alert' };
  if (condition === '눈') return { background: '#8fc0d8', dark: false, label: 'Snow' };
  if (condition === '안개') return { background: '#cc6e77', dark: false, label: 'Fog' };

  return { background: '#be6262', dark: false, label: 'Cloud' };
}

function WeatherArtwork({ condition }: { condition: string }) {
  const drift = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    drift.setValue(0);
    flash.setValue(1);

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [condition, drift, flash]);

  const weatherFloatStyle = {
    transform: [
      {
        translateY: drift.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -7],
        }),
      },
      {
        translateX: drift.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 4],
        }),
      },
    ],
  };

  return (
    <Animated.View style={[styles.posterWeatherArt, weatherFloatStyle]}>
      <Image
        accessibilityLabel={`${condition} 날씨 그래픽`}
        resizeMode="contain"
        source={getPosterWeatherSource(condition)}
        style={[styles.posterWeatherImage, getPosterWeatherImageStyle(condition)]}
      />
    </Animated.View>
  );
}

function getPosterWeatherSource(condition: string) {
  if (condition === '맑음') return require('../../assets/poster-weather-clear.png');
  if (condition === '비') return require('../../assets/poster-weather-rain.png');
  if (condition === '천둥번개') return require('../../assets/poster-weather-storm.png');
  if (condition === '눈') return require('../../assets/poster-weather-snow.png');
  if (condition === '안개') return require('../../assets/poster-weather-fog.png');

  return require('../../assets/poster-weather-cloud.png');
}

function getPosterWeatherImageStyle(condition: string) {
  if (condition === '맑음') return styles.posterWeatherClear;
  if (condition === '비') return styles.posterWeatherRain;
  if (condition === '천둥번개') return styles.posterWeatherStorm;
  if (condition === '눈') return styles.posterWeatherSnow;
  if (condition === '안개') return styles.posterWeatherFog;

  return styles.posterWeatherCloud;
}

function SoftSampleGraphic({
  sampleKey,
  pulseStyle,
  fallStyle,
  flash,
}: {
  sampleKey: SoftSampleKey;
  pulseStyle: object;
  fallStyle: object;
  flash: Animated.Value;
}) {
  if (sampleKey === 'sun') {
    return (
      <Animated.View style={[styles.softSampleSunGroup, pulseStyle]}>
        <View style={[styles.softSampleRay, styles.softSampleRayTop]} />
        <View style={[styles.softSampleRay, styles.softSampleRayRight]} />
        <View style={[styles.softSampleRay, styles.softSampleRayBottom]} />
        <View style={[styles.softSampleRay, styles.softSampleRayLeft]} />
        <View style={[styles.softSampleRay, styles.softSampleRayTopLeft]} />
        <View style={[styles.softSampleRay, styles.softSampleRayTopRight]} />
        <View style={[styles.softSampleRay, styles.softSampleRayBottomRight]} />
        <View style={[styles.softSampleRay, styles.softSampleRayBottomLeft]} />
        <View style={styles.softSampleSunCore} />
      </Animated.View>
    );
  }

  return (
    <>
      <Animated.View style={[styles.softSampleCloudWhite, pulseStyle]} />
      <Animated.View
        style={[
          styles.softSampleCloudCircle,
          sampleKey === 'rain' && styles.softSampleCloudCircleRain,
          sampleKey === 'thunder' && styles.softSampleCloudCircleThunder,
          sampleKey === 'snow' && styles.softSampleCloudCircleSnow,
          sampleKey === 'fog' && styles.softSampleCloudCircleFog,
          pulseStyle,
        ]}
      />

      {(sampleKey === 'rain' || sampleKey === 'thunder') && (
        <Animated.View style={[styles.softSampleRainLines, fallStyle]}>
          <View style={styles.softSampleRainLine} />
          <View style={[styles.softSampleRainLine, styles.softSampleRainLineMiddle]} />
          <View style={[styles.softSampleRainLine, styles.softSampleRainLineLast]} />
        </Animated.View>
      )}

      {sampleKey === 'thunder' && (
        <Animated.View style={[styles.softSampleBolt, { opacity: flash }]}>
          <View style={styles.softSampleBoltTop} />
          <View style={styles.softSampleBoltBottom} />
        </Animated.View>
      )}

      {sampleKey === 'snow' && (
        <>
          <View style={[styles.softSampleSnowDot, styles.softSampleSnowDotOne]} />
          <View style={[styles.softSampleSnowDot, styles.softSampleSnowDotTwo]} />
          <View style={[styles.softSampleSnowDot, styles.softSampleSnowDotThree]} />
          <View style={[styles.softSampleSnowDot, styles.softSampleSnowDotFour]} />
        </>
      )}

      {sampleKey === 'fog' && (
        <View style={styles.softSampleFogLines}>
          <View style={[styles.softSampleFogLine, styles.softSampleFogLineOne]} />
          <View style={[styles.softSampleFogLine, styles.softSampleFogLineTwo]} />
          <View style={[styles.softSampleFogLine, styles.softSampleFogLineThree]} />
        </View>
      )}
    </>
  );
}

type SoftSampleKey = 'sun' | 'cloud' | 'rain' | 'thunder' | 'snow' | 'fog';

function getSoftSample(condition: string): {
  background: string;
  dark?: boolean;
  key: SoftSampleKey;
  label: string;
  subLabel: string;
} {
  if (condition === '맑음') {
    return { background: '#e7ea64', key: 'sun', label: '맑음', subLabel: 'clear' };
  }
  if (condition === '비') {
    return { background: '#66b9df', key: 'rain', label: '비', subLabel: 'rain' };
  }
  if (condition === '천둥번개') {
    return { background: '#292533', dark: true, key: 'thunder', label: '천둥', subLabel: 'storm' };
  }
  if (condition === '눈') {
    return { background: '#dcecf3', key: 'snow', label: '눈', subLabel: 'snow' };
  }
  if (condition === '안개') {
    return { background: '#d8d0c4', key: 'fog', label: '안개', subLabel: 'fog' };
  }

  return { background: '#bbc5bb', key: 'cloud', label: '흐림', subLabel: 'overcast' };
}
