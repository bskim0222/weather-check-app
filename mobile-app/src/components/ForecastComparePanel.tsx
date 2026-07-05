import { Pressable, ScrollView, Text, View } from 'react-native';

import { ProviderServiceIcon } from './ProviderServiceIcon';
import { WeatherIcon } from './WeatherIcon';
import type { CompareMode } from '../domain/compare';
import { styles } from '../styles/appStyles';
import type { CompareForecastCell, CompareRow, CompareServiceSummary, SearchContext } from '../types/weather';

const fallbackServices: CompareServiceSummary[] = [
  { name: '대한민국 기상청', mark: 'K', subtitle: 'KMA', summary: '', weather: '', value: '', color: '#e6465f' },
  { name: '노르웨이 기상청', mark: 'Yr', subtitle: 'MET Norway', summary: '', weather: '', value: '', color: '#65a6ff' },
  { name: '핀란드 기상청', mark: 'FMI', subtitle: 'FMI', summary: '', weather: '', value: '', color: '#7f9f8d' },
];

type ForecastComparePanelProps = {
  caption: string;
  mode: CompareMode;
  rows: CompareRow[];
  searchContext: SearchContext;
  services: CompareServiceSummary[];
  onModeChange: (mode: CompareMode) => void;
};

export function ForecastComparePanel({
  caption,
  mode,
  rows,
  searchContext,
  services,
  onModeChange,
}: ForecastComparePanelProps) {
  const visibleServices = services.length >= 3 ? services.slice(0, 3) : fallbackServices;
  const displayRows = mode === 'hourly' ? normalizeHourlyLabels(rows, searchContext) : rows;

  return (
    <>
      <View style={styles.compareMode}>
        <Pressable
          onPress={() => onModeChange('hourly')}
          style={[styles.compareModeButton, mode === 'hourly' && styles.compareModeButtonActive]}
        >
          <Text style={[styles.compareModeText, mode === 'hourly' && styles.compareModeTextActive]}>
            시간별
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onModeChange('daily')}
          style={[styles.compareModeButton, mode === 'daily' && styles.compareModeButtonActive]}
        >
          <Text style={[styles.compareModeText, mode === 'daily' && styles.compareModeTextActive]}>
            날짜별
          </Text>
        </Pressable>
      </View>

      <View style={styles.comparePanel}>
        <View style={styles.comparePanelTitle}>
          <Text style={styles.comparePanelHeading}>
            {mode === 'hourly' ? '시간대별 예보 비교' : '날짜별 예보 비교'}
          </Text>
          <Text style={styles.comparePanelCaption}>{caption}</Text>
        </View>

        <View style={styles.compareTableFrame}>
          <View style={styles.compareTableServiceColumn}>
            <View style={styles.compareTableCorner}>
              <Text style={styles.compareTableCornerText}>{mode === 'hourly' ? '시간' : '날짜'}</Text>
            </View>
            {visibleServices.map((service) => (
              <CompareServiceLabel key={service.name} service={service} />
            ))}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.compareTableScrollContent}
          >
            {displayRows.map((row) => (
              <CompareForecastColumn key={row.label} row={row} mode={mode} />
            ))}
          </ScrollView>
        </View>
      </View>
    </>
  );
}

function normalizeHourlyLabels(rows: CompareRow[], searchContext: SearchContext) {
  const baseDate = getCompareBaseDate(searchContext);
  const isCurrentContext = isCurrentCompareContext(searchContext);

  return rows.map((row, index) => ({
    ...row,
    label: formatCompareHourLabel(index, baseDate, isCurrentContext),
  }));
}

function formatCompareHourLabel(index: number, baseDate: Date, isCurrentContext: boolean) {
  if (index === 0 && isCurrentContext) return '지금';
  if (index === 0) return '기준';

  const itemDate = new Date(baseDate.getTime() + index * 60 * 60 * 1000);
  const hour = `${String(itemDate.getHours()).padStart(2, '0')}시`;

  if (isSameLocalDay(itemDate, baseDate)) return hour;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayLabel = isSameLocalDay(itemDate, tomorrow)
    ? '내일'
    : `${itemDate.getMonth() + 1}/${itemDate.getDate()}`;

  return `${dayLabel}\n${hour}`;
}

function getCompareBaseDate(searchContext: SearchContext) {
  const now = new Date();
  const clean = `${searchContext.raw} ${searchContext.timeLabel}`.replace(/\s+/g, '');

  if (isCurrentCompareContext(searchContext)) return now;

  const dayOffset = clean.includes('모레') ? 2 : clean.includes('내일') ? 1 : 0;
  const hour = getCompareBaseHour(clean, now.getHours());
  const baseDate = new Date(now);
  baseDate.setDate(now.getDate() + dayOffset);
  baseDate.setHours(hour, 0, 0, 0);

  return baseDate;
}

