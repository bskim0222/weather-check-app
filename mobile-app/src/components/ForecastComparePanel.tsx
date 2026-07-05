import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

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

type CompareWeatherCondition =
  | 'sunny'
  | 'cloudy'
  | 'rain'
  | 'shower'
  | 'storm'
  | 'snow'
  | 'fog'
  | 'dust'
  | 'heat'
  | 'night'
  | 'rainbow'
  | 'typhoon';

type CompareWeatherPalette = {
  main: string;
  soft: string;
  accent: string;
  dim: string;
};

function CompareWeatherShape({
  condition,
  palette,
}: {
  condition: CompareWeatherCondition;
  palette: CompareWeatherPalette;
}) {
  if (condition === 'sunny') {
    return (
      <G>
        <Circle cx="32" cy="32" r="13" fill={palette.accent} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <Line
              key={angle}
              x1={32 + 18 * Math.cos(rad)}
              y1={32 + 18 * Math.sin(rad)}
              x2={32 + 24 * Math.cos(rad)}
              y2={32 + 24 * Math.sin(rad)}
              stroke={palette.main}
              strokeWidth="4"
              strokeLinecap="round"
            />
          );
        })}
      </G>
    );
  }

  if (condition === 'rain' || condition === 'shower') {
    return (
      <G>
        <CloudShape palette={palette} />
        {[19, 30, 41, 50].map((x, index) => (
          <Line
            key={x}
            x1={x}
            y1={condition === 'shower' && index % 2 === 0 ? 41 : 38}
            x2={x - 3}
            y2={condition === 'shower' && index % 2 === 0 ? 54 : 50}
            stroke={palette.accent}
            strokeWidth="4"
            strokeLinecap="round"
          />
        ))}
      </G>
    );
  }

  if (condition === 'storm') {
    return (
      <G>
        <CloudShape palette={palette} />
        <Path d="M34 35 L25 49 L33 48 L27 60 L45 42 L36 43 Z" fill="#ffd43b" stroke="#242424" strokeWidth="2" strokeLinejoin="round" />
        <Line x1="18" y1="42" x2="15" y2="52" stroke={palette.accent} strokeWidth="3" strokeLinecap="round" />
        <Line x1="50" y1="42" x2="47" y2="52" stroke={palette.accent} strokeWidth="3" strokeLinecap="round" />
      </G>
    );
  }

  if (condition === 'snow') {
    return (
      <G>
        <CloudShape palette={palette} />
        {[18, 30, 43, 52].map((x, index) => (
          <SnowFlake key={x} cx={x} cy={index % 2 === 0 ? 48 : 55} color={palette.accent} />
        ))}
      </G>
    );
  }

  if (condition === 'fog') {
    return (
      <G>
        <CloudShape palette={palette} />
        {[42, 49, 56].map((y, index) => (
          <Line
            key={y}
            x1={index === 1 ? 13 : 18}
            y1={y}
            x2={index === 1 ? 51 : 46}
            y2={y}
            stroke={palette.main}
            strokeWidth="4"
            strokeLinecap="round"
            opacity={0.72 - index * 0.12}
          />
        ))}
      </G>
    );
  }

  if (condition === 'dust') {
    return (
      <G>
        <Circle cx="31" cy="26" r="12" fill={palette.soft} stroke={palette.main} strokeWidth="3" />
        {[41, 49, 57].map((y, index) => (
          <Line key={y} x1="12" y1={y} x2="53" y2={y} stroke={palette.main} strokeWidth="4" strokeLinecap="round" opacity={0.8 - index * 0.16} />
        ))}
        {[18, 27, 44, 52].map((x, index) => (
          <Circle key={x} cx={x} cy={30 + index * 5} r="2.5" fill={palette.accent} />
        ))}
      </G>
    );
  }

  if (condition === 'heat') {
    return (
      <G>
        <Circle cx="32" cy="22" r="13" fill={palette.accent} />
        {[42, 51, 59].map((y) => (
          <Path key={y} d={`M12 ${y} C22 ${y - 6} 30 ${y + 6} 40 ${y} C47 ${y - 4} 52 ${y + 2} 56 ${y}`} stroke={palette.main} strokeWidth="4" strokeLinecap="round" fill="none" />
        ))}
      </G>
    );
  }

  if (condition === 'night') {
    return (
      <G>
        <Path d="M42 10 C28 12 18 23 18 37 C18 50 28 58 41 58 C32 53 27 45 27 35 C27 24 33 16 42 10 Z" fill={palette.accent} />
        {[47, 51, 38].map((x, index) => (
          <Circle key={x} cx={x} cy={[18, 32, 24][index]} r={index === 1 ? 2 : 2.5} fill={palette.soft} />
        ))}
      </G>
    );
  }

  if (condition === 'rainbow') {
    return (
      <G>
        <Path d="M13 45 A19 19 0 0 1 51 45" stroke="#e84a5f" strokeWidth="5" strokeLinecap="round" fill="none" />
        <Path d="M18 45 A14 14 0 0 1 46 45" stroke="#ffd43b" strokeWidth="5" strokeLinecap="round" fill="none" />
        <Path d="M23 45 A9 9 0 0 1 41 45" stroke="#2fbf71" strokeWidth="5" strokeLinecap="round" fill="none" />
        <CloudShape palette={palette} />
      </G>
    );
  }

  if (condition === 'typhoon') {
    return (
      <G>
        <Path d="M49 17 C39 13 23 17 20 30 C18 41 28 50 40 45 C31 46 25 39 27 31 C30 21 41 20 49 17 Z" fill={palette.accent} />
        <Path d="M15 47 C25 51 41 47 44 34 C46 23 36 14 24 19 C33 18 39 25 37 33 C34 43 23 44 15 47 Z" fill={palette.main} opacity="0.75" />
      </G>
    );
  }

  return <CloudShape palette={palette} />;
}

