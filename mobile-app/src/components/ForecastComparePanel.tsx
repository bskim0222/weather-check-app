import { Pressable, Text, View } from 'react-native';

import { ProviderServiceIcon } from './ProviderServiceIcon';
import { WeatherIcon } from './WeatherIcon';
import type { CompareMode } from '../domain/compare';
import { normalizeHourlyLabels } from '../domain/forecastLabels';
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
          {mode === 'hourly' ? '3개 예보를 같은 시간으로 비교' : '오전/오후를 나눠 비교'}
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
  const metrics = getCompareMetrics(cell.detail);

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
        <View style={styles.compareMomentMetricRow}>
          <MetricPill label="강수" value={metrics.precipitation} />
          <MetricPill label="바람" value={metrics.wind} />
        </View>
      </View>
      <Text style={styles.compareMomentTemp}>{metrics.temperature}</Text>
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
  const metrics = getCompareMetrics(period.detail);

  return (
    <View style={styles.compareMomentDailyPeriod}>
      <Text style={styles.compareMomentDailyLabel}>{label}</Text>
      <WeatherMiniIcon condition={period.weather} />
      <View style={styles.compareMomentDailyText}>
        <Text numberOfLines={1} style={styles.compareMomentWeather}>{period.weather}</Text>
        <Text numberOfLines={1} style={styles.compareMomentDetail}>{metrics.temperature}</Text>
        <View style={styles.compareMomentMetricRow}>
          <MetricPill label="강수" value={metrics.precipitation} />
          <MetricPill label="바람" value={metrics.wind} />
        </View>
      </View>
    </View>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.compareMomentMetricPill}>
      <Text numberOfLines={1} style={styles.compareMomentMetricText}>
        {label} {value}
      </Text>
    </View>
  );
}

function WeatherMiniIcon({ condition }: { condition: string }) {
  return <WeatherIcon condition={condition} style={styles.compareForecastWeatherSvg} />;
}

function getProviderCellByIndex(row: CompareRow, serviceIndex: number) {
  if (serviceIndex === 0) return row.kma;
  if (serviceIndex === 1) return row.yr;
  return getThirdProviderCell(row);
}

function getCompareMetrics(detail: string) {
  return {
    temperature: extractCompareTemperature(detail),
    precipitation: extractComparePrecipitation(detail),
    wind: extractCompareWind(detail),
  };
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

function extractCompareWind(detail: string) {
  const speed = detail.match(/바람\s*\d+(?:\.\d+)?\s*m\/s/i);
  if (speed) return speed[0].replace(/^바람\s*/, '').replace(/\s+/g, '');

  const direction = detail.match(/(?:북동풍|동풍|남동풍|남풍|남서풍|서풍|북서풍|북풍|약풍|강풍)/);
  if (direction) return direction[0];

  return '-';
}

function normalizeServiceName(name: string) {
  if (name === '기상청') return '대한민국 기상청';
  if (name === 'Yr.no') return '노르웨이 기상청';
  if (name === 'FMI ECMWF') return '핀란드 기상청';

  return name;
}
