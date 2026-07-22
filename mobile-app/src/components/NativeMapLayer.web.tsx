import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { appConfig } from '../config/appConfig';
import { getPrivacySafePlaceName } from '../domain/locationDisplay';
import { hasMapTargetCoordinates, isValidKoreaMapCoordinate, type MapCoordinate } from '../domain/mapClustering';
import { styles } from '../styles/appStyles';
import type { MapReportCluster, SearchContext } from '../types/weather';

type KakaoWindow = Window & {
  kakao?: {
    maps?: {
      load: (callback: () => void) => void;
      LatLng: new (latitude: number, longitude: number) => unknown;
      Map: new (container: HTMLElement, options: Record<string, unknown>) => {
        setCenter?: (center: unknown) => void;
        setLevel?: (level: number) => void;
        getLevel?: () => number;
        addControl?: (control: unknown, position: unknown) => void;
      };
      event?: {
        addListener: (target: unknown, eventName: string, handler: () => void) => void;
      };
      CustomOverlay?: new (options: Record<string, unknown>) => {
        setMap: (map: unknown | null) => void;
      };
      ZoomControl?: new () => unknown;
      ControlPosition?: {
        RIGHT?: unknown;
      };
    };
  };
};

type NativeMapLayerProps = {
  onClusterGridChange: (gridDegrees: number) => void;
  currentLocation?: MapCoordinate;
  currentLocationLabel: string;
  searchContext: SearchContext;
  selectedIndex: number;
  visibleClusters: MapReportCluster[];
  onSelectCluster: (index: number) => void;
};

const KAKAO_SCRIPT_ID = 'weather-check-kakao-map-sdk';

