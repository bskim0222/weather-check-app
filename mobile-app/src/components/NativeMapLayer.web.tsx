import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { appConfig } from '../config/appConfig';
import { styles } from '../styles/appStyles';
import type { MapReportCluster, SearchContext } from '../types/weather';

type NativeMapLayerProps = {
  searchContext: SearchContext;
  selectedIndex: number;
  visibleClusters: MapReportCluster[];
  onSelectCluster: (index: number) => void;
};

type KakaoWindow = Window & {
  kakao?: {
    maps?: {
      load: (callback: () => void) => void;
      LatLng: new (latitude: number, longitude: number) => unknown;
      Map: new (container: HTMLElement, options: Record<string, unknown>) => {
        setCenter?: (center: unknown) => void;
        setLevel?: (level: number) => void;
        addControl?: (control: unknown, position: unknown) => void;
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

const KAKAO_SCRIPT_ID = 'weather-check-kakao-map-sdk';

export function NativeMapLayer({
  searchContext,
  selectedIndex,
  visibleClusters,
  onSelectCluster,
}: NativeMapLayerProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const mapRef = useRef<unknown | null>(null);
  const overlaysRef = useRef<Array<{ setMap: (map: unknown | null) => void }>>([]);
  const [kakaoReady, setKakaoReady] = useState(false);
  const [kakaoFailed, setKakaoFailed] = useState(false);
  const [kakaoMapMounted, setKakaoMapMounted] = useState(false);
  const center = useMemo(() => resolveMapCenter(searchContext), [searchContext]);
  const shouldUseKakao = appConfig.kakaoJavaScriptKey.trim().length > 0 && !kakaoFailed;

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
      const map = new kakao.Map(containerRef.current, {
        center: mapCenter,
        level: 4,
      });
      mapRef.current = map;

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
    if (!CustomOverlay) return;

    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];

    const nextOverlays = visibleClusters.slice(0, clusterCoordinateOffsets.length).map((cluster, index) => {
      const offset = clusterCoordinateOffsets[index];
      const coordinate = new kakao.LatLng(center.latitude + offset.latitude, center.longitude + offset.longitude);
      const element = createClusterElement(cluster, index === selectedIndex);

      element.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectCluster(index);
      });
      element.addEventListener('touchend', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectCluster(index);
      });

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

    overlaysRef.current = nextOverlays;

    return () => {
      nextOverlays.forEach((overlay) => overlay.setMap(null));
    };
  }, [
    center.latitude,
    center.longitude,
    kakaoReady,
    onSelectCluster,
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
              style: {
                bottom: 0,
                left: 0,
                overscrollBehavior: 'contain',
                position: 'absolute',
                right: 0,
                top: 0,
                touchAction: 'none',
              },
            })}
        <MapProviderBadge label={kakaoMapMounted ? 'Kakao Map' : 'Kakao Loading'} />
      </View>
    );
  }

  return <OpenStreetMapLayer center={center} place={searchContext.place} />;
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
              height: '100%',
              width: '100%',
              filter: 'saturate(0.78) contrast(0.94) brightness(1.03)',
              touchAction: 'none',
            },
            loading: 'lazy',
            referrerPolicy: 'no-referrer-when-downgrade',
          })}
      <MapProviderBadge label="Fallback Map" />
    </View>
  );
}

const clusterCoordinateOffsets = [
  { latitude: 0.0042, longitude: -0.0048 },
  { latitude: 0.0012, longitude: 0.0054 },
  { latitude: -0.0034, longitude: -0.0018 },
  { latitude: -0.0046, longitude: 0.0042 },
  { latitude: 0.0002, longitude: -0.0062 },
  { latitude: 0.0052, longitude: 0.0016 },
] as const;

function createClusterElement(cluster: MapReportCluster, isActive: boolean) {
  const element = document.createElement('button');
  const isDark = isDarkCluster(cluster);

  element.type = 'button';
  element.textContent = String(cluster.count);
  element.setAttribute('aria-label', `${cluster.label} 현장 글 ${cluster.count}개 보기`);
  element.style.minWidth = isActive ? '64px' : '54px';
  element.style.height = isActive ? '64px' : '54px';
  element.style.borderRadius = isActive ? '32px' : '27px';
  element.style.border = isActive ? '4px solid #ffffff' : '2px solid rgba(255,255,255,0.72)';
  element.style.background = getClusterTone(cluster);
  element.style.color = isDark ? '#ffffff' : '#242424';
  element.style.cursor = 'pointer';
  element.style.fontSize = '18px';
  element.style.fontWeight = '900';
  element.style.lineHeight = '22px';
  element.style.padding = '0 14px';
  element.style.boxShadow = '0 14px 22px rgba(36,36,36,0.20)';
  element.style.backdropFilter = 'blur(8px)';
  element.style.setProperty('-webkit-backdrop-filter', 'blur(8px)');
  element.style.transform = isActive ? 'scale(1.06)' : 'scale(1)';
  element.style.touchAction = 'manipulation';
  element.style.userSelect = 'none';

  return element;
}

function getClusterTone(cluster: MapReportCluster) {
  const condition = cluster.dominantCondition;

  if (condition.includes('비') || condition.includes('소나기')) return 'rgba(47, 134, 217, 0.76)';
  if (condition.includes('눈')) return 'rgba(216, 239, 248, 0.82)';
  if (condition.includes('천둥') || condition.includes('번개')) return 'rgba(48, 43, 63, 0.78)';
  if (condition.includes('안개')) return 'rgba(216, 208, 193, 0.80)';
  if (condition.includes('황사') || condition.includes('미세')) return 'rgba(215, 189, 122, 0.82)';
  if (condition.includes('맑')) return 'rgba(255, 240, 90, 0.80)';
  if (condition.includes('흐') || condition.includes('구름')) return 'rgba(191, 201, 189, 0.82)';

  return 'rgba(36, 36, 36, 0.72)';
}

function isDarkCluster(cluster: MapReportCluster) {
  const condition = cluster.dominantCondition;
  return (
    condition.includes('비')
    || condition.includes('소나기')
    || condition.includes('천둥')
    || condition.includes('번개')
  );
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
