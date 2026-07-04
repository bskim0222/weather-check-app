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
      <Circle cx="50" cy="50" r="22" fill={stroke} fillOpacity="0.15" />
      {angles.map((angle) => {
        const r1 = 26;
        const r2 = angle % 60 === 0 ? 36 : 31;
        const rad = (angle * Math.PI) / 180;

        return (
          <Line
            key={angle}
            x1={50 + r1 * Math.cos(rad)}
            y1={50 + r1 * Math.sin(rad)}
            x2={50 + r2 * Math.cos(rad)}
            y2={50 + r2 * Math.sin(rad)}
            stroke={stroke}
            strokeWidth={angle % 60 === 0 ? 2.2 : 1.4}
            strokeLinecap="round"
            strokeOpacity={angle % 60 === 0 ? 1 : 0.55}
          />
        );
      })}
      <Circle cx="50" cy="50" r="18" stroke={stroke} strokeWidth="2" />
      <Circle cx="50" cy="50" r="10" stroke={stroke} strokeWidth="1.6" strokeOpacity="0.4" />
    </>
  );
}

function CloudShape({ stroke }: { stroke: string }) {
  return (
    <>
      <Path
        d="M72 62 C78 62 82 57 82 52 C82 47 78 43 72 43 C71 37 65 32 58 33 C55 27 48 23 40 26 C33 23 26 28 25 35 C19 36 15 41 15 47 C15 53 20 58 26 58"
        stroke={stroke}
        strokeWidth="1.8"
        strokeOpacity="0.35"
        strokeLinecap="round"
      />
      <Path
        d="M74 68 C80 68 85 63 85 57 C85 51 80 47 74 47 C73 40 67 34 59 35 C56 28 48 24 40 27 C33 24 25 30 24 38 C17 39 12 45 12 52 C12 59 18 65 25 65"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </>
  );
}

function RainShape({ stroke }: { stroke: string }) {
  const drops = [
    { x1: 26, y1: 58, x2: 23, y2: 67 },
    { x1: 36, y1: 62, x2: 33, y2: 71 },
    { x1: 46, y1: 58, x2: 43, y2: 67 },
    { x1: 56, y1: 62, x2: 53, y2: 71 },
    { x1: 66, y1: 58, x2: 63, y2: 67 },
    { x1: 31, y1: 70, x2: 28, y2: 79 },
    { x1: 51, y1: 70, x2: 48, y2: 79 },
    { x1: 71, y1: 70, x2: 68, y2: 79 },
  ];

  return (
    <>
      <Path
        d="M76 54 C82 54 87 49 87 43 C87 37 82 33 76 33 C75 26 68 20 60 21 C57 14 48 10 40 13 C33 11 25 17 24 25 C17 26 12 32 12 39 C12 46 18 52 25 52"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {drops.map((drop) => (
        <Line
          key={`${drop.x1}-${drop.y1}`}
          x1={drop.x1}
          y1={drop.y1}
          x2={drop.x2}
          y2={drop.y2}
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

function ShowerShape({ stroke }: { stroke: string }) {
  return (
    <>
      <Path
        d="M74 50 C80 50 84 45 84 40 C84 35 80 31 74 31 C73 25 67 20 59 21 C56 15 48 11 40 14 C33 12 26 18 25 26 C18 27 13 33 13 40 C13 46 18 51 25 51"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <Circle cx="88" cy="20" r="7" stroke={stroke} strokeWidth="1.8" strokeOpacity="0.5" />
      {[30, 45, 60, 72].map((x) => (
        <Line key={x} x1={x} y1="56" x2={x - 3} y2="64" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      ))}
    </>
  );
}

function StormShape({ stroke, dim }: { stroke: string; dim: string }) {
  return (
    <>
      <Path
        d="M76 46 C83 46 88 40 88 34 C88 28 83 23 76 23 C75 16 68 10 59 11 C56 4 47 0 39 3 C32 1 24 7 23 16 C16 17 11 23 11 31 C11 38 17 44 24 44"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <Path
        d="M54 46 L44 60 L50 60 L40 78 L60 58 L53 58 Z"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill={stroke}
        fillOpacity="0.12"
      />
      <Line x1="20" y1="48" x2="17" y2="58" stroke={dim} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="80" y1="48" x2="77" y2="58" stroke={dim} strokeWidth="1.5" strokeLinecap="round" />
    </>
  );
}

function SnowShape({ stroke }: { stroke: string }) {
  const flakes = [
    { cx: 24, cy: 60, r: 6 },
    { cx: 36, cy: 66, r: 4.5 },
    { cx: 50, cy: 60, r: 7 },
    { cx: 64, cy: 66, r: 5 },
    { cx: 76, cy: 60, r: 4 },
  ];

  return (
    <>
      <Path
        d="M74 50 C80 50 85 45 85 39 C85 33 80 29 74 29 C73 22 66 17 58 18 C55 11 46 7 38 10 C31 8 23 14 22 22 C15 23 10 29 10 36 C10 43 16 49 23 49"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
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
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            );
          })}
          <Circle cx={flake.cx} cy={flake.cy} r="1" fill={stroke} />
        </G>
      ))}
    </>
  );
}