function CloudShape({ palette }: { palette: CompareWeatherPalette }) {
  return (
    <G>
      <Circle cx="27" cy="32" r="13" fill={palette.soft} />
      <Circle cx="39" cy="28" r="16" fill={palette.soft} />
      <Circle cx="48" cy="36" r="10" fill={palette.soft} />
      <Path d="M17 42 H49 C55 42 59 38 59 33 C59 28 55 24 50 24 C47 16 39 11 30 14 C24 12 17 16 15 23 C9 25 6 30 7 36 C8 40 12 42 17 42 Z" fill={palette.main} opacity="0.88" />
      <Circle cx="23" cy="39" r="10" fill={palette.dim} opacity="0.8" />
    </G>
  );
}

function SnowFlake({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <G>
      <Line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4} stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1={cx + 4} y1={cy - 4} x2={cx - 4} y2={cy + 4} stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </G>
  );
}

function normalizeCompareWeatherCondition(condition: string): CompareWeatherCondition {
  const value = condition.toLowerCase();

  if (includesAny(value, ['태풍', 'typhoon', 'cyclone'])) return 'typhoon';
  if (includesAny(value, ['폭염', 'heatwave', '무더위', '고온'])) return 'heat';
  if (includesAny(value, ['황사', '미세먼지', '먼지', 'dust'])) return 'dust';
  if (includesAny(value, ['무지개', 'rainbow'])) return 'rainbow';
  if (includesAny(value, ['밤', 'night'])) return 'night';
  if (includesAny(value, ['천둥', '번개', 'thunder', 'storm'])) return 'storm';
  if (includesAny(value, ['소나기', 'shower'])) return 'shower';
  if (includesAny(value, ['눈', '진눈', 'snow', 'sleet'])) return 'snow';
  if (includesAny(value, ['안개', '시야', 'fog', 'mist'])) return 'fog';
  if (includesAny(value, ['비 없음', '강수 없음', 'no rain', '맑', 'clear', 'sunny', '건조', '안정'])) return 'sunny';
  if (includesAny(value, ['비', '강수', 'rain'])) return 'rain';
  if (includesAny(value, ['흐림', '구름', 'cloud', 'overcast'])) return 'cloudy';

  return 'cloudy';
}

function getCompareWeatherPalette(condition: CompareWeatherCondition): CompareWeatherPalette {
  const palettes: Record<CompareWeatherCondition, CompareWeatherPalette> = {
    sunny: { main: '#d58a00', soft: '#fff2a6', accent: '#ffc83d', dim: '#ffe7a0' },
    cloudy: { main: '#899098', soft: '#d7dbe0', accent: '#aab1ba', dim: '#eef0f2' },
    rain: { main: '#8fa9bf', soft: '#d8e3ec', accent: '#3d8fe8', dim: '#eef4f9' },
    shower: { main: '#749ebc', soft: '#d8ebf5', accent: '#2d9cdb', dim: '#eef8fc' },
    storm: { main: '#4a4f5b', soft: '#8b94a4', accent: '#4e9ce8', dim: '#d8dbe0' },
    snow: { main: '#93b8cc', soft: '#e9f5fb', accent: '#5ca6d6', dim: '#ffffff' },
    fog: { main: '#7f8588', soft: '#d7d4ca', accent: '#a6a5a0', dim: '#efeee8' },
    dust: { main: '#b18a43', soft: '#ead8ad', accent: '#d29a2d', dim: '#f4ead0' },
    heat: { main: '#d24a28', soft: '#ffd8b8', accent: '#ff8a2a', dim: '#fff1dd' },
    night: { main: '#4c5580', soft: '#d7dcff', accent: '#7e8fe8', dim: '#f1f2ff' },
    rainbow: { main: '#6fa58d', soft: '#d5eee2', accent: '#f2b544', dim: '#edf7f1' },
    typhoon: { main: '#3a4d86', soft: '#dbe4ff', accent: '#6386e8', dim: '#edf2ff' },
  };

  return palettes[condition];
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

function normalizeServiceName(name: string) {
  if (name === '기상청') return '대한민국 기상청';
  if (name === 'Yr.no') return '노르웨이 기상청';
  if (name === 'FMI ECMWF') return '핀란드 기상청';

  return name;
}
