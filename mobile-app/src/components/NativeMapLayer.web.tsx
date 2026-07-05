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
        getLevel?: () => number;
        addControl?: (control: unknown, position: unknown) => void;
      };
      Marker: new (options: Record<string, unknown>) => unknown;
      CustomOverlay?: new (options: Record<string, unknown>) => {
        setMap?: (map: unknown | null) => void;
      };
      ZoomControl?: new () => unknown;
      ControlPosition?: {
        RIGHT?: unknown;
      };
      event?: {
        addListener: (target: unknown, eventName: string, callback: () => void) => void;
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

    let cleanupMarkers = () => {};
    let isDisposed = false;

    kakao.load(() => {
      if (!containerRef.current || isDisposed) return;

      const mapCenter = new kakao.LatLng(center.latitude, center.longitude);
      const map = new kakao.Map(containerRef.current, {
        center: mapCenter,
        level: 4,
      });

      if (kakao.ZoomControl && kakao.ControlPosition?.RIGHT && map.addControl) {
        map.addControl(new kakao.ZoomControl(), kakao.ControlPosition.RIGHT);
      }

      setKakaoMapMounted(true);

      const renderReportMarkers = () => {
        cleanupMarkers();
        const overlays: Array<{ setMap?: (map: unknown | null) => void }> = [];
        const level = map.getLevel?.() ?? 4;
        const markerItems = getVisibleMarkerItems(visibleClusters, level);

        markerItems.forEach((item, markerIndex) => {
          const offset = getMarkerOffset(markerIndex);
          const markerPosition = new kakao.LatLng(
            center.latitude + offset.latitude,
            center.longitude + offset.longitude,
          );

          if (!kakao.CustomOverlay) return;

          const markerNode = createReportMarkerElement(
            item.cluster,
            item.clusterIndex === selectedIndex,
          );
          const selectReport = (event?: Event) => {
            event?.preventDefault();
            event?.stopPropagation();
            onSelectCluster(item.clusterIndex);
          };

          markerNode.addEventListener('click', selectReport);
          markerNode.addEventListener('touchend', selectReport, { passive: false });

          const overlay = new kakao.CustomOverlay({
            position: markerPosition,
            content: markerNode,
            map,
            yAnchor: 0.5,
            xAnchor: 0.5,
            zIndex: item.clusterIndex === selectedIndex ? 9 : 5,
          });

          overlays.push(overlay);
        });

        cleanupMarkers = () => {
          overlays.forEach((overlay) => overlay.setMap?.(null));
        };
      };

      renderReportMarkers();
      kakao.event?.addListener(map, 'zoom_changed', renderReportMarkers);
    });

    return () => {
      isDisposed = true;
      cleanupMarkers();
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
            title: `${place} 지도`,
            src: mapEmbedUrl,
            style: {
              border: 0,
              height: '100%',
              width: '100%',
              filter: 'saturate(0.78) contrast(0.94) brightness(1.03)',
              touchAction: 'pan-x pan-y pinch-zoom',
            },
            loading: 'lazy',
            referrerPolicy: 'no-referrer-when-downgrade',
          })}
      <MapProviderBadge label="Fallback Map" />
    </View>
  );
}

function MapProviderBadge({ label }: { label: string }) {
  return (
    <View pointerEvents="none" style={styles.mapProviderBadge}>
      <Text style={styles.mapProviderBadgeText}>{label}</Text>
    </View>
  );
}

function createReportMarkerElement(cluster: MapReportCluster, isActive: boolean) {
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.textContent = `${cluster.count}`;
  marker.setAttribute('aria-label', `${cluster.label} 현장 글 ${cluster.count}개 보기`);
  marker.style.width = isActive ? '62px' : '54px';
  marker.style.height = isActive ? '62px' : '54px';
  marker.style.borderRadius = '999px';
  marker.style.border = isActive ? '3px solid rgba(255,255,255,0.92)' : '2px solid rgba(255,255,255,0.68)';
  marker.style.background = getClusterTone(cluster);
  marker.style.color = getClusterInk(cluster);
  marker.style.fontWeight = '900';
  marker.style.fontSize = isActive ? '20px' : '17px';
  marker.style.boxShadow = isActive
    ? '0 18px 34px rgba(36,36,36,0.24)'
    : '0 12px 26px rgba(36,36,36,0.16)';
  marker.style.cursor = 'pointer';
  marker.style.display = 'flex';
  marker.style.alignItems = 'center';
  marker.style.justifyContent = 'center';
  marker.style.padding = '0';
  marker.style.transform = 'translateZ(0)';
  marker.style.transition = 'transform 160ms ease, width 160ms ease, height 160ms ease';

  return marker;
}

function getVisibleMarkerItems(clusters: MapReportCluster[], zoomLevel: number) {
  const visibleClusters = clusters.slice(0, 8);

  if (visibleClusters.length <= 1) {
    return visibleClusters.map((cluster, clusterIndex) => ({ cluster, clusterIndex }));
  }

  if (zoomLevel >= 7) {
    const mergedReports = visibleClusters.flatMap((cluster) => cluster.reports);
    return [
      {
        cluster: {
          ...visibleClusters[0],
          id: 'merged-area',
          label: '지도 화면 안',
          count: mergedReports.length,
          reports: mergedReports,
        },
        clusterIndex: -1,
      },
    ];
  }

  if (zoomLevel >= 5) {
    const primaryClusters = visibleClusters.slice(0, 3).map((cluster, clusterIndex) => ({
      cluster,
      clusterIndex,
    }));
    const remainingReports = visibleClusters.slice(3).flatMap((cluster) => cluster.reports);

    if (remainingReports.length <= 0) return primaryClusters;

    return [
      ...primaryClusters,
      {
        cluster: {
          ...visibleClusters[3],
          id: 'nearby-more',
          label: '주변 나머지',
          count: remainingReports.length,
          reports: remainingReports,
        },
        clusterIndex: -2,
      },
    ];
  }

  return visibleClusters.map((cluster, clusterIndex) => ({ cluster, clusterIndex }));
}

function getClusterTone(cluster: MapReportCluster) {
  const condition = cluster.dominantCondition;

  if (condition.includes('비') || condition.includes('소나기')) return 'rgba(47,134,217,0.72)';
  if (condition.includes('눈')) return 'rgba(216,239,248,0.78)';
  if (condition.includes('천둥') || condition.includes('번개')) return 'rgba(48,43,63,0.76)';
  if (condition.includes('안개')) return 'rgba(216,208,193,0.76)';
  if (condition.includes('황사') || condition.includes('미세')) return 'rgba(215,189,122,0.78)';
  if (condition.includes('맑')) return 'rgba(255,240,90,0.76)';
  if (condition.includes('흐') || condition.includes('구름')) return 'rgba(191,201,189,0.78)';

  return 'rgba(36,36,36,0.70)';
}

function getClusterInk(cluster: MapReportCluster) {
  const condition = cluster.dominantCondition;
  return condition.includes('비') || condition.includes('천둥') || condition.includes('번개')
    ? '#ffffff'
    : '#242424';
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

function getMarkerOffset(index: number) {
  const offsets = [
    { latitude: 0.0015, longitude: -0.0011 },
    { latitude: -0.0018, longitude: 0.0013 },
    { latitude: 0.0022, longitude: 0.0018 },
    { latitude: -0.0021, longitude: -0.0016 },
    { latitude: 0.0008, longitude: 0.0024 },
  ];

  return offsets[index] ?? offsets[0];
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