export function NativeMapLayer({
  onClusterGridChange,
  currentLocation,
  currentLocationLabel,
  searchContext,
  selectedIndex,
  visibleClusters,
  onSelectCluster,
}: NativeMapLayerProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const onClusterGridChangeRef = useRef(onClusterGridChange);
  const mapRef = useRef<unknown | null>(null);
  const centerOverlayRef = useRef<{ setMap: (map: unknown | null) => void } | null>(null);
  const currentLocationOverlayRef = useRef<{ setMap: (map: unknown | null) => void } | null>(null);
  const overlaysRef = useRef<Array<{ setMap: (map: unknown | null) => void }>>([]);
  const [kakaoReady, setKakaoReady] = useState(false);
  const [kakaoFailed, setKakaoFailed] = useState(false);
  const [kakaoMapMounted, setKakaoMapMounted] = useState(false);
  const center = useMemo(() => resolveMapCenter(searchContext), [searchContext]);
  const hasVerifiedCenter = hasMapTargetCoordinates(searchContext);
  const shouldUseKakao = appConfig.kakaoJavaScriptKey.trim().length > 0 && !kakaoFailed;

  onClusterGridChangeRef.current = onClusterGridChange;

  useEffect(() => {
    if (!shouldUseKakao || typeof document === 'undefined') return;

    loadKakaoMapScript(appConfig.kakaoJavaScriptKey)
      .then(() => setKakaoReady(true))
      .catch(() => setKakaoFailed(true));
  }, [shouldUseKakao]);

  useEffect(() => {
    if (!shouldUseKakao || !kakaoReady || !containerRef.current) return;

    const kakao = (window as KakaoWindow).kakao?.maps;
    if (!kakao) {
      setKakaoFailed(true);
      return;
    }

    let isDisposed = false;

    kakao.load(() => {
      if (!containerRef.current || isDisposed) return;

      const mapCenter = new kakao.LatLng(center.latitude, center.longitude);

      if (mapRef.current && 'setCenter' in (mapRef.current as Record<string, unknown>)) {
        (mapRef.current as { setCenter?: (nextCenter: unknown) => void }).setCenter?.(mapCenter);
        return;
      }

      const map = new kakao.Map(containerRef.current, {
        center: mapCenter,
        // A 1.5 km privacy grid can move a public marker several hundred
        // metres from the searched point. Level 6 keeps that safe marker in
        // view on narrow phones instead of making it appear to be missing.
        level: 6,
      });
      mapRef.current = map;

      const syncClusterGrid = () => {
        onClusterGridChangeRef.current(getGridDegreesForKakaoLevel(map.getLevel?.() ?? 6));
      };
      syncClusterGrid();
      kakao.event?.addListener(map, 'zoom_changed', syncClusterGrid);

      if (kakao.ZoomControl && kakao.ControlPosition?.RIGHT && map.addControl) {
        map.addControl(new kakao.ZoomControl(), kakao.ControlPosition.RIGHT);
      }

      setKakaoMapMounted(true);
    });

    return () => {
      isDisposed = true;
    };
  }, [center.latitude, center.longitude, kakaoReady, shouldUseKakao]);

  useEffect(() => {
    if (!shouldUseKakao || !kakaoReady || !mapRef.current) return;

    const kakao = (window as KakaoWindow).kakao?.maps;
    const CustomOverlay = kakao?.CustomOverlay;
    if (!kakao || !CustomOverlay) return;

    centerOverlayRef.current?.setMap(null);
    currentLocationOverlayRef.current?.setMap(null);
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];

    const centerOverlay = hasVerifiedCenter && searchContext.target.kind !== 'current'
      ? new CustomOverlay({
          clickable: false,
          content: createLocationPinElement('search', searchContext.place),
          position: new kakao.LatLng(center.latitude, center.longitude),
          xAnchor: 0.5,
          yAnchor: 1,
          zIndex: 35,
        })
      : null;
    centerOverlay?.setMap(mapRef.current);
    centerOverlayRef.current = centerOverlay;

    const currentOverlay = isValidKoreaMapCoordinate(currentLocation)
      ? new CustomOverlay({
          clickable: false,
          content: createLocationPinElement('current', getPrivacySafePlaceName(currentLocationLabel)),
          position: new kakao.LatLng(currentLocation.latitude, currentLocation.longitude),
          xAnchor: 0.5,
          yAnchor: 1,
          zIndex: 36,
        })
      : null;
    currentOverlay?.setMap(mapRef.current);
    currentLocationOverlayRef.current = currentOverlay;

    const nextOverlays = visibleClusters.map((cluster, index) => {
      if (!isValidKoreaMapCoordinate(cluster)) return null;
      const latitude = cluster.latitude;
      const longitude = cluster.longitude;
      const coordinate = new kakao.LatLng(latitude, longitude);
      const element = createClusterElement(cluster, index === selectedIndex);

      const openSheet = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectCluster(index);
      };

      const openSheetFromKeyboard = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        openSheet(event);
      };

      element.addEventListener('click', openSheet);
      element.addEventListener('touchend', openSheet);
      element.addEventListener('keydown', openSheetFromKeyboard);

      const overlay = new CustomOverlay({
        clickable: true,
        content: element,
        position: coordinate,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: index === selectedIndex ? 30 : 20,
      });

      overlay.setMap(mapRef.current);
      return overlay;
    });

    overlaysRef.current = nextOverlays.filter((overlay): overlay is NonNullable<typeof overlay> => Boolean(overlay));

    return () => {
      centerOverlay?.setMap(null);
      currentOverlay?.setMap(null);
      if (centerOverlayRef.current === centerOverlay) centerOverlayRef.current = null;
      if (currentLocationOverlayRef.current === currentOverlay) currentLocationOverlayRef.current = null;
      nextOverlays.forEach((overlay) => overlay?.setMap(null));
    };
  }, [
    center.latitude,
    center.longitude,
    currentLocation,
    currentLocationLabel,
    kakaoReady,
    kakaoMapMounted,
    hasVerifiedCenter,
    onSelectCluster,
    searchContext.place,
    searchContext.target.kind,
    selectedIndex,
    shouldUseKakao,
    visibleClusters,
  ]);

  if (shouldUseKakao) {
    return (
      <View style={styles.mapTileLayer}>
        {typeof document === 'undefined'
          ? null
          : createElement('div', {
              ref: containerRef,
              'data-weather-check-map-cluster-count': String(visibleClusters.length),
              'data-weather-check-map-mounted': kakaoMapMounted ? 'true' : 'false',
              style: {
                bottom: 0,
                left: 0,
                overscrollBehavior: 'contain',
                position: 'absolute',
                right: 0,
                top: 0,
                touchAction: 'auto',
              },
            })}
        <MapProviderBadge label={kakaoMapMounted ? 'Kakao Map' : 'Kakao Loading'} />
      </View>
    );
  }

  return (
    <OpenStreetMapLayer
      center={center}
      place={searchContext.place}
    />
  );
}

