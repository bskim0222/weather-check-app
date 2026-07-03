import * as ExpoLocation from 'expo-location';
import { Platform } from 'react-native';

import type { LocationStatus } from '../types/appState';
import { resolveRemotePlaceName } from './geocoding';

type BrowserGeolocationHost = {
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

const fallbackLatitude = 37.5146;
const fallbackLongitude = 127.0736;
const fallbackPlaceName = '서울 송파구 잠실동';

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

export function createFallbackLocationStatus(
  message = '위치를 확인할 수 없어 잠실 기준 샘플 위치로 보여주고 있어요.',
): LocationStatus {
  return {
    phase: 'fallback',
    label: fallbackPlaceName,
    message,
    placeName: fallbackPlaceName,
    shortPlaceName: '잠실동',
    latitude: fallbackLatitude,
    longitude: fallbackLongitude,
    accuracyMeters: null,
    source: 'fallback',
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
        message: '위치 권한이 꺼져 있어 기본 위치 기준으로 보여주고 있어요.',
        source: 'native',
      };
    }

    const servicesEnabled = await ExpoLocation.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      return createFallbackLocationStatus('기기 위치 서비스가 꺼져 있어 기본 위치 기준으로 보여주고 있어요.');
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
      return createFallbackLocationStatus('현재 위치를 제때 확인하지 못해 기본 위치 기준으로 보여주고 있어요.');
    }

    const [nativePlace, remotePlaceName] = await Promise.all([
      resolveNativePlaceName(position.coords.latitude, position.coords.longitude),
      resolveRemotePlaceName(position.coords.latitude, position.coords.longitude),
    ]);
    const place = chooseBestPlace(nativePlace, remotePlaceName);
    const placeName = place.placeName ?? '현재 위치';

    return {
      phase: 'granted',
      label: placeName,
      message: `${placeName} 기준으로 예보와 현장 제보를 맞춰보고 있어요.`,
      placeName,
      shortPlaceName: place.shortPlaceName,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
      source: place.source,
    };
  } catch {
    return createFallbackLocationStatus('위치 확인 중 문제가 생겨 기본 위치 기준으로 보여주고 있어요.');
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
  const geolocation = (globalThis as BrowserGeolocationHost).navigator?.geolocation;

  if (!geolocation) {
    return Promise.resolve({
      phase: 'unavailable',
      label: '위치 기능 없음',
      message: '현재 환경에서는 위치 기능을 사용할 수 없어 기본 위치로 보여주고 있어요.',
      source: 'web',
    });
  }

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) => {
        resolve({
          phase: 'granted',
          label: '현재 위치 확인됨',
          message: '현재 위치 기준으로 예보와 현장 제보를 맞춰보고 있어요.',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy ?? null,
          source: 'web',
        });
      },
      (error) => {
        resolve({
          phase: error.code === 1 ? 'denied' : 'fallback',
          label: error.code === 1 ? '위치 권한 꺼짐' : fallbackPlaceName,
          message:
            error.code === 1
              ? '위치 권한이 꺼져 있어 기본 위치 기준으로 보여주고 있어요.'
              : '위치를 정확히 확인하지 못해 기본 위치 기준으로 보여주고 있어요.',
          placeName: error.code === 1 ? undefined : fallbackPlaceName,
          shortPlaceName: error.code === 1 ? undefined : '잠실동',
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
