import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

import { BrandLogo } from './BrandLogo';
import { styles } from '../styles/appStyles';

export function AppLoadingScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 820,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 820,
          useNativeDriver: true,
        }),
      ]),
    );
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    driftLoop.start();

    return () => {
      pulseLoop.stop();
      driftLoop.stop();
    };
  }, [drift, pulse]);

  const dotScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.78, 1.18],
  });
  const cardTranslate = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <View style={styles.loadingOverlay}>
      <Animated.View
        style={[
          styles.loadingBrandCard,
          {
            transform: [{ translateY: cardTranslate }],
          },
        ]}
      >
        <BrandLogo />
        <Text style={styles.loadingTitle}>
          오늘 옷 뭐 입지? 날씨가 애매할 땐 비교하고, 수상할 땐 물어보세요
        </Text>
        <Text style={styles.loadingBody}>세 기상청 예보와 현장 제보를 불러오는 중이에요.</Text>
        <View style={styles.loadingDots}>
          {[0, 1, 2].map((index) => (
            <Animated.View
              key={index}
              style={[
                styles.loadingDot,
                index === 1 && styles.loadingDotBlue,
                index === 2 && styles.loadingDotDark,
                {
                  opacity: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.45 + index * 0.12, 1],
                  }),
                  transform: [
                    {
                      scale:
                        index === 1
                          ? dotScale
                          : pulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 0.86 + index * 0.18],
                            }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