function OpenStreetMapLayer({
  center,
  place,
}: {
  center: { latitude: number; longitude: number };
  place: string;
}) {
  const mapEmbedUrl = createOpenStreetMapEmbedUrl(center.latitude, center.longitude);

  return (
    <View style={styles.mapTileLayer}>
      {typeof document === 'undefined'
        ? null
        : createElement('iframe', {
            title: `${place} map`,
            src: mapEmbedUrl,
            style: {
              border: 0,
              filter: 'saturate(0.78) contrast(0.94) brightness(1.03)',
              height: '100%',
              touchAction: 'auto',
              width: '100%',
            },
            loading: 'lazy',
            referrerPolicy: 'no-referrer-when-downgrade',
          })}
      <MapProviderBadge label="Fallback Map" />
    </View>
  );
}

function createClusterElement(cluster: MapReportCluster, isActive: boolean) {
  ensureClusterAnimationStyle();

  // Kakao CustomOverlay reliably mounts a div root. Interactive button roots
  // can be dropped by the SDK wrapper on mobile web, leaving no report marker.
  const element = document.createElement('div');
  const icon = document.createElement('span');
  const count = document.createElement('span');
  const isDark = isDarkCluster(cluster);

  icon.className = 'weather-check-cluster-icon';
  icon.textContent = cluster.kind === 'question' ? '?' : getClusterWeatherSymbol(cluster.dominantCondition);
  count.className = 'weather-check-cluster-count';
  count.textContent = String(cluster.count);

  element.className = isActive
    ? 'weather-check-cluster-marker weather-check-cluster-marker-active'
    : 'weather-check-cluster-marker';
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  const itemType = cluster.kind === 'question'
    ? '현장 문의'
    : cluster.kind === 'mixed'
      ? '현장 문의와 제보'
      : '현장 제보';
  element.setAttribute('aria-label', `${cluster.label} ${itemType} ${cluster.count}개 보기`);
  element.append(icon, count);
  element.style.background = 'transparent';
  element.style.border = '0';
  element.style.color = '#242424';
  element.style.cursor = 'pointer';
  element.style.overflow = 'visible';
  element.style.padding = '0';
  element.style.touchAction = 'manipulation';
  element.style.userSelect = 'none';

  icon.style.background = getClusterTone(cluster);
  icon.style.color = isDark ? '#ffffff' : '#242424';
  icon.style.border = isActive ? '4px solid #ffffff' : '2px solid rgba(255,255,255,0.78)';
  icon.style.boxShadow = '0 14px 22px rgba(36,36,36,0.20)';
  icon.style.backdropFilter = 'blur(8px)';
  icon.style.setProperty('-webkit-backdrop-filter', 'blur(8px)');

  return element;
}

function createLocationPinElement(kind: 'current' | 'search', place: string) {
  ensureClusterAnimationStyle();

  const element = document.createElement('div');
  const pin = document.createElement('span');
  const label = document.createElement('span');

  element.className = `weather-check-center-pin weather-check-center-pin-${kind}`;
  pin.className = `weather-check-center-pin-dot weather-check-center-pin-dot-${kind}`;
  label.className = 'weather-check-center-pin-label';
  label.textContent = place;
  element.append(pin, label);

  return element;
}

