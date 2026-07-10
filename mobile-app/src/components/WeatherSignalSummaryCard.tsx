import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { ProviderServiceIcon } from './ProviderServiceIcon';
import { WeatherIcon } from './WeatherIcon';
import { getThirdProviderCell } from '../domain/providerRows';
import type { WeatherProviderSnapshot } from '../services/weatherProviders';
import type { DataStatus } from '../types/appState';
import type { CompareForecastCell, CompareRow, CompareServiceSummary, SearchContext } from '../types/weather';

type WeatherSignalSummaryCardProps = {
  dataStatus: DataStatus;
  providerSnapshot: WeatherProviderSnapshot;
  searchContext: SearchContext;
};

export function WeatherSignalSummaryCard({
  dataStatus,
  providerSnapshot,
  searchContext,
}: WeatherSignalSummaryCardProps) {
  const isLoading = dataStatus.phase === 'loading';
  const isSameContext = isSameWeatherContext(providerSnapshot.context, searchContext);
  const targetRow = isSameContext ? providerSnapshot.hourlyRows[0] : undefined;
  const services = normalizeServiceSummaries(providerSnapshot.summaries);

  if (isLoading || !targetRow) {
    return (
      <View style={summaryStyles.loadingCard}>
        <SignalLoader />
        <Text style={summaryStyles.loadingTitle}>날씨 신호 확인 중</Text>
        <Text style={summaryStyles.loadingBody}>
          {searchContext.place} · {searchContext.timeLabel} 기준으로 세 기상청 예보를 다시 맞춰보고 있어요.
        </Text>
      </View>
    );
  }

  return (
    <View style={summaryStyles.wrap}>
      <View style={summaryStyles.titleBlock}>
        <Text style={summaryStyles.eyebrow}>{searchContext.timeLabel}</Text>
        <Text style={summaryStyles.title}>{searchContext.place}</Text>
        <Text style={summaryStyles.subtitle}>세 기상청 예보를 한 화면에서 비교해요</Text>
      </View>

      <View style={summaryStyles.providerStack}>
        {services.map((service, index) => {
          const cell = getProviderCell(targetRow, index);
          return (
            <ProviderWeatherCard
              key={`${service.name}-${index}`}
              cell={cell}
              service={service}
              index={index}
            />
          );
        })}
      </View>
    </View>
  );
}

function getProviderCell(row: CompareRow, index: number) {
  if (index === 0) return row.kma;
  if (index === 1) return row.yr;

  return getThirdProviderCell(row);
}

function ProviderWeatherCard({
  cell,
  service,
  index,
}: {
  cell: CompareForecastCell;
  service: CompareServiceSummary;
  index: number;
}) {
  const weather = cell?.weather || service.weather || '확인 중';
  const detail = cell?.detail || service.summary || '';
  const temp = extractTemperature(cell?.detail || service.value || '');
  const rain = extractPrecipitation(cell?.detail || service.value || '');
  const tone = getWeatherTone(weather, index);

  return (
    <View style={[summaryStyles.providerCard, { backgroundColor: tone.bg }]}>
      <View style={summaryStyles.providerVisualLayer}>
        <WeatherIcon condition={weather} style={summaryStyles.providerHeroIcon} />
      </View>
      <View style={summaryStyles.serviceRow}>
        <View style={summaryStyles.providerSmallLogo}>
          <ProviderServiceIcon
            name={service.name}
            mark={service.mark}
            style={summaryStyles.providerSmallLogoIcon}
          />
        </View>
        <View>
          <Text style={[summaryStyles.serviceName, { color: tone.ink }]}>{service.name}</Text>
          <Text style={[summaryStyles.serviceSub, { color: tone.sub }]}>{service.subtitle}</Text>
        </View>
      </View>
      <View style={summaryStyles.providerBottomContent}>
        <View style={summaryStyles.providerTextBlock} />
        <View style={summaryStyles.providerValueBlock}>
          <Text style={[summaryStyles.providerTemp, { color: tone.ink }]}>{temp}</Text>
          <Text style={[summaryStyles.weatherName, { color: tone.ink }]}>{weather}</Text>
          <Text style={[summaryStyles.weatherDetail, { color: tone.sub }]} numberOfLines={2}>
            {detail}
          </Text>
          {!!rain && <Text style={[summaryStyles.providerRain, { color: tone.sub }]}>{rain}</Text>}
        </View>
        <View style={summaryStyles.providerLogoButton}>
          <ProviderServiceIcon
            name={service.name}
            mark={service.mark}
            style={summaryStyles.serviceIcon}
          />
        </View>
      </View>
    </View>
  );
}

