import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { SearchContext, WeatherPreset } from '../types/weather';
import type { LocationStatus } from '../types/appState';

type DecisionCardProps = {
  current: WeatherPreset;
  locationStatus: LocationStatus;
  searchContext: SearchContext;
};

export function DecisionCard({ current, locationStatus, searchContext }: DecisionCardProps) {
  const compactSignal = getCompactSignal(current.condition, current.signal);
  const placeLabel = getDecisionPlaceLabel(searchContext, locationStatus);
  const title = getDisplayTitle(current.title);
  const artworkCaption = getArtworkCaption(current.condition);

  return (
    <View style={[styles.decisionCard, styles.decisionCardModern, { backgroundColor: current.bg }]}>
      <View style={[styles.decisionBackdropOrbLarge, { backgroundColor: current.accent }]} />
      <View style={styles.decisionBackdropOrbSoft} />

      <View style={styles.decisionModernTop}>
        <View style={styles.decisionModernPill}>
          <Text numberOfLines={1} style={styles.decisionModernPillText}>
            {searchContext.timeLabel} · {placeLabel}
          </Text>
        </View>
        <View style={styles.decisionModernTempRow}>
          <Text style={styles.decisionModernTemp}>{current.temp}</Text>
          <Text style={styles.decisionModernDegree}>°C</Text>
        </View>
      </View>

      <View style={styles.decisionModernArtStage}>
        <WeatherArtwork current={current} />
      </View>

      <View style={styles.decisionModernCopy}>
        <Text style={styles.decisionModernCaption}>{artworkCaption}</Text>
        <Text style={styles.decisionModernTitle}>{title}</Text>
        <Text style={styles.decisionModernSummary}>{current.summary}</Text>
      </View>

      <View style={styles.decisionModernFoot}>
        <Text numberOfLines={1} style={styles.decisionModernFootText}>
          {current.signal}
        </Text>
        <View style={styles.decisionModernFootPill}>
          <Text style={styles.decisionModernFootPillText}>{compactSignal}</Text>
        </View>
      </View>
    </View>
  );
}

function getDecisionPlaceLabel(searchContext: SearchContext, locationStatus: LocationStatus) {
  if (searchContext.target.kind !== 'current') return searchContext.place;

  if (locationStatus.phase === 'granted') {
    return locationStatus.placeName ?? locationStatus.label ?? '현재 위치 확인됨';
  }

  if (locationStatus.phase === 'checking') return '현재 위치 확인 중';
  if (locationStatus.phase === 'denied') return '현재 위치 권한 꺼짐';
  if (locationStatus.phase === 'fallback') return locationStatus.placeName ?? '기본 위치 사용 중';

  return searchContext.place;
}

function getDisplayTitle(title: string) {
  if (title.includes('쪽이 ')) return title.replace('쪽이 ', '쪽이\n');
  if (title.includes('천둥 ')) return title.replace('천둥 ', '천둥\n');
  if (title.includes('하늘은 ')) return title.replace('하늘은 ', '하늘은\n');
  if (title.includes('진눈깨비 ')) return title.replace('진눈깨비 ', '진눈깨비\n');

  return title;
}

function getCompactSignal(condition: string, signal: string) {
  if (condition === '비') return '2곳 비';
  if (condition === '맑음') return '3곳 비 없음';
  if (condition === '천둥번개') return '강한 비';
  if (condition === '눈') return '눈 가능';
  if (condition === '안개') return '시야 확인';

  return signal;
}

function getArtworkCaption(condition: string) {
  if (condition === '맑음') return '맑은 날씨를 선명하지만 과하지 않게';
  if (condition === '비') return '비 상황을 또렷하지만 무겁지 않게';
  if (condition === '천둥번개') return '천둥 신호를 강하지만 과하지 않게';
  if (condition === '눈') return '눈 상황을 귀엽지만 과하지 않게';
  if (condition === '안개') return '안개 상황을 부드럽지만 흐리지 않게';

  return '흐림 상황을 차분하지만 답답하지 않게';
}

function WeatherArtwork({ current }: { current: WeatherPreset }) {
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const isThunder = current.condition === '천둥번개';
  const sample = getSoftSample(current.condition);

  useEffect(() => {
    drift.setValue(0);
    pulse.setValue(0);
    fall.setValue(0);
    flash.setValue(0);

    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(drift, {
            toValue: 1,
            duration: 2600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(drift, {
            toValue: 0,
            duration: 2600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: isThunder ? 620 : 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: isThunder ? 760 : 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(fall, {
          toValue: 1,
          duration: sample.key === 'rain' ? 520 : sample.key === 'snow' ? 1200 : 1700,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(flash, {
            toValue: 1,
            duration: isThunder ? 140 : 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(flash, {
            toValue: 0,
            duration: isThunder ? 520 : 900,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [current.condition, drift, fall, flash, isThunder, pulse, sample.key]);

  const weatherFloatStyle = {
    transform: [
      {
        translateY: drift.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -7],
        }),
      },
      {
        translateX: drift.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 4],
        }),
      },
      { rotate: '-4deg' },
    ],
  };
  const pulseStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: isThunder ? [0.86, 1] : [0.82, 1],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: isThunder ? [0.96, 1.08] : [0.97, 1.04],
        }),
      },
    ],
  };
  const fallStyle = {
    transform: [
      {
        translateY: fall.interpolate({
          inputRange: [0, 1],
          outputRange: sample.key === 'rain' ? [-8, 10] : [-3, 6],
        }),
      },
    ],
    opacity: fall.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.42, 1, 0.42],
    }),
  };

  return (
    <Animated.View style={[styles.weatherHeroArt, weatherFloatStyle]}>
      <View style={styles.softHeroGraphic}>
        <SoftSampleGraphic sampleKey={sample.key} pulseStyle={pulseStyle} fallStyle={fallStyle} flash={flash} />
      </View>
    </Animated.View>
  );
}

