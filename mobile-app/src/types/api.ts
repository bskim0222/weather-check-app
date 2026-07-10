import type {
  CompareDifference,
  CompareRow,
  CompareServiceSummary,
  ForecastProviderId,
  ForecastSource,
  LocalReport,
  ReportRequest,
  SearchContext,
} from './weather';

export type ApiSnapshotMeta = {
  generatedAt: string;
  source: 'mock' | 'api';
};

export type ApiWeatherProviderSnapshot = ApiSnapshotMeta & {
  context: SearchContext;
  meta?: WeatherProviderSnapshotMeta;
  sources: ForecastSource[];
  summaries: CompareServiceSummary[];
  differences: CompareDifference[];
  hourlyRows: CompareRow[];
  dailyRows: CompareRow[];
};

export type WeatherProviderSnapshotMeta = {
  providerMode: string;
  liveProviderIds: ForecastProviderId[];
  fallbackProviderIds: ForecastProviderId[];
  thirdProviderId?: ForecastProviderId;
};

export type ApiFieldReportSnapshot = ApiSnapshotMeta & {
  context: SearchContext;
  reports: LocalReport[];
  requests: ReportRequest[];
};

export type ApiWeatherProviderSnapshotRequest = {
  context: SearchContext;
};

export type ApiFieldReportSnapshotRequest = {
  context: SearchContext;
  localReports: LocalReport[];
  localRequests: ReportRequest[];
};

export type ApiCreateFieldReportRequest = LocalReport;

export type ApiCreateReportRequestRequest = ReportRequest;

export type ApiUpdateFieldReportRequest = Partial<Pick<LocalReport, 'body' | 'condition'>>;

export type ApiUpdateReportRequestRequest = Partial<Pick<ReportRequest, 'question'>>;

export type ApiDeleteResponse = {
  ok: boolean;
  reportId?: string;
  requestId?: string;
};

export type ApiAnswerReportRequestRequest = {
  status?: string;
  hint?: string;
};

export type ApiModerateReportRequest = {
  moderationStatus: 'pending' | 'hidden';
  reason: string;
};

export type ApiModerateReportResponse = {
  ok: boolean;
  reportId: string;
  moderationStatus: 'pending' | 'hidden';
};
