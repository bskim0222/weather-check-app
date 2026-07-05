import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { appConfig } from '../config/appConfig';
import { styles } from '../styles/appStyles';
import type { LocalReport, SearchContext } from '../types/weather';

type NativeMapLayerProps = {
  searchContext: SearchContext;
  selectedIndex: number;
  visibleReports: LocalReport[];
};

type KakaoWindow = Window & {
  kakao?: {
    maps?: {
      load: (callback: () => void) => void;
      LatLng: new (latitude: number, longitude: number) => unknown;
      Map: new (container: HTMLElement, options: Record<string, unknown>) => {
        setCenter?: (center: unknown) => void;
        setLevel?: (level: number) => void;
      };
      Marker: new (options: Record<string, unknown>) => unknown;
    };
  };
};

const KAKAO_SCRIPT_ID = 'weather-check-kakao-map-sdk';

export function NativeMapLayer({ searchContext, visibleReports }: NativeMapLayerProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [kakaoReady, setKakaoReady] = useState(false);
  const [kakaoFailed, setKakaoFailed] = useState(false);
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

      new kakao.Marker({
        position: mapCenter,
        map,
      });

      visibleReports.slice(0, 5).forEach((_, index) => {
        const offset = getMarkerOffset(index);
        const markerPosition = new kakao.LatLng(
          center.latitude + offset.latitude,
          center.longitude + offset.longitude,
        );

        new kakao.Marker({
          position: markerPosition,
          map,
        });
      });
    });
  }, [center.latitude, center.longitude, kakaoReady, shouldUseKakao, visibleReports]);

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