function FogShape({ stroke }: { stroke: string }) {
  const lines = [
    { x1: 20, y: 32, x2: 80, opacity: 0.35 },
    { x1: 14, y: 44, x2: 86, opacity: 0.55 },
    { x1: 25, y: 56, x2: 75, opacity: 0.72 },
    { x1: 17, y: 68, x2: 83, opacity: 0.55 },
    { x1: 28, y: 80, x2: 72, opacity: 0.35 },
  ];

  return (
    <>
      {lines.map((line) => (
        <Line
          key={line.y}
          x1={line.x1}
          y1={line.y}
          x2={line.x2}
          y2={line.y}
          stroke={stroke}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeOpacity={line.opacity}
        />
      ))}
    </>
  );
}

function DustShape({ stroke }: { stroke: string }) {
  const particles = [
    { cx: 30, cy: 45, r: 3 },
    { cx: 55, cy: 35, r: 2 },
    { cx: 70, cy: 50, r: 2.5 },
    { cx: 42, cy: 60, r: 2 },
    { cx: 65, cy: 68, r: 3 },
    { cx: 25, cy: 65, r: 2 },
    { cx: 80, cy: 40, r: 1.5 },
  ];

  return (
    <>
      <Circle cx="50" cy="38" r="16" stroke={stroke} strokeWidth="2" strokeOpacity="0.4" />
      <Circle cx="50" cy="38" r="10" fill={stroke} fillOpacity="0.2" />
      {[58, 68, 78].map((y, index) => (
        <Line
          key={y}
          x1="15"
          y1={y}
          x2="85"
          y2={y}
          stroke={stroke}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeOpacity={0.5 - index * 0.08}
        />
      ))}
      {particles.map((particle) => (
        <Circle
          key={`${particle.cx}-${particle.cy}`}
          cx={particle.cx}
          cy={particle.cy}
          r={particle.r}
          fill={stroke}
          fillOpacity="0.5"
        />
      ))}
    </>
  );
}

function HeatwaveShape({ stroke }: { stroke: string }) {
  return (
    <>
      <Circle cx="50" cy="36" r="18" fill={stroke} fillOpacity="0.2" />
      <Circle cx="50" cy="36" r="14" stroke={stroke} strokeWidth="2.2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;

        return (
          <Line
            key={angle}
            x1={50 + 18 * Math.cos(rad)}
            y1={36 + 18 * Math.sin(rad)}
            x2={50 + 26 * Math.cos(rad)}
            y2={36 + 26 * Math.sin(rad)}
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}
      {[62, 72, 82].map((y, index) => (
        <Path
          key={y}
          d={`M18 ${y} C28 ${y - 4} 38 ${y + 4} 50 ${y} C62 ${y - 4} 72 ${y + 4} 82 ${y}`}
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity={1 - index * 0.2}
        />
      ))}
    </>
  );
}

function NightShape({ stroke }: { stroke: string }) {
  const stars = [
    { cx: 68, cy: 20, r: 3 },
    { cx: 78, cy: 38, r: 2 },
    { cx: 60, cy: 12, r: 2 },
    { cx: 76, cy: 52, r: 2.5 },
  ];

  return (
    <>
      <Path
        d="M55 18 C40 20 28 34 28 50 C28 66 40 80 56 80 C42 76 32 64 32 50 C32 35 44 22 58 20 C57 18.5 56 18 55 18 Z"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {stars.map((star) => (
        <G key={`${star.cx}-${star.cy}`}>
          <Line x1={star.cx - star.r} y1={star.cy} x2={star.cx + star.r} y2={star.cy} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <Line x1={star.cx} y1={star.cy - star.r} x2={star.cx} y2={star.cy + star.r} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </G>
      ))}
    </>
  );
}

