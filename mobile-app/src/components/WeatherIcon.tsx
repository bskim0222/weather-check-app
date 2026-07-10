import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

type WeatherIconProps = {
  condition: string;
  style?: StyleProp<ViewStyle>;
};

export function WeatherIcon({ condition, style }: WeatherIconProps) {
  const normalizedCondition = normalizeWeatherCondition(condition);
  const stroke = getWeatherIconStroke(normalizedCondition);
  const dim = getWeatherIconDim(normalizedCondition);

  return (
    <Svg viewBox="0 0 100 100" fill="none" style={style}>
      <WeatherIconShape condition={normalizedCondition} stroke={stroke} dim={dim} />
    </Svg>
  );
}

function WeatherIconShape({
  condition,
  stroke,
  dim,
}: {
  condition: string;
  stroke: string;
  dim: string;
}) {
  if (condition === '맑음') return <SunnyShape stroke={stroke} />;
  if (condition === '비') return <RainShape stroke={stroke} />;
  if (condition === '소나기') return <ShowerShape stroke={stroke} />;
  if (condition === '천둥번개' || condition === '폭풍우') return <StormShape stroke={stroke} dim={dim} />;
  if (condition === '눈') return <SnowShape stroke={stroke} />;
  if (condition === '안개') return <FogShape stroke={stroke} />;
  if (condition === '황사') return <DustShape stroke={stroke} />;
  if (condition === '폭염') return <HeatwaveShape stroke={stroke} />;
  if (condition === '맑은 밤') return <NightShape stroke={stroke} />;
  if (condition === '무지개') return <RainbowShape stroke={stroke} />;
  if (condition === '태풍') return <TyphoonShape stroke={stroke} />;

  return <CloudShape stroke={stroke} />;
}

function SunnyShape({ stroke }: { stroke: string }) {
  const angles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  return (
    <>
      <Circle cx="50" cy="50" r="20" fill={stroke} fillOpacity="0.10" />
      <Circle cx="50" cy="50" r="16" stroke={stroke} strokeWidth="5" />
      {angles.map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const r1 = angle % 60 === 0 ? 28 : 29;
        const r2 = angle % 60 === 0 ? 38 : 35;

        return (
          <Line
            key={angle}
            x1={50 + r1 * Math.cos(rad)}
            y1={50 + r1 * Math.sin(rad)}
            x2={50 + r2 * Math.cos(rad)}
            y2={50 + r2 * Math.sin(rad)}
            stroke={stroke}
            strokeWidth={angle % 60 === 0 ? 4 : 3}
            strokeLinecap="round"
            strokeOpacity={angle % 60 === 0 ? 0.95 : 0.62}
          />
        );
      })}
    </>
  );
}

function CloudShape({ stroke }: { stroke: string }) {
  return (
    <Path
      d="M25 68 C16 68 10 61 10 53 C10 45 16 39 24 38 C25 27 35 20 45 24 C50 16 64 18 70 29 C82 30 90 39 90 51 C90 61 82 68 72 68 H25 Z"
      stroke={stroke}
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={stroke}
      fillOpacity="0.08"
    />
  );
}

function RainShape({ stroke }: { stroke: string }) {
  return (
    <>
      <CloudShape stroke={stroke} />
      {[
        [30, 74, 24, 88],
        [47, 74, 41, 88],
        [64, 74, 58, 88],
        [77, 73, 71, 86],
      ].map(([x1, y1, x2, y2]) => (
        <Line key={x1} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      ))}
    </>
  );
}

function ShowerShape({ stroke }: { stroke: string }) {
  return (
    <>
      <CloudShape stroke={stroke} />
      <Circle cx="84" cy="24" r="8" stroke={stroke} strokeWidth="4" strokeOpacity="0.62" />
      {[
        [34, 74, 29, 86],
        [52, 74, 47, 86],
        [70, 74, 65, 86],
      ].map(([x1, y1, x2, y2]) => (
        <Line key={x1} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      ))}
    </>
  );
}