function SignalLoader() {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();

    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[summaryStyles.loader, { transform: [{ rotate }] }]}>
      <View style={summaryStyles.loaderDot} />
      <View style={[summaryStyles.loaderDot, summaryStyles.loaderDotSecond]} />
      <View style={[summaryStyles.loaderDot, summaryStyles.loaderDotThird]} />
    </Animated.View>
  );
}

function normalizeServiceSummaries(summaries: CompareServiceSummary[]) {
  const base = summaries.length >= 3 ? summaries.slice(0, 3) : summaries;
  const names = ['대한민국 기상청', '노르웨이 기상청', '핀란드 기상청'];
  const subtitles = ['KMA', 'MET Norway / Yr', 'FMI'];

  return names.map((name, index) => ({
    ...(base[index] ?? {
      mark: index === 0 ? 'K' : index === 1 ? 'Yr' : 'FMI',
      summary: '',
      weather: '',
      value: '',
      color: '#2d2d2d',
    }),
    name,
    subtitle: subtitles[index],
  }));
}

function isSameWeatherContext(left: SearchContext, right: SearchContext) {
  return (
    left.place === right.place
    && left.timeLabel === right.timeLabel
    && left.target.latitude === right.target.latitude
    && left.target.longitude === right.target.longitude
  );
}

function extractTemperature(text: string) {
  const match = text.match(/-?\d+(?:\.\d+)?\s*(?:°C|°|도|℃)/);
  if (!match) return '-';
  const value = match[0].replace(/\s*(?:°|도|℃)$/, '°C');
  return value.includes('°C') ? value : `${value}°C`;
}

function extractPrecipitation(text: string) {
  const amount = text.match(/\d+(?:\.\d+)?\s*mm/i);
  if (amount) return amount[0].replace(/\s+/g, '');

  const probability = text.match(/\d+\s*%/);
  if (probability) return probability[0].replace(/\s+/g, '');

  return '';
}

type ProviderInterpretationItem = {
  cell: CompareForecastCell;
  index: number;
  service: CompareServiceSummary;
};

type WeatherInterpretation = {
  body: string;
  direction: string;
  focus: string;
  temperatureRange: string;
  title: string;
  weather: string;
};

function createWeatherInterpretation(items: ProviderInterpretationItem[]): WeatherInterpretation {
  const signals = items.map((item) => {
    const weather = item.cell?.weather || item.service.weather || '확인 중';
    const detail = item.cell?.detail || item.service.value || item.service.summary || '';
    return {
      key: getWeatherKey(weather),
      name: item.service.name,
      temp: extractTemperatureNumber(detail),
      weather,
    };
  });
  const counts = countWeatherSignals(signals.map((signal) => signal.key));
  const top = pickMainSignal(counts);
  const agreeing = signals.filter((signal) => signal.key === top.key).length;
  const mixed = agreeing < 2;
  const direction = mixed ? '예보 갈림' : `${agreeing}곳 ${top.label}`;
  const temperatureRange = formatTemperatureRange(signals.map((signal) => signal.temp));
  const sourcePhrase = createSourcePhrase(signals, top.key);

  if (top.key === 'rain') {
    return {
      weather: '비',
      title: mixed ? '비 신호가 애매해요' : '비 쪽 신호가 더 많아요',
      body: `${sourcePhrase} 비를 보고 있어요. 단정 판정보다는 우산을 챙기는 쪽으로 안내해요.`,
      direction,
      temperatureRange,
      focus: '강수량',
    };
  }

  if (top.key === 'storm') {
    return {
      weather: '천둥번개',
      title: mixed ? '강한 비 신호를 확인해요' : '천둥·강한 비를 조심해요',
      body: `${sourcePhrase} 강한 비나 천둥 신호를 보고 있어요. 이동 전 최신 예보와 현장 제보를 같이 확인해요.`,
      direction,
      temperatureRange,
      focus: '돌풍',
    };
  }

  if (top.key === 'snow') {
    return {
      weather: '눈',
      title: mixed ? '눈 신호가 일부 보여요' : '눈 쪽 신호가 더 많아요',
      body: `${sourcePhrase} 눈 또는 진눈깨비 가능성을 보고 있어요. 노면 상태를 같이 확인하는 게 좋아요.`,
      direction,
      temperatureRange,
      focus: '노면',
    };
  }

  if (top.key === 'sunny') {
    return {
      weather: '맑음',
      title: mixed ? '비 가능성은 낮아 보여요' : '비 걱정은 낮은 편이에요',
      body: `${sourcePhrase} 비가 거의 없거나 맑은 쪽으로 보고 있어요. 그래도 시간대별 변화는 아래 카드에서 확인해요.`,
      direction,
      temperatureRange,
      focus: '변화',
    };
  }

  return {
    weather: '흐림',
    title: mixed ? '예보가 조금 갈려요' : '흐림 쪽 신호가 많아요',
    body: `${sourcePhrase} 구름이 많은 쪽으로 보고 있어요. 비로 바뀌는지 강수량과 현장 글을 같이 봐요.`,
    direction,
    temperatureRange,
    focus: '구름',
  };
}