function RainbowShape({ stroke }: { stroke: string }) {
  const arcs = [
    { radius: 44, color: '#E04040' },
    { radius: 38, color: '#E08020' },
    { radius: 32, color: '#D4C000' },
    { radius: 26, color: '#40A040' },
    { radius: 20, color: '#2060C0' },
    { radius: 14, color: '#6020A0' },
  ];

  return (
    <>
      {arcs.map((arc) => (
        <Path
          key={arc.radius}
          d={`M ${50 - arc.radius} 72 A ${arc.radius} ${arc.radius} 0 0 1 ${50 + arc.radius} 72`}
          stroke={arc.color}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ))}
      <Circle cx="82" cy="30" r="10" stroke={stroke} strokeWidth="1.8" strokeOpacity="0.65" />
      <Path
        d="M28 55 C22 55 16 51 16 45 C16 39 22 35 28 36 C29 30 35 26 42 28 C46 22 54 24 56 30 C60 29 65 33 65 39 C65 44 60 48 55 48"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
    </>
  );
}

function TyphoonShape({ stroke }: { stroke: string }) {
  return (
    <>
      {[0, 90, 180, 270].map((startAngle) => (
        <Path
          key={startAngle}
          d={`M 50 50 Q ${50 + 30 * Math.cos((startAngle * Math.PI) / 180)} ${50 + 30 * Math.sin((startAngle * Math.PI) / 180)} ${50 + 42 * Math.cos(((startAngle + 60) * Math.PI) / 180)} ${50 + 42 * Math.sin(((startAngle + 60) * Math.PI) / 180)}`}
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
      <Circle cx="50" cy="50" r="8" stroke={stroke} strokeWidth="2.2" />
      <Circle cx="50" cy="50" r="3" fill={stroke} fillOpacity="0.5" />
      <Circle cx="50" cy="50" r="38" stroke={stroke} strokeWidth="0.8" strokeOpacity="0.2" strokeDasharray="4 6" />
    </>
  );
}

function normalizeWeatherCondition(condition: string) {
  const value = condition.toLowerCase();

  if (includesAny(value, ['태풍', 'typhoon', 'cyclone'])) return '태풍';
  if (includesAny(value, ['폭풍우', 'stormy'])) return '폭풍우';
  if (includesAny(value, ['천둥', '번개', 'thunder', 'storm', '불안정'])) return '천둥번개';
  if (includesAny(value, ['소나기', 'shower'])) return '소나기';
  if (includesAny(value, ['눈', '진눈', 'snow', 'sleet', '찬 공기', '눈구름'])) return '눈';
  if (includesAny(value, ['안개', '시야', 'fog', 'mist', '습함', '낮은 구름'])) return '안개';
  if (includesAny(value, ['황사', '미세먼지', '먼지', 'dust'])) return '황사';
  if (includesAny(value, ['폭염', 'heatwave', '무더위'])) return '폭염';
  if (includesAny(value, ['무지개', 'rainbow'])) return '무지개';
  if (includesAny(value, ['맑은 밤', 'night'])) return '맑은 밤';
  if (includesAny(value, ['비 없음', '강수 없음', 'no rain', '맑', 'clear', 'sunny', '건조', '안정'])) return '맑음';
  if (includesAny(value, ['비', '강수', 'rain', '접근'])) return '비';
  if (includesAny(value, ['흐림', '구름', 'cloud', 'overcast', '구름대'])) return '흐림';

  return '흐림';
}

function getWeatherIconStroke(condition: string) {
  if (condition === '맑음') return '#8A6400';
  if (condition === '비') return '#1A6FD4';
  if (condition === '소나기') return '#0A3860';
  if (condition === '천둥번개' || condition === '폭풍우') return '#111111';
  if (condition === '눈') return '#2A6090';
  if (condition === '안개') return '#606060';
  if (condition === '황사') return '#6A4400';
  if (condition === '폭염') return '#4A0800';
  if (condition === '맑은 밤') return '#806AC0';
  if (condition === '무지개') return '#1A4A38';
  if (condition === '태풍') return '#6080D0';

  return '#3A4550';
}

function getWeatherIconDim(condition: string) {
  if (condition === '비') return '#80B8F0';
  if (condition === '소나기') return '#88C0E8';
  if (condition === '천둥번개' || condition === '폭풍우') return '#666666';
  if (condition === '눈') return '#3A7098';

  return getWeatherIconStroke(condition);
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}