function isCurrentCompareContext(searchContext: SearchContext) {
  const raw = (searchContext.raw || '').replace(/\s+/g, '');
  const label = (searchContext.timeLabel || '').replace(/\s+/g, '');

  if (searchContext.target.kind === 'current' && (!raw || raw === '현재위치')) return true;
  return label === '지금' || label === '현재';
}

function getCompareBaseHour(cleanLabel: string, fallbackHour: number) {
  const hourMatch = cleanLabel.match(/(\d{1,2})시/);

  if (hourMatch) {
    const rawHour = Number(hourMatch[1]);

    if (Number.isFinite(rawHour)) return normalizeCompareHour(cleanLabel, rawHour);
  }

  if (cleanLabel.includes('새벽')) return 6;
  if (cleanLabel.includes('아침') || cleanLabel.includes('오전')) return 9;
  if (cleanLabel.includes('점심') || cleanLabel.includes('낮')) return 12;
  if (cleanLabel.includes('오후')) return 15;
  if (cleanLabel.includes('저녁') || cleanLabel.includes('퇴근')) return 18;
  if (cleanLabel.includes('밤')) return 21;

  return fallbackHour;
}

function normalizeCompareHour(cleanLabel: string, rawHour: number) {
  if (rawHour < 0 || rawHour > 24) return new Date().getHours();
  if ((cleanLabel.includes('오후') || cleanLabel.includes('저녁') || cleanLabel.includes('밤')) && rawHour < 12) {
    return rawHour + 12;
  }
  if ((cleanLabel.includes('오전') || cleanLabel.includes('아침') || cleanLabel.includes('새벽')) && rawHour === 12) {
    return 0;
  }

  return rawHour === 24 ? 0 : rawHour;
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
  );
}

function CompareServiceLabel({ service }: { service: CompareServiceSummary }) {
  const label = normalizeServiceName(service.name);

  return (
    <View style={styles.compareTableServiceCell}>
      <ProviderServiceIcon mark={service.mark} name={service.name} style={styles.compareTableServiceIcon} />
      <Text style={styles.compareTableServiceText}>{label}</Text>
    </View>
  );
}

function CompareForecastColumn({ row, mode }: { row: CompareRow; mode: CompareMode }) {
  return (
    <View style={[styles.compareForecastColumn, mode === 'daily' && styles.compareForecastColumnDaily]}>
      <View style={styles.compareForecastColumnHead}>
        <Text style={styles.compareForecastColumnLabel}>{row.label}</Text>
      </View>
      <CompareForecastCellView cell={row.kma} mode={mode} />
      <CompareForecastCellView cell={row.yr} mode={mode} />
      <CompareForecastCellView cell={row.windy} mode={mode} />
    </View>
  );
}

function CompareForecastCellView({ cell, mode }: { cell: CompareForecastCell; mode: CompareMode }) {
  if (mode === 'daily') {
    return (
      <View style={[styles.compareForecastCell, styles.compareForecastCellDaily]}>
        <View style={styles.compareDailyPeriods}>
          <CompareDailyPeriod label="오전" period={cell.morning ?? cell} />
          <CompareDailyPeriod label="오후" period={cell.afternoon ?? cell} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.compareForecastCell}>
      <View style={styles.compareForecastIconFrame}>
        <WeatherMiniIcon condition={cell.weather} />
      </View>
      <View style={styles.compareForecastTextBox}>
        <Text style={styles.compareForecastWeather}>{cell.weather}</Text>
        <Text style={styles.compareForecastDetail}>{cell.detail}</Text>
      </View>
    </View>
  );
}

function CompareDailyPeriod({
  label,
  period,
}: {
  label: string;
  period: Pick<CompareForecastCell, 'weather' | 'detail'>;
}) {
  return (
    <View style={styles.compareDailyPeriod}>
      <Text style={styles.compareDailyPeriodLabel}>{label}</Text>
      <WeatherMiniIcon condition={period.weather} />
      <Text style={styles.compareDailyPeriodDetail}>{formatDailyPeriodDetail(period.detail)}</Text>
    </View>
  );
}

function formatDailyPeriodDetail(detail: string) {
  const parts = detail.split('·').map((part) => part.trim()).filter(Boolean);
  const temp = parts.find((part) => /-?\d+\s*도/.test(part)) ?? parts[0] ?? '';
  const precipitation = parts.find((part) => /mm|%/.test(part) && part !== temp);

  return precipitation ? `${temp}\n${precipitation}` : temp;
}

function WeatherMiniIcon({ condition }: { condition: string }) {
  return <WeatherIcon condition={condition} style={styles.compareForecastWeatherSvg} />;
}

function normalizeServiceName(name: string) {
  if (name === '기상청') return '대한민국 기상청';
  if (name === 'Yr.no') return '노르웨이 기상청';
  if (name === 'FMI ECMWF') return '핀란드 기상청';

  return name;
}
