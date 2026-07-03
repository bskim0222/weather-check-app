import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { CompareDifferenceSection } from '../components/CompareDifferenceSection';
import { CompareOverview } from '../components/CompareOverview';
import { ForecastComparePanel } from '../components/ForecastComparePanel';
import { getCompareFocusText, type CompareMode } from '../domain/compare';
import { styles } from '../styles/appStyles';
import type { WeatherProviderSnapshot } from '../services/weatherProviders';
import type { CompareServiceSummary, SearchContext } from '../types/weather';

type CompareScreenProps = {
  providerSnapshot: WeatherProviderSnapshot;
  searchContext: SearchContext;
};

export function CompareScreen({ providerSnapshot, searchContext }: CompareScreenProps) {
  const [mode, setMode] = useState<CompareMode>('hourly');
  const rows = useMemo(
    () => (mode === 'daily' ? providerSnapshot.dailyRows : providerSnapshot.hourlyRows),
    [mode, providerSnapshot],
  );
  const focusText = getCompareFocusText(searchContext);
  const compareCaption =
    mode === 'hourly'
      ? `${searchContext.timeLabel} · ${searchContext.place} 시간대별`
      : `${searchContext.place} 날짜별 전망`;

  return (
    <View>
      <CompareOverview searchContext={searchContext} summaries={providerSnapshot.summaries} />
      <ForecastComparePanel
        caption={compareCaption}
        mode={mode}
        rows={rows}
        services={providerSnapshot.summaries}
        onModeChange={setMode}
      />
      <CompareDifferenceSection
        differences={providerSnapshot.differences}
        focusText={focusText}
        weather={searchContext.detectedWeather}
      />
      <ProviderAttribution summaries={providerSnapshot.summaries} />
    </View>
  );
}

function ProviderAttribution({ summaries }: { summaries: CompareServiceSummary[] }) {
  return (
    <View style={styles.providerAttributionCard}>
      <Text style={styles.providerAttributionLabel}>데이터 출처</Text>
      <Text style={styles.providerAttributionText}>{createAttributionText(summaries)}</Text>
    </View>
  );
}

function createAttributionText(summaries: CompareServiceSummary[]) {
  const names = summaries.map((summary) => summary.name);
  const parts = [];

  if (names.includes('기상청')) parts.push('기상청 단기예보');
  if (names.includes('Yr.no')) parts.push('Yr.no / MET Norway');
  if (names.includes('FMI ECMWF')) parts.push('FMI Open Data ECMWF, CC BY 4.0');
  if (names.includes('Windy.com')) parts.push('Windy.com');

  return parts.length > 0
    ? `${parts.join(' · ')} 기준으로 비교합니다.`
    : '연결된 예보 서비스 기준으로 비교합니다.';
}