function ensureClusterAnimationStyle() {
  const existingStyle = document.getElementById('weather-check-cluster-animation-style');
  const style = existingStyle ?? document.createElement('style');
  style.id = 'weather-check-cluster-animation-style';
  style.textContent = `
    @keyframes weatherCheckClusterBounce {
      0%, 100% { transform: translateY(0) scale(1); }
      42% { transform: translateY(-9px) scale(1.06); }
      58% { transform: translateY(-5px) scale(1.03); }
    }
    @keyframes weatherCheckClusterPop {
      0%, 100% { transform: translateY(0) scale(1.08); }
      50% { transform: translateY(-9px) scale(1.15); }
    }
    @keyframes weatherCheckBadgeBounce {
      0%, 100% { transform: translateY(0) scale(1); }
      38% { transform: translateY(-13px) scale(1.12); }
      55% { transform: translateY(-8px) scale(1.06); }
      72% { transform: translateY(-2px) scale(1.02); }
    }
    @keyframes weatherCheckBadgePulse {
      0% { opacity: 0.44; transform: translate(-50%, -50%) scale(0.82); }
      70% { opacity: 0; transform: translate(-50%, -50%) scale(1.55); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(1.55); }
    }
    @keyframes weatherCheckCenterPinPulse {
      0% { opacity: 0.34; transform: translate(-50%, -50%) scale(0.84); }
      76% { opacity: 0; transform: translate(-50%, -50%) scale(1.8); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(1.8); }
    }
    .weather-check-cluster-marker {
      align-items: center;
      display: flex;
      flex-direction: column;
      gap: 4px;
      justify-content: center;
      min-height: 76px;
      min-width: 68px;
      pointer-events: auto;
      position: relative;
      transform-origin: center bottom;
      animation: weatherCheckClusterBounce 1.4s ease-in-out infinite;
      will-change: transform;
    }
    .weather-check-cluster-marker-active {
      animation: weatherCheckClusterPop 0.95s ease-in-out infinite;
    }
    .weather-check-cluster-icon {
      align-items: center;
      border-radius: 999px;
      box-sizing: border-box;
      display: block;
      font-size: 24px;
      font-weight: 900;
      height: 56px;
      line-height: 50px;
      pointer-events: none;
      position: relative;
      text-align: center;
      transform-origin: center bottom;
      animation: weatherCheckBadgeBounce 1.38s cubic-bezier(.28,.84,.42,1) infinite;
      will-change: transform;
      width: 56px;
      z-index: 2;
    }
    .weather-check-cluster-icon::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 58px;
      height: 58px;
      border-radius: 999px;
      background: currentColor;
      opacity: 0.22;
      transform: translate(-50%, -50%);
      animation: weatherCheckBadgePulse 1.38s ease-out infinite;
      z-index: -1;
    }
    .weather-check-cluster-count {
      display: block;
      min-width: 25px;
      border-radius: 999px;
      background: rgba(255,255,255,0.86);
      box-shadow: 0 8px 15px rgba(36,36,36,0.14);
      color: #242424;
      font-size: 12px;
      font-weight: 900;
      line-height: 17px;
      padding: 1px 7px;
      pointer-events: none;
      text-align: center;
    }
    .weather-check-center-pin {
      align-items: center;
      display: flex;
      flex-direction: column;
      gap: 7px;
      pointer-events: none;
      transform: translateY(-7px);
      user-select: none;
      white-space: nowrap;
    }
    .weather-check-center-pin-dot {
      align-items: center;
      width: 42px;
      height: 42px;
      border-radius: 999px;
      background: #2f7894;
      border: 4px solid rgba(255,255,255,0.96);
      box-shadow: 0 16px 28px rgba(36,36,36,0.32);
      box-sizing: border-box;
      color: #ffffff;
      display: flex;
      font-size: 25px;
      font-weight: 900;
      justify-content: center;
      line-height: 1;
      position: relative;
    }
    .weather-check-center-pin-dot::before {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 18px;
      height: 18px;
      border: 2px solid #ffffff;
      border-radius: 999px;
      box-sizing: border-box;
      transform: translate(-50%, -50%);
    }
    .weather-check-center-pin-dot::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      background: #2f7894;
      transform: translate(-50%, -50%);
      z-index: -1;
      animation: weatherCheckCenterPinPulse 1.65s ease-out infinite;
    }
    .weather-check-center-pin-dot-search,
    .weather-check-center-pin-dot-search::after {
      background: #df7e6e;
    }
    .weather-check-center-pin-search .weather-check-center-pin-label {
      background: rgba(166,74,62,0.92);
    }
    .weather-check-center-pin-label {
      max-width: 156px;
      overflow: hidden;
      text-overflow: ellipsis;
      border-radius: 999px;
      background: rgba(32,87,108,0.92);
      box-shadow: 0 10px 20px rgba(36,36,36,0.18);
      color: #ffffff;
      display: block;
      font-size: 12px;
      font-weight: 900;
      line-height: 18px;
      padding: 4px 10px;
    }
  `;
  if (!existingStyle) document.head.appendChild(style);
}

