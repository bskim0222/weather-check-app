import type { JudgementSource } from '../domain/judgement';
import type { LocalReport, ReportRequest, SearchContext, TabKey, WeatherKey } from './weather';

export type DataStatusPhase = 'ready' | 'loading' | 'mock' | 'fallback' | 'error';

export type LocationStatusPhase =
  | 'idle'
  | 'checking'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'fallback';

export type DataStatus = {
  phase: DataStatusPhase;
  label: string;
  message: string;
};

export type LocationStatus = {
  phase: LocationStatusPhase;
  label: string;
  message: string;
  placeName?: string;
  shortPlaceName?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number | null;
  source?: 'web' | 'native' | 'backend' | 'fallback';
};

export type PersistedAppSnapshot = {
  version: 1;
  activeTab: TabKey;
  questionText: string;
  recentQuestions: string[];
  reportText: string;
  reports: LocalReport[];
  reportRequests: ReportRequest[];
  locationStatus?: LocationStatus;
  judgement: {
    weatherKey: WeatherKey;
    searchContext: SearchContext;
    source: JudgementSource;
    createdAt: string;
  };
};
