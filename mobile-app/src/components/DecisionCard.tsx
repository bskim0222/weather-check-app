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

  return (
    <View style={[styles.decisionCard, { backgroundColor: current.bg }]}>
      <View style={[styles.decisionBackdropOrbLarge, { backgroundColor: current.accent }]} />
      <View style={styles.decisionBackdropOrbSoft} />

      <View style={styles.decisionTopRow}>
        <View style={styles.decisionPlaceBlock}>
          <Text style={styles.decisionPlaceKicker}>판정 위치</Text>
          <Text numberOfLines={1} style={styles.decisionPlaceText}>{placeLabel}</Text>
        </View>
        <View style={[styles.decisionTimeBadge, { backgroundColor: current.accent }]}>
          <Text style={[styles.decisionTimeBadgeText, { color: current.accentInk }]}>
            {searchContext.timeLabel}
          </Text>
        </View>
      </View>

      <View style={styles.decisionHeroLayout}>
        <View style={styles.decisionHeroTextBlock}>
          <View style={[styles.decisionConditionBadge, { backgroundColor: current.accent }]}>
            <Text style={[styles.decisionConditionBadgeText, { color: current.accentInk }]}>
              {current.condition}
            </Text>
          </View>
          <Text style={styles.decisionTitle}>{title}</Text>
          <Text style={styles.decisionSummary}>{current.summary}</Text>
        </View>
        <View style={styles.decisionVisualStage}>
          <WeatherArtwork current={current} />
        </View>
      </View>

      <View style={styles.decisionTempPanel}>
        <View style={styles.tempRow}>
          <Text style={styles.temperature}>{current.temp}</Text>
          <Text style={styles.degree}>°C</Text>
        </View>
        <View style={styles.decisionUpdateBlock}>
          <Text style={styles.decisionUpdateLabel}>데이터</Text>
          <Text style={styles.decisionUpdateText}>방금 갱신</Text>
        </View>
      </View>

      <View style={styles.signalGrid}>
        <View style={[styles.signalItem, { backgroundColor: current.accent }]}>
          <Text style={[styles.signalLabel, { color: current.accentInk }]}>판정</Text>
          <Text numberOfLines={1} style={[styles.signalValue, { color: current.accentInk }]}>{current.level}</Text>
        </View>
        <View style={[styles.signalItem, { backgroundColor: current.accent }]}>
          <Text style={[styles.signalLabel, { color: current.accentInk }]}>현장</Text>
          <Text numberOfLines={1} style={[styles.signalValue, { color: current.accentInk }]}>{current.live}</Text>
        </View>
        <View style={[styles.signalItem, { backgroundColor: current.accent }]}>
          <Text style={[styles.signalLabel, { color: current.accentInk }]}>신호</Text>
          <Text numberOfLines={1} style={[styles.signalValue, { color: current.accentInk }]}>{compactSignal}</Text>
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

function WeatherArtwork({ current }: { current: WeatherPreset }) {
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const isSunny = current.condition === '맑음';
  const isRain = current.condition === '비';
  const isThunder = current.condition === '천둥번개';
  const isSnow = current.condition === '눈';
  const isFog = current.condition === '안개';
  const isCloudy = current.condition === '흐림';
  const shapeColor = getWeatherShapeColor(current);
  const softColor = getSoftWeatherColor(current);
  const puffColor = getWeatherPuffColor(current);

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
          duration: isRain ? 520 : isSnow ? 1200 : 1700,
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
  }, [current.condition, drift, fall, flash, isRain, isSnow, isThunder, pulse]);

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
          outputRange: isRain ? [-8, 10] : [-3, 6],
        }),
      },
    ],
    opacity: fall.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.42, 1, 0.42],
    }),
  };

  if (isSunny) {
    return (
      <Animated.View style={[styles.weatherArt, weatherFloatStyle]}>
        <Animated.View style={[styles.weatherArtPlate, { backgroundColor: getWeatherPlateColor(current) }, pulseStyle]} />
        <Animated.View style={[styles.sunHalo, { borderColor: current.accent }, pulseStyle]} />
        <Animated.View style={[styles.sunCore, { backgroundColor: current.accent }, pulseStyle]} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.weatherArt, weatherFloatStyle]}>
      <Animated.View style={[styles.weatherArtPlate, { backgroundColor: getWeatherPlateColor(current) }, pulseStyle]} />
      {isThunder && <Animated.View style={[styles.thunderFlash, { opacity: flash }]} />}
      <Animated.View style={[styles.cloudPuffLarge, { backgroundColor: puffColor }, pulseStyle]} />
      <Animated.View style={[styles.cloudBase, { backgroundColor: shapeColor }, pulseStyle]} />
      <Animated.View style={[styles.cloudPuffSmall, { backgroundColor: softColor }, pulseStyle]} />

      {(isRain || isThunder) && (
        <Animated.View style={[styles.weatherDrops, fallStyle]}>
          <View style={[styles.rainDrop, styles.rainDropFast, { backgroundColor: getDropColor(current) }]} />
          <View style={[styles.rainDrop, styles.rainDropMiddle, { backgroundColor: getDropColor(current) }]} />
          <View style={[styles.rainDrop, { backgroundColor: getDropColor(current) }]} />
          <View style={[styles.rainDrop, styles.rainDropWide, { backgroundColor: getDropColor(current) }]} />
        </Animated.View>
      )}

      {isThunder && (
        <Animated.View style={[styles.thunderBolt, { opacity: flash }]}>
          <View style={[styles.thunderBoltTop, { backgroundColor: current.accent }]} />
          <View style={[styles.thunderBoltBottom, { backgroundColor: current.accent }]} />
        </Animated.View>
      )}

      {isSnow && (
        <Animated.View style={[styles.snowDots, fallStyle]}>
          <View style={styles.snowDot} />
          <View style={[styles.snowDot, styles.snowDotMiddle]} />
          <View style={[styles.snowDot, styles.snowDotSmall]} />
          <View style={[styles.snowDot, styles.snowDotLow]} />
        </Animated.View>
      )}

      {(isFog || isCloudy) && (
        <Animated.View style={[styles.fogLines, isCloudy && styles.fogLinesCloudy, weatherFloatStyle]}>
          <View style={[styles.fogLine, { backgroundColor: getFogLineColor(current) }]} />
          <View style={[styles.fogLine, styles.fogLineShort, { backgroundColor: getFogLineColor(current) }]} />
          <View style={[styles.fogLine, { backgroundColor: getFogLineColor(current) }]} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

function getWeatherShapeColor(current: WeatherPreset) {
  if (current.condition === '비') return '#126895';
  if (current.condition === '천둥번개') return '#3f2465';
  if (current.condition === '눈') return '#f8fdff';
  if (current.condition === '안개') return '#d0c5b9';
  if (current.condition === '흐림') return '#d3ddd6';
  return current.accent;
}

function getSoftWeatherColor(current: WeatherPreset) {
  if (current.condition === '비') return '#d7f4ff';
  if (current.condition === '천둥번개') return '#8a64c6';
  if (current.condition === '눈') return '#ffffff';
  if (current.condition === '안개') return '#f0e7dc';
  if (current.condition === '흐림') return '#f8f5ec';
  return '#fff2e9';
}

function getWeatherPuffColor(current: WeatherPreset) {
  if (current.condition === '비') return '#0b5a7b';
  if (current.condition === '천둥번개') return '#4e5663';
  if (current.condition === '눈') return '#f8fdff';
  if (current.condition === '안개') return '#efe8dc';
  if (current.condition === '흐림') return '#718176';

  return current.accent;
}

function getDropColor(current: WeatherPreset) {
  if (current.condition === '천둥번개') return '#9ed4e9';
  return '#e6f8ff';
}

function getFogLineColor(current: WeatherPreset) {
  if (current.condition === '흐림') return 'rgba(36,36,36,0.22)';
  return 'rgba(36,36,36,0.34)';
}

function getWeatherPlateColor(current: WeatherPreset) {
  if (current.condition === '비') return 'rgba(225,248,255,0.24)';
  if (current.condition === '천둥번개') return 'rgba(255,244,117,0.18)';
  if (current.condition === '눈') return 'rgba(255,255,255,0.48)';
  if (current.condition === '안개') return 'rgba(255,248,239,0.34)';
  if (current.condition === '흐림') return 'rgba(255,248,230,0.34)';
  return 'rgba(255,255,255,0.28)';
}