function SoftSampleGraphic({
  sampleKey,
  pulseStyle,
  fallStyle,
  flash,
}: {
  sampleKey: SoftSampleKey;
  pulseStyle: object;
  fallStyle: object;
  flash: Animated.Value;
}) {
  if (sampleKey === 'sun') {
    return (
      <Animated.View style={[styles.softSampleSunGroup, pulseStyle]}>
        <View style={[styles.softSampleRay, styles.softSampleRayTop]} />
        <View style={[styles.softSampleRay, styles.softSampleRayRight]} />
        <View style={[styles.softSampleRay, styles.softSampleRayBottom]} />
        <View style={[styles.softSampleRay, styles.softSampleRayLeft]} />
        <View style={[styles.softSampleRay, styles.softSampleRayTopLeft]} />
        <View style={[styles.softSampleRay, styles.softSampleRayTopRight]} />
        <View style={[styles.softSampleRay, styles.softSampleRayBottomRight]} />
        <View style={[styles.softSampleRay, styles.softSampleRayBottomLeft]} />
        <View style={styles.softSampleSunCore} />
      </Animated.View>
    );
  }

  return (
    <>
      <Animated.View style={[styles.softSampleCloudWhite, pulseStyle]} />
      <Animated.View
        style={[
          styles.softSampleCloudCircle,
          sampleKey === 'rain' && styles.softSampleCloudCircleRain,
          sampleKey === 'thunder' && styles.softSampleCloudCircleThunder,
          sampleKey === 'snow' && styles.softSampleCloudCircleSnow,
          sampleKey === 'fog' && styles.softSampleCloudCircleFog,
          pulseStyle,
        ]}
      />

      {(sampleKey === 'rain' || sampleKey === 'thunder') && (
        <Animated.View style={[styles.softSampleRainLines, fallStyle]}>
          <View style={styles.softSampleRainLine} />
          <View style={[styles.softSampleRainLine, styles.softSampleRainLineMiddle]} />
          <View style={[styles.softSampleRainLine, styles.softSampleRainLineLast]} />
        </Animated.View>
      )}

      {sampleKey === 'thunder' && (
        <Animated.View style={[styles.softSampleBolt, { opacity: flash }]}>
          <View style={styles.softSampleBoltTop} />
          <View style={styles.softSampleBoltBottom} />
        </Animated.View>
      )}

      {sampleKey === 'snow' && (
        <>
          <View style={[styles.softSampleSnowDot, styles.softSampleSnowDotOne]} />
          <View style={[styles.softSampleSnowDot, styles.softSampleSnowDotTwo]} />
          <View style={[styles.softSampleSnowDot, styles.softSampleSnowDotThree]} />
          <View style={[styles.softSampleSnowDot, styles.softSampleSnowDotFour]} />
        </>
      )}

      {sampleKey === 'fog' && (
        <View style={styles.softSampleFogLines}>
          <View style={[styles.softSampleFogLine, styles.softSampleFogLineOne]} />
          <View style={[styles.softSampleFogLine, styles.softSampleFogLineTwo]} />
          <View style={[styles.softSampleFogLine, styles.softSampleFogLineThree]} />
        </View>
      )}
    </>
  );
}

type SoftSampleKey = 'sun' | 'cloud' | 'rain' | 'thunder' | 'snow' | 'fog';

function getSoftSample(condition: string): {
  background: string;
  dark?: boolean;
  key: SoftSampleKey;
  label: string;
  subLabel: string;
} {
  if (condition === '맑음') {
    return { background: '#e7ea64', key: 'sun', label: '맑음', subLabel: 'clear' };
  }
  if (condition === '비') {
    return { background: '#66b9df', key: 'rain', label: '비', subLabel: 'rain' };
  }
  if (condition === '천둥번개') {
    return { background: '#292533', dark: true, key: 'thunder', label: '천둥', subLabel: 'storm' };
  }
  if (condition === '눈') {
    return { background: '#dcecf3', key: 'snow', label: '눈', subLabel: 'snow' };
  }
  if (condition === '안개') {
    return { background: '#d8d0c4', key: 'fog', label: '안개', subLabel: 'fog' };
  }

  return { background: '#bbc5bb', key: 'cloud', label: '흐림', subLabel: 'overcast' };
}