function StormShape({ stroke, dim }: { stroke: string; dim: string }) {
  return (
    <>
      <Path
        d="M24 55 C16 55 11 49 11 42 C11 35 16 30 24 29 C25 20 34 14 44 17 C50 9 63 12 69 22 C80 23 88 31 88 42 C88 50 82 56 73 56"
        stroke={stroke}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M55 51 L42 69 H51 L40 91 L67 62 H56 L64 51 H55 Z"
        stroke={stroke}
        strokeWidth="4"
        strokeLinejoin="round"
        fill={stroke}
        fillOpacity="0.18"
      />
      <Line x1="25" y1="63" x2="20" y2="76" stroke={dim} strokeWidth="4" strokeLinecap="round" />
      <Line x1="79" y1="63" x2="74" y2="76" stroke={dim} strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

function SnowShape({ stroke }: { stroke: string }) {
  const flakes = [
    { cx: 27, cy: 75, r: 7 },
    { cx: 47, cy: 84, r: 6 },
    { cx: 67, cy: 75, r: 7 },
    { cx: 79, cy: 86, r: 5 },
  ];

  return (
    <>
      <CloudShape stroke={stroke} />
      {flakes.map((flake) => (
        <G key={`${flake.cx}-${flake.cy}`}>
          {[0, 60, 120].map((angle) => {
            const rad = (angle * Math.PI) / 180;

            return (
              <Line
                key={angle}
                x1={flake.cx - flake.r * Math.cos(rad)}
                y1={flake.cy - flake.r * Math.sin(rad)}
                x2={flake.cx + flake.r * Math.cos(rad)}
                y2={flake.cy + flake.r * Math.sin(rad)}
                stroke={stroke}
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}
        </G>
      ))}
    </>
  );
}

function FogShape({ stroke }: { stroke: string }) {
  return (
    <>
      <CloudShape stroke={stroke} />
      {[72, 82, 92].map((y, index) => (
        <Line
          key={y}
          x1={index === 1 ? 22 : 14}
          y1={y}
          x2={index === 1 ? 78 : 86}
          y2={y}
          stroke={stroke}
          strokeWidth="5"
          strokeLinecap="round"
          strokeOpacity={0.84 - index * 0.16}
        />
      ))}
    </>
  );
}

function DustShape({ stroke }: { stroke: string }) {
  return (
    <>
      <Circle cx="50" cy="35" r="16" stroke={stroke} strokeWidth="5" strokeOpacity="0.5" />
      {[55, 68, 81].map((y, index) => (
        <Line
          key={y}
          x1="15"
          y1={y}
          x2="85"
          y2={y}
          stroke={stroke}
          strokeWidth="5"
          strokeLinecap="round"
          strokeOpacity={0.72 - index * 0.14}
        />
      ))}
      {[28, 42, 61, 74].map((cx, index) => (
        <Circle key={cx} cx={cx} cy={36 + index * 8} r="3.2" fill={stroke} fillOpacity="0.54" />
      ))}
    </>
  );
}

function HeatwaveShape({ stroke }: { stroke: string }) {
  return (
    <>
      <SunnyShape stroke={stroke} />
      {[75, 86].map((y) => (
        <Path
          key={y}
          d={`M18 ${y} C28 ${y - 6} 38 ${y + 6} 50 ${y} C62 ${y - 6} 72 ${y + 6} 82 ${y}`}
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeOpacity="0.74"
        />
      ))}
    </>
  );
}

function NightShape({ stroke }: { stroke: string }) {
  return (
    <>
      <Path
        d="M58 16 C43 18 31 32 31 49 C31 67 45 81 63 82 C53 76 47 64 47 50 C47 35 55 23 67 18 C64 16 61 15.5 58 16 Z"
        stroke={stroke}
        strokeWidth="5"
        strokeLinejoin="round"
        fill={stroke}
        fillOpacity="0.08"
      />
      {[
        [73, 27, 4],
        [82, 47, 3],
        [60, 13, 3],
      ].map(([cx, cy, r]) => (
        <G key={`${cx}-${cy}`}>
          <Line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={stroke} strokeWidth="3" strokeLinecap="round" />
          <Line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        </G>
      ))}
    </>
  );
}

function RainbowShape({ stroke }: { stroke: string }) {
  return (
    <>
      {[40, 32, 24, 16].map((radius, index) => (
        <Path
          key={radius}
          d={`M ${50 - radius} 74 A ${radius} ${radius} 0 0 1 ${50 + radius} 74`}
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeOpacity={0.95 - index * 0.16}
        />
      ))}
      <CloudShape stroke={stroke} />
    </>
  );
}

function TyphoonShape({ stroke }: { stroke: string }) {
  return (
    <>
      <Path d="M50 50 Q82 50 72 86" stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      <Path d="M50 50 Q50 82 14 72" stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      <Path d="M50 50 Q18 50 28 14" stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      <Path d="M50 50 Q50 18 86 28" stroke={stroke} strokeWidth="5" strokeLinecap="round" />
      <Circle cx="50" cy="50" r="9" stroke={stroke} strokeWidth="5" />
    </>
  );
}

function normalizeWeatherCondition(condition: string) {
  const value = condition.toLowerCase();

  if (includesAny(value, ['태풍', 'typhoon', 'cyclone'])) return '태풍';
  if (includesAny(value, ['폭풍우', 'stormy'])) return '폭풍우';
  if (includesAny(value, ['천둥', '번개', 'thunder', 'storm'])) return '천둥번개';
  if (includesAny(value, ['소나기', 'shower'])) return '소나기';
  if (includesAny(value, ['눈', '진눈', 'snow', 'sleet'])) return '눈';
  if (includesAny(value, ['안개', '시야', 'fog', 'mist'])) return '안개';
  if (includesAny(value, ['황사', '미세먼지', '먼지', 'dust', 'air quality'])) return '황사';
  if (includesAny(value, ['폭염', '무더위', 'heatwave', 'hot'])) return '폭염';
  if (includesAny(value, ['무지개', 'rainbow'])) return '무지개';
  if (includesAny(value, ['맑은 밤', 'night'])) return '맑은 밤';
  if (includesAny(value, ['비 없음', '강수 없음', 'no rain', '맑', 'clear', 'sunny', '건조', '안정'])) return '맑음';
  if (includesAny(value, ['비', '강수', 'rain'])) return '비';
  if (includesAny(value, ['흐림', '구름', 'cloud', 'overcast'])) return '흐림';

  return '흐림';
}

function getWeatherIconStroke(condition: string) {
  if (condition === '비') return '#246a86';
  if (condition === '소나기') return '#1f6f8d';
  if (condition === '천둥번개' || condition === '폭풍우') return '#222222';
  if (condition === '눈') return '#6f8895';
  if (condition === '맑음') return '#886c00';
  if (condition === '맑은 밤') return '#5d5186';
  if (condition === '안개') return '#626262';
  if (condition === '황사') return '#7a5a18';
  if (condition === '폭염') return '#8b2a1a';
  if (condition === '무지개') return '#276d58';
  if (condition === '태풍') return '#405480';

  return '#49535c';
}

function getWeatherIconDim(condition: string) {
  if (condition === '비') return '#7fb2c8';
  if (condition === '소나기') return '#8cc1d8';
  if (condition === '천둥번개' || condition === '폭풍우') return '#777777';
  if (condition === '눈') return '#9fb2bd';

  return getWeatherIconStroke(condition);
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}
