import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { CompareDifferenceSection } from '../components/CompareDifferenceSection';
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
      : `${searchContext.place} 날짜별 흐름`;

  return (
    <View>
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
  const names = summaries.map((summary) => normalizeServiceName(summary.name));
  const parts = [];

  if (names.includes('대한민국 기상청')) parts.push('기상청 단기예보');
  if (names.includes('노르웨이 기상청')) parts.push('MET Norway / Yr');
  if (names.includes('핀란드 기상청')) parts.push('FMI Open Data, CC BY 4.0');

  return parts.length > 0
    ? `${parts.join(' · ')} 기준으로 비교합니다.`
    : '연결된 예보 서비스 기준으로 비교합니다.';
}

function normalizeServiceName(name: string) {
  if (name === '기상청') return '대한민국 기상청';
  if (name === 'Yr.no') return '노르웨이 기상청';
  if (name === 'FMI ECMWF') return '핀란드 기상청';
  if (name.toLowerCase().includes('windy')) return '핀란드 기상청';

  return name;
}
