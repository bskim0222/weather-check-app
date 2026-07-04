import { Image } from 'react-native';
import type { ImageStyle, StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

type ProviderServiceIconProps = {
  mark?: string;
  name: string;
  style?: StyleProp<ViewStyle | ImageStyle>;
};

const yrLogo = require('../../assets/icon-yr.png');

export function ProviderServiceIcon({ mark, name, style }: ProviderServiceIconProps) {
  const provider = normalizeProvider(name);

  if (provider === 'kma') {
    return (
      <Svg viewBox="0 0 64 64" fill="none" style={style}>
        <Circle cx="32" cy="32" r="29" fill="#ffffff" />
        <Circle cx="32" cy="30" r="27" fill="#003B70" />
        <Path
          d="M57.5 34.5C57.5 18.4 46.4 8 32.2 8C19.8 8 9.5 16 6.6 27.3C12.2 17.2 22.4 10.9 34.1 10.9C47.2 10.9 57.5 21.2 57.5 34.5Z"
          fill="#E6002D"
        />
        <Path
          d="M8.5 30.6C11 20 21 13.3 32.1 13.3C45.2 13.3 54.7 22.7 54.7 35C54.7 45.2 48.1 53.2 38.9 56.2C45.9 51.9 49.8 45.1 49.3 38.6C48.7 30.4 41.1 25.8 33.8 29.6C29.2 32 27.4 36.7 23.2 38.4C17.4 40.8 11.6 36.3 8.5 30.6Z"
          fill="#ffffff"
        />
        <Path
          d="M49.1 39C49.2 47.5 42.3 55.1 32.4 57C20.2 57.1 10.2 48.9 7.1 37.7C11.5 42.5 18.1 44.1 24.4 41.5C29.3 39.5 31.6 34.2 35.7 32C42 28.6 48.7 32.1 49.1 39Z"
          fill="#003B70"
        />
      </Svg>
    );
  }

  if (provider === 'yr') {
    return <Image source={yrLogo} resizeMode="contain" style={style as StyleProp<ImageStyle>} />;
  }

  if (provider === 'fmi') {
    return (
      <Svg viewBox="0 0 64 64" fill="none" style={style}>
        <Circle cx="32" cy="32" r="27" stroke="#34308D" strokeWidth="3" />
        <Circle cx="32" cy="32" r="18" stroke="#34308D" strokeWidth="2.5" />
        <Circle cx="32" cy="32" r="9" stroke="#34308D" strokeWidth="2.5" />
        <Path d="M5 32H59" stroke="#34308D" strokeWidth="2.5" strokeLinecap="round" />
        <Path d="M32 5C20 15.8 20 48.2 32 59" stroke="#34308D" strokeWidth="2.5" strokeLinecap="round" />
        <Path d="M32 5C44 15.8 44 48.2 32 59" stroke="#34308D" strokeWidth="2.5" strokeLinecap="round" />
        <Path d="M10.5 17.5C24.5 24.5 39.5 24.5 53.5 17.5" stroke="#34308D" strokeWidth="2.5" strokeLinecap="round" />
        <Path d="M10.5 46.5C24.5 39.5 39.5 39.5 53.5 46.5" stroke="#34308D" strokeWidth="2.5" strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg viewBox="0 0 64 64" fill="none" style={style}>
      <Rect x="6" y="6" width="52" height="52" rx="18" fill="#242424" />
      <SvgText
        x="32"
        y="38"
        fill="#f4f5f2"
        fontSize={mark && mark.length > 2 ? '16' : '20'}
        fontWeight="900"
        textAnchor="middle"
      >
        {mark ?? 'WX'}
      </SvgText>
    </Svg>
  );
}

function normalizeProvider(name: string) {
  const normalizedName = name.toLowerCase();

  if (name.includes('핀란드') || normalizedName.includes('fmi') || normalizedName.includes('ecmwf')) return 'fmi';
  if (name.includes('노르웨이') || normalizedName.includes('yr') || normalizedName.includes('norway')) return 'yr';
  if (name.includes('대한민국') || name === '기상청' || normalizedName.includes('kma')) return 'kma';
  if (normalizedName.includes('windy')) return 'fmi';

  return 'unknown';
}
