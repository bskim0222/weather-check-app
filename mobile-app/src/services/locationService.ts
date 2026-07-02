import * as ExpoLocation from 'expo-location';
import { Platform } from 'react-native';

import type { LocationStatus } from '../types/appState';

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

const fallbackLatitude = 37.5146;
const fallbackLongitude = 127.0736;

export const initialLocationStatus: LocationStatus = {
  phase: 'idle',
  label: '위치 준비 전',
  message: '현재 위치 기준 판정을 위해 위치 확인을 준비하고 있어요.',
};

export function createCheckingLocationStatus(): LocationStatus {
  return {
    phase: 'checking',
    label: '위치 확인 중',
    message: '현재 위치를 확인한 뒤 가까운 제보와 예보를 맞춰볼게요.',
  };
}

export function createFallbackLocationStatus(message = '위치를 확인할 수 없어 잠실 기준 샘플 위치로 보여주고 있어요.'): LocationStatus {
  return {
    phase: 'fallback',
    label: '기본 위치 사용',
    message,
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

    const lastKnownPosition = await ExpoLocation.getLastKnownPositionAsync({
      maxAge: 1000 * 60 * 5,
      requiredAccuracy: 300,
    });
    const position =
      lastKnownPosition ??
      (await withLocationTimeout(
        ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
        }),
      ));

    if (!position) {
      return createFallbackLocationStatus('현재 위치를 제때 확인하지 못해 기본 위치 기준으로 보여주고 있어요.');
    }

    return {
      phase: 'granted',
      label: '현재 위치 확인됨',
      message: '현재 위치 기준으로 예보와 현장 제보를 맞춰보고 있어요.',
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
      source: 'native',
    };
  } catch {
    return createFallbackLocationStatus('위치 확인 중 문제가 생겨 기본 위치 기준으로 보여주고 있어요.');
  }
}

async function withLocationTimeout<T>(promise: Promise<T>) {
  return Promise.race<T | null>([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 8000);
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
          label: error.code === 1 ? '위치 권한 꺼짐' : '기본 위치 사용',
          message:
            error.code === 1
              ? '위치 권한이 꺼져 있어 기본 위치 기준으로 보여주고 있어요.'
              : '위치를 정확히 확인하지 못해 기본 위치 기준으로 보여주고 있어요.',
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
