import type { PersistedAppSnapshot } from '../types/appState';
import { getPersistentStorage } from './persistentStorage';

const storageKey = 'weather-check-app-state-v2';

export async function readPersistedAppSnapshot() {
  const storage = getPersistentStorage();
  if (!storage) return null;

  try {
    const raw = await storage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedAppSnapshot>;
    if (!isPersistedAppSnapshot(parsed)) return null;

    return parsed;
  } catch {
    return null;
  }
}

export async function writePersistedAppSnapshot(snapshot: PersistedAppSnapshot) {
  const storage = getPersistentStorage();
  if (!storage) return;

  try {
    await storage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // Storage can fail in private mode or when quota is full. The app should keep working.
  }
}

function isPersistedAppSnapshot(value: Partial<PersistedAppSnapshot>): value is PersistedAppSnapshot {
  return (
    value.version === 1 &&
    isTabKey(value.activeTab) &&
    typeof value.questionText === 'string' &&
    Array.isArray(value.recentQuestions) &&
    typeof value.reportText === 'string' &&
    Array.isArray(value.reports) &&
    Array.isArray(value.reportRequests) &&
    (value.locationStatus === undefined || isLocationStatus(value.locationStatus)) &&
    isWeatherKey(value.judgement?.weatherKey) &&
    isJudgementSource(value.judgement?.source) &&
    typeof value.judgement?.createdAt === 'string' &&
    typeof value.judgement?.searchContext?.raw === 'string'
  );
}

function isTabKey(value: unknown) {
  return value === 'decision' || value === 'map' || value === 'report' || value === 'compare';
}

function isWeatherKey(value: unknown) {
  return (
    value === 'sunny' ||
    value === 'cloudy' ||
    value === 'rain' ||
    value === 'thunder' ||
    value === 'snow' ||
    value === 'fog' ||
    value === 'shower' ||
    value === 'dust' ||
    value === 'heat' ||
    value === 'typhoon' ||
    value === 'night' ||
    value === 'rainbow'
  );
}

function isJudgementSource(value: unknown) {
  return value === 'current-location' || value === 'question' || value === 'manual-weather';
}

function isLocationStatus(value: unknown) {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as { phase?: unknown; label?: unknown; message?: unknown };

  return (
    isLocationStatusPhase(candidate.phase) &&
    typeof candidate.label === 'string' &&
    typeof candidate.message === 'string'
  );
}

function isLocationStatusPhase(value: unknown) {
  return (
    value === 'idle' ||
    value === 'checking' ||
    value === 'granted' ||
    value === 'denied' ||
    value === 'unavailable' ||
    value === 'fallback'
  );
}
