import { weatherPresets } from '../data/mockWeather';
import type { LocationStatus } from '../types/appState';
import type { SearchContext, WeatherKey, WeatherPreset } from '../types/weather';
import {
  defaultSearchContext,
  getDetectedWeatherLabel,
  inferSearchContext,
  inferWeatherFromQuestion,
} from './search';

export type JudgementSource = 'current-location' | 'question' | 'manual-weather';

export type WeatherJudgement = {
  weatherKey: WeatherKey;
  preset: WeatherPreset;
  searchContext: SearchContext;
  source: JudgementSource;
  createdAt: string;
};

export function createDefaultJudgement(): WeatherJudgement {
  return createJudgement('rain', defaultSearchContext, 'current-location');
}

export function createQuestionJudgement(question: string): WeatherJudgement {
  const clean = question.trim();
  const weatherKey = inferWeatherFromQuestion(clean);

  return createJudgement(weatherKey, inferSearchContext(clean, weatherKey), 'question');
}

export function updateJudgementWeather(
  judgement: WeatherJudgement,
  weatherKey: WeatherKey,
): WeatherJudgement {
  return createJudgement(
    weatherKey,
    {
      ...judgement.searchContext,
      detectedWeather: getDetectedWeatherLabel(weatherKey),
    },
    'manual-weather',
  );
}

export function updateJudgementLocation(
  judgement: WeatherJudgement,
  locationStatus: LocationStatus,
): WeatherJudgement {
  if (
    judgement.searchContext.target.kind !== 'current' ||
    typeof locationStatus.latitude !== 'number' ||
    typeof locationStatus.longitude !== 'number'
  ) {
    return judgement;
  }

  return {
    ...judgement,
    searchContext: {
      ...judgement.searchContext,
      target: {
        ...judgement.searchContext.target,
        latitude: locationStatus.latitude,
        longitude: locationStatus.longitude,
      },
      interpretationNote:
        locationStatus.phase === 'granted'
          ? '현재 위치 좌표를 기준으로 예보와 현장 제보를 맞춰보고 있어요.'
          : judgement.searchContext.interpretationNote,
    },
  };
}

export function restoreJudgement(
  weatherKey: WeatherKey,
  searchContext: SearchContext,
  source: JudgementSource,
  createdAt: string,
): WeatherJudgement {
  return {
    weatherKey,
    preset: weatherPresets[weatherKey],
    searchContext,
    source,
    createdAt,
  };
}

function createJudgement(
  weatherKey: WeatherKey,
  searchContext: SearchContext,
  source: JudgementSource,
): WeatherJudgement {
  return {
    weatherKey,
    preset: weatherPresets[weatherKey],
    searchContext,
    source,
    createdAt: new Date().toISOString(),
  };
}
