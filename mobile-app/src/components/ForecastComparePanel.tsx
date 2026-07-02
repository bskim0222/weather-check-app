import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import type { CompareMode } from '../domain/compare';
import { styles } from '../styles/appStyles';
import type { CompareForecastCell, CompareRow, CompareServiceSummary } from '../types/weather';

const serviceIcons: Record<string, ImageSourcePropType> = {
  기상청: require('../../assets/icon-kma.png'),
  'Yr.no': require('../../assets/icon-yr.png'),
};

const fallbackServices: CompareServiceSummary[] = [
  { name: '기상청', mark: 'K', subtitle: 'KMA', summary: '', weather: '', value: '', color: '#e6465f' },
  { name: 'Yr.no', mark: 'Yr', subtitle: 'Norway', summary: '', weather: '', value: '', color: '#65a6ff' },
  { name: 'FMI ECMWF', mark: 'FMI', subtitle: 'ECMWF', summary: '', weather: '', value: '', color: '#7f9f8d' },
];

type ForecastComparePanelProps = {
  caption: string;
  mode: CompareMode;
  rows: CompareRow[];
  services: CompareServiceSummary[];
  onModeChange: (mode: CompareMode) => void;
};

export function ForecastComparePanel({
  caption,
  mode,
  rows,
  services,
  onModeChange,
}: ForecastComparePanelProps) {
  const visibleServices = services.length >= 3 ? services.slice(0, 3) : fallbackServices;

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
          <Text style={styles.comparePanelHeading}>{mode === 'hourly' ? '시간대별 예보 비교' : '날짜별 예보 비교'}</Text>
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
            {rows.map((row) => (
              <CompareForecastColumn key={row.label} row={row} />
            ))}
          </ScrollView>
        </View>
      </View>
    </>
  );
}

function CompareServiceLabel({ service }: { service: CompareServiceSummary }) {
  const icon = serviceIcons[service.name];

  return (
    <View style={styles.compareTableServiceCell}>
      {icon ? (
        <View style={styles.compareTableServiceIconFrame}>
          <Image source={icon} style={styles.compareTableServiceIcon} />
        </View>
      ) : (
        <View style={[styles.compareTableServiceIconFrame, { backgroundColor: service.color }]}>
          <Text style={styles.compareServiceMarkText}>{service.mark}</Text>
        </View>
      )}
      <Text style={styles.compareTableServiceText}>{service.name}</Text>
    </View>
  );
}

function CompareForecastColumn({ row }: { row: CompareRow }) {
  return (
    <View style={styles.compareForecastColumn}>
      <View style={styles.compareForecastColumnHead}>
        <Text style={styles.compareForecastColumnLabel}>{row.label}</Text>
      </View>
      <CompareForecastCellView cell={row.kma} />
      <CompareForecastCellView cell={row.yr} />
      <CompareForecastCellView cell={row.windy} />
    </View>
  );
}

function CompareForecastCellView({ cell }: { cell: CompareForecastCell }) {
  return (
    <View style={styles.compareForecastCell}>
      <View style={styles.compareForecastIconFrame}>
        <WeatherMiniIcon condition={cell.weather} tone={cell.tone} />
      </View>
      <View style={styles.compareForecastTextBox}>
        <Text style={styles.compareForecastWeather}>{cell.weather}</Text>
        <Text style={styles.compareForecastDetail}>{cell.detail}</Text>
      </View>
    </View>
  );
}

function WeatherMiniIcon({ condition, tone }: { condition: string; tone: string }) {
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
  if (condition.includes('비 없음')) return 'sunny';
  if (condition.includes('천둥') || condition.includes('불안정')) return 'thunder';
  if (condition.includes('비') || condition.includes('강수')) return 'rain';
  if (condition.includes('눈')) return 'snow';
  if (condition.includes('안개') || condition.includes('습')) return 'fog';
  if (condition.includes('맑')) return 'sunny';

  return 'cloudy';
}

function getSoftTone(kind: string) {
  if (kind === 'rain') return '#b8d7ef';
  if (kind === 'snow') return '#ffffff';
  if (kind === 'thunder') return '#ffd33d';
  if (kind === 'fog') return '#bbb5b7';

  return '#fff2e9';
}