function getClusterTone(cluster: MapReportCluster) {
  if (cluster.kind === 'question') return 'rgba(242, 166, 144, 0.82)';
  const kind = getClusterWeatherKind(cluster.dominantCondition);

  if (kind === 'question') return 'rgba(242, 166, 144, 0.82)';
  if (kind === 'rain') return 'rgba(109, 178, 222, 0.74)';
  if (kind === 'snow') return 'rgba(238, 246, 247, 0.90)';
  if (kind === 'storm') return 'rgba(55, 48, 76, 0.80)';
  if (kind === 'fog') return 'rgba(216, 208, 193, 0.82)';
  if (kind === 'dust') return 'rgba(215, 189, 122, 0.82)';
  if (kind === 'clear') return 'rgba(244, 225, 91, 0.82)';
  if (kind === 'cloud') return 'rgba(191, 201, 189, 0.82)';

  return 'rgba(36, 36, 36, 0.72)';
}

function isDarkCluster(cluster: MapReportCluster) {
  const kind = getClusterWeatherKind(cluster.dominantCondition);
  return kind === 'rain' || kind === 'storm';
}

function getClusterWeatherSymbol(condition: string) {
  const kind = getClusterWeatherKind(condition);

  if (kind === 'clear') return '\u2600';
  if (kind === 'cloud') return '\u2601';
  if (kind === 'rain') return '\u2614';
  if (kind === 'storm') return '\u26A1';
  if (kind === 'snow') return '\u2744';
  if (kind === 'fog') return '≋';
  if (kind === 'dust') return '•';
  if (kind === 'question') return '?';

  return '●';
}

function getClusterWeatherKind(condition: string) {
  const value = condition.toLowerCase();

  if (value.includes('문의') || value.includes('question')) return 'question';

  if (value.includes('천둥') || value.includes('번개') || value.includes('storm') || value.includes('thunder')) {
    return 'storm';
  }
  if (value.includes('비') || value.includes('소나기') || value.includes('rain')) return 'rain';
  if (value.includes('눈') || value.includes('snow')) return 'snow';
  if (value.includes('안개') || value.includes('fog')) return 'fog';
  if (value.includes('황사') || value.includes('미세') || value.includes('dust')) return 'dust';
  if (value.includes('맑') || value.includes('clear') || value.includes('sun')) return 'clear';
  if (value.includes('흐림') || value.includes('구름') || value.includes('cloud') || value.includes('overcast')) {
    return 'cloud';
  }

  return 'field';
}

function MapProviderBadge({ label }: { label: string }) {
  return (
    <View pointerEvents="none" style={styles.mapProviderBadge}>
      <Text style={styles.mapProviderBadgeText}>{label}</Text>
    </View>
  );
}

function loadKakaoMapScript(appKey: string) {
  return new Promise<void>((resolve, reject) => {
    const kakao = (window as KakaoWindow).kakao?.maps;
    if (kakao) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(KAKAO_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Kakao map script failed')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = KAKAO_SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Kakao map script failed'));
    document.head.appendChild(script);
  });
}

function resolveMapCenter(searchContext: SearchContext) {
  return {
    latitude: searchContext.target.latitude ?? 37.5146,
    longitude: searchContext.target.longitude ?? 127.0736,
  };
}

function getGridDegreesForKakaoLevel(level: number) {
  if (level <= 4) return 0.015;
  if (level === 5) return 0.03;
  if (level === 6) return 0.06;
  if (level === 7) return 0.12;
  if (level === 8) return 0.25;
  if (level === 9) return 0.5;
  if (level === 10) return 1;
  return 2;
}

function createOpenStreetMapEmbedUrl(latitude: number, longitude: number) {
  const delta = 0.012;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join(',');

  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude},${longitude}`;
}
