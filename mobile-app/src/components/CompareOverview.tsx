import { Image, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { styles } from '../styles/appStyles';
import type { CompareServiceSummary, SearchContext } from '../types/weather';

const compareServiceIcons: Record<string, ImageSourcePropType> = {
  '대한민국 기상청': require('../../assets/icon-kma.png'),
  기상청: require('../../assets/icon-kma.png'),
  '노르웨이 기상청': require('../../assets/icon-yr.png'),
  'Yr.no': require('../../assets/icon-yr.png'),
  '핀란드 기상청': require('../../assets/icon-fmi.png'),
  'FMI ECMWF': require('../../assets/icon-fmi.png'),
};

type CompareOverviewProps = {
  searchContext: SearchContext;
  summaries: CompareServiceSummary[];
};

export function CompareOverview({ searchContext, summaries }: CompareOverviewProps) {
  return (
    <View style={styles.compareHero}>
      <Text style={styles.compareKicker}>예보 비교</Text>
      <Text style={styles.compareTitle}>
        예보를 한눈에 비교해요.
      </Text>
      <View style={styles.compareContextBar}>
        <Text style={styles.compareContextLabel}>질문 기준</Text>
        <Text style={styles.compareContextText}>{searchContext.raw}</Text>
      </View>
      <View style={styles.compareSummaryList}>
        {summaries.map((service) => (
          <View key={service.name} style={styles.compareSummaryCard}>
            <CompareServiceIcon service={service} />
            <View style={styles.compareSummaryContent}>
              <Text style={styles.compareSummaryName}>{normalizeServiceName(service.name)}</Text>
              <Text style={styles.compareSummaryText}>{service.summary}</Text>
            </View>
            <CompareWeatherBadge service={service} />
          </View>
        ))}
      </View>
    </View>
  );
}

function CompareServiceIcon({ service }: { service: CompareServiceSummary }) {
  const icon = compareServiceIcons[service.name];

  if (!icon) {
    return (
      <View style={[styles.compareServiceMark, { backgroundColor: service.color }]}>
        <Text style={styles.compareServiceMarkText}>{service.mark}</Text>
      </View>
    );
  }

  return (
    <View style={styles.compareServiceLogoFrame}>
      <Image source={icon} style={styles.compareServiceLogoImage} />
    </View>
  );
}

function CompareWeatherBadge({ service }: { service: CompareServiceSummary }) {
  return (
    <View style={styles.compareSummaryWeatherBadge}>
      <View style={styles.compareSummaryWeatherIcon}>
        <WeatherMiniIcon condition={service.weather} tone={service.color} />
      </View>
      <Text style={styles.compareSummaryWeatherText}>{service.weather}</Text>
      <Text style={styles.compareSummaryValueText}>{service.value}</Text>
    </View>
  );
}

function normalizeServiceName(name: string) {
  if (name === '기상청') return '대한민국 기상청';
  if (name === 'Yr.no') return '노르웨이 기상청';
  if (name === 'FMI ECMWF') return '핀란드 기상청';

  return name;
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
