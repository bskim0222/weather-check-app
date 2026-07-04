import { Text, View } from 'react-native';

import { ProviderServiceIcon } from './ProviderServiceIcon';
import { WeatherIcon } from './WeatherIcon';
import { styles } from '../styles/appStyles';
import type { CompareServiceSummary, SearchContext } from '../types/weather';

type CompareOverviewProps = {
  searchContext: SearchContext;
  summaries: CompareServiceSummary[];
};

export function CompareOverview({ searchContext, summaries }: CompareOverviewProps) {
  return (
    <View style={styles.compareHero}>
      <Text style={styles.compareKicker}>예보 비교</Text>
      <Text style={styles.compareTitle}>예보를 한눈에 비교해요.</Text>
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
  return (
    <View style={styles.compareServiceLogoFrame}>
      <ProviderServiceIcon mark={service.mark} name={service.name} style={styles.compareServiceLogoSvg} />
    </View>
  );
}

function CompareWeatherBadge({ service }: { service: CompareServiceSummary }) {
  return (
    <View style={styles.compareSummaryWeatherBadge}>
      <View style={styles.compareSummaryWeatherIcon}>
        <WeatherMiniIcon condition={service.weather} />
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

function WeatherMiniIcon({ condition }: { condition: string }) {
  return <WeatherIcon condition={condition} style={styles.compareSummaryWeatherSvg} />;
}
