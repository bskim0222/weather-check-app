import * as ExpoLocation from 'expo-location';
import { Platform } from 'react-native';

import { createFallbackLocationStatus } from '../domain/locationStatus';
import type { LocationStatus } from '../types/appState';
import { resolveRemotePlaceName } from './geocoding';

export { createFallbackLocationStatus } from '../domain/locationStatus';

type BrowserGeolocationHost = {
  isSecureContext?: boolean;
  location?: {
    hostname?: string;
    protocol?: string;
  };
  navigator?: {
    geolocation?: {
      getCurrentPosition: (
        onSuccess: (position: {
          coords: {
            accuracy?: number | null;
            latitude: number;
            longitude: number;
          };
        }) => void,
        onError: (error: { code?: number }) => void,
        options?: {
          enableHighAccuracy?: boolean;
          timeout?: number;
          maximumAge?: number;
        },
      ) => void;
    };
  };
};

type ExtendedGeocodedAddress = ExpoLocation.LocationGeocodedAddress & {
  city?: string | null;
  formattedAddress?: string | null;
};

export const initialLocationStatus: LocationStatus = {
  phase: 'idle',
  label: '위치 준비',
  message: '현재 위치 기준 판정을 위해 위치 확인을 준비하고 있어요.',
};

export function createCheckingLocationStatus(): LocationStatus {
  return {
    phase: 'checking',
    label: '위치 확인 중',
    message: '현재 위치를 확인해서 가까운 예보와 제보를 맞춰볼게요.',
  };
}

export async function resolveCurrentLocation(): Promise<LocationStatus> {
  if (Platform.OS === 'web') {
    return resolveWebCurrentLocation();
  }

  return resolveNativeCurrentLocation();
}

async function resolveNativeCurrentLocation(): Promise<LocationStatus> {
  try {
    const permission = await ExpoLocation.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      return {
        phase: 'denied',
        label: '위치 권한 꺼짐',
        message: '위치 권한이 꺼져 있어 날씨를 불러오지 않았어요. 권한을 허용한 뒤 다시 시도해주세요.',
        source: 'native',
      };
    }

    const servicesEnabled = await ExpoLocation.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      return createFallbackLocationStatus('기기 위치 서비스가 꺼져 있어 날씨를 불러오지 않았어요. 위치 서비스를 켜고 다시 시도해주세요.');
    }

    const position =
      (await withLocationTimeout(
        ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.BestForNavigation,
          mayShowUserSettingsDialog: true,
        }),
        18000,
      )) ??
      (await ExpoLocation.getLastKnownPositionAsync({
        maxAge: 1000 * 20,
        requiredAccuracy: 80,
      }));

    if (!position) {
      return createFallbackLocationStatus('현재 위치를 제때 확인하지 못해 날씨를 불러오지 않았어요. 잠시 뒤 다시 시도해주세요.');
    }

    const [nativePlace, remotePlaceName] = await Promise.all([
      resolveNativePlaceName(position.coords.latitude, position.coords.longitude),
      resolveRemotePlaceName(position.coords.latitude, position.coords.longitude),
    ]);
    const place = chooseBestPlace(nativePlace, remotePlaceName);
    const placeName = place.placeName ?? '현재 위치';
    const accuracyMeters = position.coords.accuracy;
    const isLowAccuracy = typeof accuracyMeters === 'number' && accuracyMeters > 1000;

    return {
      phase: 'granted',
      label: isLowAccuracy ? `${placeName} · 정확도 낮음` : placeName,
      message: isLowAccuracy
        ? `기기 위치 정확도가 낮아 ${placeName} 인근으로만 보고 있어요. 위치 설정에서 정확한 위치를 켜고 다시 갱신해보세요.`
        : `${placeName} 기준으로 예보와 현장 제보를 맞춰보고 있어요.`,
      placeName,
      shortPlaceName: place.shortPlaceName,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters,
      source: place.source,
    };
  } catch {
    return createFallbackLocationStatus('위치 확인 중 문제가 생겨 날씨를 불러오지 않았어요. 잠시 뒤 다시 시도해주세요.');
  }
}

function getShortPlaceName(placeName: string) {
  const parts = placeName.split(/\s+/).filter(Boolean);

  return parts.at(-1) ?? placeName;
}

type ResolvedPlaceName = {
  placeName?: string;
  shortPlaceName?: string;
  source?: LocationStatus['source'];
};

function chooseBestPlace(nativePlace: ResolvedPlaceName, remotePlaceName: string | null): ResolvedPlaceName {
  const remotePlace = remotePlaceName
    ? {
        placeName: remotePlaceName,
        shortPlaceName: getShortPlaceName(remotePlaceName),
        source: 'backend' as const,
      }
    : {};
  const nativeScore = scorePlaceName(nativePlace.placeName);
  const remoteScore = scorePlaceName(remotePlace.placeName);

  if (nativeScore >= remoteScore) {
    return {
      ...nativePlace,
      source: 'native',
    };
  }

  return remotePlace;
}

function scorePlaceName(value?: string) {
  if (!value) return 0;

  const parts = value.split(/\s+/).filter(Boolean);
  const detailScore = parts.reduce((score, part) => {
    if (/(동|읍|면|리)$/.test(part)) return score + 5;
    if (/(구|군|시)$/.test(part)) return score + 3;
    if (/(로|길)$/.test(part)) return score + 2;

    return score + 1;
  }, 0);

  return detailScore + Math.min(parts.length, 4);
}

