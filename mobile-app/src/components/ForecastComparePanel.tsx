import { Pressable, Text, View } from 'react-native';

import { ProviderServiceIcon } from './ProviderServiceIcon';
import { WeatherIcon } from './WeatherIcon';
import type { CompareMode } from '../domain/compare';
import { getThirdProviderCell } from '../domain/providerRows';
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
  const previewRows = mode === 'hourly' ? displayRows.slice(0, 12) : displayRows.slice(0, 7);

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
            {mode === 'hourly' ? '시간별 예보 비교' : '날짜별 예보 비교'}
          </Text>
          <Text style={styles.comparePanelCaption}>{caption}</Text>
        </View>

        <View style={styles.compareMomentList}>
          {previewRows.map((row) => (
            <CompareMomentCard
              key={row.label}
              mode={mode}
              row={row}
              services={visibleServices}
            />
          ))}
        </View>
      </View>
    </>
  );
}

function CompareMomentCard({
  mode,
  row,
  services,
}: {
  mode: CompareMode;
  row: CompareRow;
  services: CompareServiceSummary[];
}) {
  return (
    <View style={styles.compareMomentCard}>
      <View style={styles.compareMomentHeader}>
        <Text style={styles.compareMomentLabel}>{row.label}</Text>
        <Text style={styles.compareMomentHint}>
          {mode === 'hourly' ? '세 예보사 시간별 비교' : '세 예보사 오전/오후 비교'}
        </Text>
      </View>

      <View style={styles.compareMomentServiceList}>
        {services.map((service, serviceIndex) => (
          mode === 'hourly' ? (
            <CompareMomentHourlyService
              key={`${row.label}-${service.name}`}
              cell={getProviderCellByIndex(row, serviceIndex)}
              service={service}
            />
          ) : (
            <CompareMomentDailyService
              key={`${row.label}-${service.name}`}
              cell={getProviderCellByIndex(row, serviceIndex)}
              service={service}
            />
          )
        ))}
      </View>
    </View>
  );
}

function CompareMomentHourlyService({
  cell,
  service,
}: {
  cell: CompareForecastCell;
  service: CompareServiceSummary;
}) {
  return (
    <View style={styles.compareMomentServiceRow}>
      <ProviderServiceIcon mark={service.mark} name={service.name} style={styles.compareMomentServiceLogo} />
      <View style={styles.compareMomentServiceNameBox}>
        <Text numberOfLines={1} style={styles.compareMomentServiceName}>{normalizeServiceName(service.name)}</Text>
        <Text numberOfLines={1} style={styles.compareMomentServiceSub}>{service.subtitle || '공식 예보'}</Text>
      </View>
      <WeatherMiniIcon condition={cell.weather} />
      <View style={styles.compareMomentWeatherBox}>
        <Text numberOfLines={1} style={styles.compareMomentWeather}>{cell.weather}</Text>
        <Text numberOfLines={1} style={styles.compareMomentDetail}>{extractComparePrecipitation(cell.detail)}</Text>
      </View>
      <Text style={styles.compareMomentTemp}>{extractCompareTemperature(cell.detail)}</Text>
    </View>
  );
}

function CompareMomentDailyService({
  cell,
  service,
}: {
  cell: CompareForecastCell;
  service: CompareServiceSummary;
}) {
  return (
    <View style={styles.compareMomentDailyService}>
      <View style={styles.compareMomentDailyServiceHead}>
        <ProviderServiceIcon mark={service.mark} name={service.name} style={styles.compareMomentServiceLogo} />
        <Text numberOfLines={1} style={styles.compareMomentServiceName}>{normalizeServiceName(service.name)}</Text>
      </View>
      <View style={styles.compareMomentDailyPeriods}>
        <CompareMomentDailyPeriod label="오전" period={cell.morning ?? cell} />
        <CompareMomentDailyPeriod label="오후" period={cell.afternoon ?? cell} />
      </View>
    </View>
  );
}

function CompareMomentDailyPeriod({
  label,
  period,
}: {
  label: string;
  period: Pick<CompareForecastCell, 'weather' | 'detail'>;
}) {
  return (
    <View style={styles.compareMomentDailyPeriod}>
      <Text style={styles.compareMomentDailyLabel}>{label}</Text>
      <WeatherMiniIcon condition={period.weather} />
      <View style={styles.compareMomentDailyText}>
        <Text numberOfLines={1} style={styles.compareMomentWeather}>{period.weather}</Text>
        <Text numberOfLines={1} style={styles.compareMomentDetail}>
          {formatDailyPeriodDetail(period.detail).replace('\n', ' · ')}
        </Text>
      </View>
    </View>
  );
}

function WeatherMiniIcon({ condition }: { condition: string }) {
  return <WeatherIcon condition={condition} style={styles.compareForecastWeatherSvg} />;
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

  return `${dayLabel} ${hour}`;
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
  const hourMatch = cleanLabel.match(/(\d{1,2})시?/);

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

function getProviderCellByIndex(row: CompareRow, serviceIndex: number) {
  if (serviceIndex === 0) return row.kma;
  if (serviceIndex === 1) return row.yr;
  return getThirdProviderCell(row);
}

function formatDailyPeriodDetail(detail: string) {
  const temp = extractCompareTemperature(detail);
  const precipitation = extractComparePrecipitation(detail);

  return `${temp}\n${precipitation}`;
}

function extractCompareTemperature(detail: string) {
  const match = detail.match(/-?\d+(?:\.\d+)?\s*(?:°C|℃|도|°)/i);
  if (!match) return '-';

  return match[0]
    .replace(/\s+/g, '')
    .replace(/℃|도/i, '°C')
    .replace(/°$/, '°C');
}

function extractComparePrecipitation(detail: string) {
  const amount = detail.match(/\d+(?:\.\d+)?\s*mm/i);
  if (amount) return amount[0].replace(/\s+/g, '');

  const probability = detail.match(/\d+\s*%/);
  if (probability) return probability[0].replace(/\s+/g, '');

  return '-';
}

function normalizeServiceName(name: string) {
  if (name === '기상청') return '대한민국 기상청';
  if (name === 'Yr.no') return '노르웨이 기상청';
  if (name === 'FMI ECMWF') return '핀란드 기상청';

  return name;
}
