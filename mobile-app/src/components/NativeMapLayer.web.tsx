import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { appConfig } from '../config/appConfig';
import { styles } from '../styles/appStyles';
import type { LocalReport, SearchContext } from '../types/weather';

type NativeMapLayerProps = {
  searchContext: SearchContext;
  selectedIndex: number;
  visibleReports: LocalReport[];
  onSelectReport: (index: number) => void;
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
      Marker: new (options: Record<string, unknown>) => unknown;
      CustomOverlay?: new (options: Record<string, unknown>) => unknown;
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
  visibleReports,
  onSelectReport,
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

    kakao.load(() => {
      if (!containerRef.current) return;

      const mapCenter = new kakao.LatLng(center.latitude, center.longitude);
      const map = new kakao.Map(containerRef.current, {
        center: mapCenter,
        level: 4,
      });

      if (kakao.ZoomControl && kakao.ControlPosition?.RIGHT && map.addControl) {
        map.addControl(new kakao.ZoomControl(), kakao.ControlPosition.RIGHT);
      }

      new kakao.Marker({
        position: mapCenter,
        map,
      });

      setKakaoMapMounted(true);

      visibleReports.slice(0, 5).forEach((report, index) => {
        const offset = getMarkerOffset(index);
        const markerPosition = new kakao.LatLng(
          center.latitude + offset.latitude,
          center.longitude + offset.longitude,
        );

        if (!kakao.CustomOverlay) {
          new kakao.Marker({
            position: markerPosition,
            map,
          });
          return;
        }

        const markerNode = createReportMarkerElement(report, index === selectedIndex);
        markerNode.onclick = () => onSelectReport(index);

        new kakao.CustomOverlay({
          position: markerPosition,
          content: markerNode,
          map,
          yAnchor: 0.5,
          xAnchor: 0.5,
          zIndex: index === selectedIndex ? 9 : 5,
        });
      });
    });
  }, [
    center.latitude,
    center.longitude,
    kakaoReady,
    onSelectReport,
    selectedIndex,
    shouldUseKakao,
    visibleReports,
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
                touchAction: 'pan-x pan-y pinch-zoom',
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

function createReportMarkerElement(report: LocalReport, isActive: boolean) {
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.textContent = getMarkerLabel(report);
  marker.setAttribute('aria-label', `${report.place} 현장 글 보기`);
  marker.style.width = isActive ? '52px' : '44px';
  marker.style.height = isActive ? '52px' : '44px';
  marker.style.borderRadius = '999px';
  marker.style.border = isActive ? '4px solid #ffffff' : '2px solid rgba(255,255,255,0.88)';
  marker.style.background = getMarkerTone(report);
  marker.style.color = getMarkerInk(report);
  marker.style.fontWeight = '900';
  marker.style.fontSize = isActive ? '16px' : '14px';
  marker.style.boxShadow = '0 14px 28px rgba(36,36,36,0.24)';
  marker.style.cursor = 'pointer';
  marker.style.display = 'flex';
  marker.style.alignItems = 'center';
  marker.style.justifyContent = 'center';
  marker.style.padding = '0';
  marker.style.transform = 'translateZ(0)';
  marker.style.transition = 'transform 160ms ease, width 160ms ease, height 160ms ease';

  return marker;
}

function getMarkerLabel(report?: LocalReport) {
  const condition = report?.condition ?? '';

  if (condition.includes('천둥') || condition.includes('번개')) return '번';
  if (condition.includes('소나기')) return '소';
  if (condition.includes('비')) return '비';
  if (condition.includes('눈')) return '눈';
  if (condition.includes('안개')) return '안';
  if (condition.includes('황사')) return '황';
  if (condition.includes('미세')) return '미';
  if (condition.includes('맑')) return '맑';
  if (condition.includes('흐') || condition.includes('구름')) return '흐';

  return '현';
}

function getMarkerTone(report: LocalReport) {
  const condition = report.condition;

  if (condition.includes('비') || condition.includes('소나기')) return '#2f86d9';
  if (condition.includes('눈')) return '#d8eff8';
  if (condition.includes('천둥') || condition.includes('번개')) return '#302b3f';
  if (condition.includes('안개')) return '#d8d0c1';
  if (condition.includes('황사') || condition.includes('미세')) return '#d7bd7a';
  if (condition.includes('맑')) return '#fff05a';
  if (condition.includes('흐') || condition.includes('구름')) return '#bfc9bd';

  return '#242424';
}

function getMarkerInk(report: LocalReport) {
  const tone = getMarkerTone(report);
  return tone === '#302b3f' || tone === '#242424' || tone === '#2f86d9' ? '#ffffff' : '#242424';
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
