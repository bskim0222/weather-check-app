import { Image } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';

type WeatherIconProps = {
  condition: string;
  style?: StyleProp<ImageStyle>;
};

const meteoconsBaseUrl = 'https://raw.githubusercontent.com/basmilius/meteocons/v2/production/fill/svg';

export function WeatherIcon({ condition, style }: WeatherIconProps) {
  return (
    <Image
      accessibilityLabel={`${condition} 날씨 아이콘`}
      resizeMode="contain"
      source={{ uri: getWeatherIconUri(condition) }}
      style={style}
    />
  );
}

export function getWeatherIconUri(condition: string) {
  return `${meteoconsBaseUrl}/${getWeatherIconName(condition)}.svg`;
}

function getWeatherIconName(condition: string) {
  const value = condition.toLowerCase();

  if (includesAny(value, ['천둥', '번개', '소나기', '불안정'])) return 'thunderstorms-rain';
  if (includesAny(value, ['눈', '진눈', '찬 공기', '눈구름'])) return 'snow';
  if (includesAny(value, ['안개', '시야', '습함', '낮은 구름'])) return 'fog';
  if (includesAny(value, ['비 없음', '맑', '건조', '안정'])) return 'clear-day';
  if (includesAny(value, ['비', '강수', '접근'])) return 'rain';
  if (includesAny(value, ['구름 조금', '구름대'])) return 'partly-cloudy-day';

  return 'overcast';
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}