async function resolveNativePlaceName(latitude: number, longitude: number) {
  try {
    const addresses = await withLocationTimeout(
      ExpoLocation.reverseGeocodeAsync({ latitude, longitude }),
      5000,
    );
    const address = addresses?.[0] as ExtendedGeocodedAddress | undefined;

    if (!address) return {};

    const formattedParts = splitFormattedAddress(address.formattedAddress);
    const region = compactRegionName(address.region);
    const city = compactRegionName(address.city);
    const district = compactRegionName(address.district ?? address.subregion);
    const neighborhood = pickNeighborhood(address);
    const street = compactRegionName(address.street);
    const streetNumber = compactRegionName(address.streetNumber);
    const name = compactRegionName(address.name);

    const fullParts = uniqueCompact([
      ...formattedParts,
      region,
      city,
      district,
      neighborhood,
      street && streetNumber ? `${street} ${streetNumber}` : street,
      name,
    ]).filter((item) => !isTooBroadCountryName(item));

    const detailParts = trimToUsefulLocation(fullParts);
    const short = neighborhood || name || street || district || city || region || undefined;

    return {
      placeName: detailParts.join(' ') || short,
      shortPlaceName: short,
    };
  } catch {
    return {};
  }
}

async function withLocationTimeout<T>(promise: Promise<T>, timeoutMs = 8000) {
  return Promise.race<T | null>([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

function resolveWebCurrentLocation(): Promise<LocationStatus> {
  const browserHost = globalThis as BrowserGeolocationHost;

  if (isInsecureWebGeolocationContext(browserHost)) {
    return Promise.resolve({
      phase: 'unavailable',
      label: 'HTTPS 위치 권한 필요',
      message:
        '모바일 브라우저는 보안 연결이 아닌 로컬 링크에서 위치 권한창을 띄우지 않아요. Render HTTPS 링크나 설치 앱에서 현재 위치를 확인해주세요.',
      source: 'web',
    });
  }

  const geolocation = browserHost.navigator?.geolocation;

  if (!geolocation) {
    return Promise.resolve({
      phase: 'unavailable',
      label: '위치 기능 없음',
      message: '현재 환경에서는 위치 기능을 사용할 수 없어 날씨를 불러오지 않았어요.',
      source: 'web',
    });
  }

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      async (position) => {
        const remotePlaceName = await resolveRemotePlaceName(
          position.coords.latitude,
          position.coords.longitude,
        ).catch(() => null);
        const placeName = remotePlaceName ?? '현재 위치 확인됨';
        const accuracyMeters = position.coords.accuracy ?? null;
        const isLowAccuracy = typeof accuracyMeters === 'number' && accuracyMeters > 1000;

        resolve({
          phase: 'granted',
          label: isLowAccuracy ? `${placeName} · 정확도 낮음` : placeName,
          message: remotePlaceName
            ? `${placeName} 기준으로 예보와 현장 제보를 맞춰보고 있어요.`
            : '현재 위치 좌표를 확인했지만 동네 이름은 아직 불러오지 못했어요.',
          placeName,
          shortPlaceName: remotePlaceName ? getShortPlaceName(remotePlaceName) : undefined,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters,
          source: remotePlaceName ? 'backend' : 'web',
        });
      },
      (error) => {
        const permissionDenied = error.code === 1;
        resolve({
          phase: permissionDenied ? 'denied' : 'fallback',
          label: permissionDenied ? '위치 권한 꺼짐' : '위치 확인 실패',
          message:
            permissionDenied
              ? '위치 권한이 꺼져 있어 날씨를 불러오지 않았어요. 권한을 허용한 뒤 다시 시도해주세요.'
              : '위치를 정확히 확인하지 못해 날씨를 불러오지 않았어요. 잠시 뒤 다시 시도해주세요.',
          source: 'web',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 1000 * 60 * 5,
      },
    );
  });
}

function isInsecureWebGeolocationContext(host: BrowserGeolocationHost) {
  if (host.isSecureContext === true) return false;

  const protocol = host.location?.protocol;
  const hostname = host.location?.hostname;

  if (protocol === 'https:') return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;

  return protocol === 'http:';
}

function splitFormattedAddress(value?: string | null) {
  if (!value) return [];

  return value
    .replace(/대한민국/g, '')
    .replace(/\bSouth Korea\b/gi, '')
    .split(/[,\n]/)
    .flatMap((part) => part.split(/\s+/))
    .map(compactRegionName)
    .filter(Boolean);
}

function pickNeighborhood(address: ExtendedGeocodedAddress) {
  const candidates = [
    address.name,
    address.district,
    address.subregion,
    address.street,
  ].map(compactRegionName);

  return candidates.find((item) => /동$|읍$|면$|리$|가$/.test(item)) ?? '';
}

function trimToUsefulLocation(parts: string[]) {
  const meaningfulParts = parts.filter((part) => !/^\d{5}$/.test(part));

  if (meaningfulParts.length <= 4) return meaningfulParts;

  const startsAt = Math.max(0, meaningfulParts.findIndex((part) => /시$|도$|특별시$|광역시$/.test(part)));
  return meaningfulParts.slice(startsAt, startsAt + 4);
}

function uniqueCompact(values: Array<string | undefined | null>) {
  const seen = new Set<string>();

  return values
    .map(compactRegionName)
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function isTooBroadCountryName(value: string) {
  return value === '대한민국' || value.toLowerCase() === 'south korea' || value.toLowerCase() === 'korea';
}

function compactRegionName(region?: string | null) {
  if (!region) return '';

  return region
    .replace(/특별시/g, '')
    .replace(/광역시/g, '')
    .replace(/특별자치시/g, '')
    .replace(/특별자치도/g, '')
    .replace(/자치도/g, '')
    .replace(/Province/gi, '')
    .replace(/-do$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