function countWeatherSignals(keys: string[]) {
  return keys.reduce<Record<string, number>>((acc, key) => {
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function pickMainSignal(counts: Record<string, number>) {
  const priority = [
    { key: 'storm', label: '천둥' },
    { key: 'rain', label: '비' },
    { key: 'snow', label: '눈' },
    { key: 'sunny', label: '맑음' },
    { key: 'cloudy', label: '흐림' },
    { key: 'fog', label: '안개' },
  ];
  return priority.reduce((best, item) => {
    const count = counts[item.key] ?? 0;
    const bestCount = counts[best.key] ?? 0;
    return count > bestCount ? item : best;
  }, priority[priority.length - 2]);
}

function createSourcePhrase(
  signals: Array<{ key: string; name: string; weather: string }>,
  targetKey: string,
) {
  const matched = signals.filter((signal) => signal.key === targetKey);
  if (matched.length >= 2) return `세 기상청 중 ${matched.length}곳이`;
  if (matched.length === 1) return `${shortProviderName(matched[0].name)}은`;

  return '세 기상청은';
}

function shortProviderName(name: string) {
  if (name.includes('대한민국')) return '대한민국 기상청';
  if (name.includes('노르웨이')) return '노르웨이 기상청';
  if (name.includes('핀란드')) return '핀란드 기상청';
  return name;
}

function extractTemperatureNumber(text: string) {
  const match = text.match(/-?\d+(?:\.\d+)?\s*(?:°C|°|도|℃)/);
  return match ? Number.parseFloat(match[0]) : null;
}

function formatTemperatureRange(values: Array<number | null>) {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!numbers.length) return '확인중';

  const min = Math.round(Math.min(...numbers));
  const max = Math.round(Math.max(...numbers));
  return min === max ? `${min}°C` : `${min}~${max}°C`;
}

function getWeatherKey(condition: string) {
  const normalized = normalizeWeatherName(condition);

  if (/(천둥|번개|storm|thunder)/i.test(normalized)) return 'storm';
  if (/(눈|snow|진눈)/i.test(normalized)) return 'snow';
  if (/(안개|fog|박무)/i.test(normalized)) return 'fog';
  if (/(비|소나기|rain|shower|강수)/i.test(normalized)) return 'rain';
  if (/(맑|clear|sun)/i.test(normalized)) return 'sunny';

  return 'cloudy';
}

function normalizeWeatherName(condition: string) {
  return (condition || '').trim() || '확인 중';
}

function getWeatherTone(condition: string, index: number) {
  const key = getWeatherKey(condition);
  const neutralCard = index === 1 ? '#d1e2f3' : '#e7e8e6';

  if (key === 'sunny') {
    return {
      bg: index === 1 ? '#d1e2f3' : neutralCard,
      ink: '#24221c',
      sub: 'rgba(36,34,28,0.62)',
      icon: { primary: '#f4df81', secondary: '#d89c3e', accent: '#24221c' },
    };
  }
  if (key === 'rain') {
    return {
      bg: index === 1 ? '#d1e2f3' : neutralCard,
      ink: '#191c1b',
      sub: 'rgba(70,70,75,0.72)',
      icon: { primary: '#315e69', secondary: '#c7dce2', accent: '#f8f3ea' },
    };
  }
  if (key === 'storm') {
    return {
      bg: index === 1 ? '#d1e2f3' : neutralCard,
      ink: '#191c1b',
      sub: 'rgba(70,70,75,0.72)',
      icon: { primary: '#5c6473', secondary: '#a7bdd1', accent: '#eaf05c' },
    };
  }
  if (key === 'snow') {
    return {
      bg: index === 1 ? '#d1e2f3' : neutralCard,
      ink: '#263238',
      sub: 'rgba(38,50,56,0.58)',
      icon: { primary: '#ffffff', secondary: '#6f8590', accent: '#26343a' },
    };
  }
  if (key === 'fog') {
    return {
      bg: index === 1 ? '#d1e2f3' : neutralCard,
      ink: '#2c2822',
      sub: 'rgba(44,40,34,0.58)',
      icon: { primary: '#73756b', secondary: '#3b3a36', accent: '#2c2822' },
    };
  }

  return {
    bg: neutralCard,
    ink: '#252a25',
    sub: 'rgba(37,42,37,0.58)',
    icon: { primary: '#758276', secondary: '#fffaf0', accent: '#252a25' },
  };
}

const summaryStyles = {
  wrap: {
    gap: 12,
    marginBottom: 18,
  },
  titleBlock: {
    paddingHorizontal: 2,
    gap: 3,
  },
  eyebrow: {
    color: 'rgba(34,36,38,0.48)',
    fontSize: 15,
    fontWeight: '900' as const,
  },
  title: {
    color: '#242424',
    fontSize: 34,
    fontWeight: '900' as const,
    letterSpacing: 0,
  },
  subtitle: {
    color: 'rgba(34,36,38,0.58)',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  interpretationCard: {
    minHeight: 212,
    borderRadius: 28,
    backgroundColor: '#242424',
    padding: 20,
    overflow: 'hidden' as const,
  },
  interpretationGlow: {
    position: 'absolute' as const,
    right: -62,
    top: -78,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  interpretationTop: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 14,
    zIndex: 2,
  },
  interpretationTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  interpretationKicker: {
    color: 'rgba(255,247,238,0.55)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900' as const,
  },
  interpretationTitle: {
    marginTop: 10,
    color: '#fff7ee',
    fontSize: 29,
    lineHeight: 33,
    fontWeight: '900' as const,
    letterSpacing: 0,
  },
  interpretationBody: {
    marginTop: 9,
    color: 'rgba(255,247,238,0.66)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800' as const,
  },
  interpretationIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 26,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 2,
    opacity: 0.96,
  },
  interpretationIcon: {
    width: 58,
    height: 58,
  },
  interpretationStats: {
    marginTop: 18,
    flexDirection: 'row' as const,
    gap: 8,
    zIndex: 2,
  },
  interpretationStat: {
    flex: 1,
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center' as const,
  },
  interpretationStatLabel: {
    color: 'rgba(255,247,238,0.46)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900' as const,
  },
  interpretationStatValue: {
    marginTop: 4,
    color: '#fff7ee',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900' as const,
  },
  providerStack: {
    gap: 10,
  },
  providerCard: {
    minHeight: 196,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(119,119,123,0.18)',
    overflow: 'hidden' as const,
    justifyContent: 'space-between' as const,
  },
  serviceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    zIndex: 2,
  },
  providerSmallLogo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.82)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  providerSmallLogoIcon: {
    width: 22,
    height: 22,
  },
  serviceIcon: {
    width: 34,
    height: 34,
  },
  serviceName: {
    fontSize: 17,
    fontWeight: '900' as const,
  },
  serviceSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800' as const,
  },
  weatherName: {
    marginTop: 3,
    fontSize: 22,
    fontWeight: '900' as const,
    letterSpacing: 0,
  },
  weatherDetail: {
    marginTop: 5,
    maxWidth: 174,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800' as const,
  },
  providerTemp: {
    fontSize: 46,
    lineHeight: 50,
    fontWeight: '900' as const,
    letterSpacing: -1,
  },
  providerRain: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '900' as const,
  },
  providerVisualLayer: {
    position: 'absolute' as const,
    left: 18,
    bottom: 20,
    width: 106,
    height: 96,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    opacity: 0.78,
  },
  providerHeroIcon: {
    width: 86,
    height: 86,
  },
  providerBottomContent: {
    marginTop: 30,
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    gap: 14,
  },
  providerTextBlock: {
    flex: 1,
  },
  providerValueBlock: {
    alignItems: 'flex-end' as const,
    paddingRight: 56,
    zIndex: 2,
  },
  providerLogoButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    position: 'absolute' as const,
    right: 0,
    bottom: 0,
  },
  loadingCard: {
    minHeight: 360,
    borderRadius: 30,
    backgroundColor: '#242424',
    padding: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 18,
  },
  loader: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: 26,
  },
  loaderDot: {
    position: 'absolute' as const,
    left: 42,
    top: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff7ee',
  },
  loaderDotSecond: {
    left: 76,
    top: 54,
    backgroundColor: '#f4dc65',
  },
  loaderDotThird: {
    left: 8,
    top: 62,
    backgroundColor: '#79bee0',
  },
  loadingTitle: {
    color: '#fff7ee',
    fontSize: 28,
    fontWeight: '900' as const,
    letterSpacing: 0,
  },
  loadingBody: {
    marginTop: 10,
    color: 'rgba(255,247,238,0.66)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center' as const,
    fontWeight: '800' as const,
  },
};
