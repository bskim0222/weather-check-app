export type TabKey = 'decision' | 'map' | 'report' | 'compare';

export type WeatherKey = 'sunny' | 'cloudy' | 'rain' | 'thunder' | 'snow' | 'fog';

export type ForecastProviderId = 'kma' | 'yr' | 'windy' | 'fmi';

export type LocationReference = {
  id: string;
  label: string;
  kind: 'current' | 'known-place' | 'custom';
  latitude?: number;
  longitude?: number;
  radiusMeters: number;
};

export type SearchContext = {
  raw: string;
  place: string;
  target: LocationReference;
  timeLabel: string;
  detectedWeather: string;
  interpretationNote: string;
  needsClarification: boolean;
};

export type WeatherPreset = {
  label: string;
  title: string;
  condition: string;
  temp: number;
  level: string;
  live: string;
  signal: string;
  summary: string;
  glyph: string;
  bg: string;
  accent: string;
  accentInk: string;
  sources: ForecastSource[];
  forecastLead: string;
  forecastRows: ForecastStep[];
};

export type LocalReport = {
  id?: string;
  place: string;
  time: string;
  condition: string;
  body: string;
  createdAt?: string;
  moderationStatus?: 'visible' | 'pending' | 'hidden';
  source?: 'local' | 'api' | 'mock';
};

export type FieldReport = LocalReport;

export type ForecastSource = {
  providerId?: ForecastProviderId;
  iconUri?: string;
  name: string;
  mark: string;
  condition: string;
  temp: string;
  detail: string;
  badge: string;
  color: string;
};

export type ProviderForecastSummary = CompareServiceSummary;

export type CompareRow = {
  label: string;
  kma: CompareForecastCell;
  yr: CompareForecastCell;
  windy: CompareForecastCell;
};

export type ReportRequest = {
  id: string;
  question: string;
  hint: string;
  place: string;
  distance: string;
  answers: number;
  time: string;
  status: string;
  mark: string;
  accent: string;
  createdAt?: string;
  lastAnsweredAt?: string;
  source?: 'local' | 'api' | 'mock';
};

export type ReportRequestModel = ReportRequest;

export type ForecastStep = {
  time: string;
  title: string;
  temp: string;
  note: string;
  mark: string;
};

export type CompareForecastCell = {
  mark: string;
  weather: string;
  detail: string;
  tone: string;
};

export type CompareServiceSummary = {
  name: string;
  mark: string;
  subtitle: string;
  summary: string;
  weather: string;
  value: string;
  color: string;
};

export type CompareDifference = {
  name: string;
  mark: string;
  body: string;
  badge: string;
  color: string;
};
