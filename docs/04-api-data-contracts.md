# Weather Check API Data Contracts

This document describes the app-side data contracts that future backend and provider integrations should satisfy.

The current app still runs in mock mode. Real data should enter through service snapshots, not directly inside screens.

## Environment

Use `mobile-app/.env.example` as the template.

- `EXPO_PUBLIC_DATA_MODE`
  - `mock`: use local mock/domain data.
  - `api`: try API-backed snapshots first, then fall back to mock data when unavailable.
- `EXPO_PUBLIC_API_BASE_URL`
  - Backend base URL.
- `EXPO_PUBLIC_KMA_API_KEY`
  - KMA provider key or backend proxy key.
- `EXPO_PUBLIC_YR_USER_AGENT`
  - Yr.no requires a clear User-Agent when calling its APIs directly.

Backend live-provider flags live in `backend/.env.example`.

- `WEATHER_PROVIDER_MODE`
  - `mock`: keep all provider values local.
  - `yr`: replace only Yr.no values with live Locationforecast data.
  - `kma`: replace only KMA values with live short forecast data.
  - `fmi`: replace the third provider values with live FMI Open Data / ECMWF data.
  - `windy`: replace only Windy values with live Point Forecast data.
  - `kma,yr,fmi`: recommended MVP live comparison mode.
  - `kma,yr,windy`: optional live mode when a Windy key is available.
- `YR_USER_AGENT`
  - Required when the backend calls Yr.no/MET.
  - Use a clear app name/version plus contact information.
- `KMA_SERVICE_KEY`
  - Required when the backend calls KMA short forecast APIs.
  - Keep the real key in local/server environment variables only.
- `FMI`
  - No API key is required for the current FMI Open Data WFS integration.
  - Attribution is required under the FMI Open Data / CC BY 4.0 terms.
- `WINDY_API_KEY`
  - Required when the backend calls Windy Point Forecast APIs.
  - Keep the real key in local/server environment variables only.

## Local Mock API

Before a real backend exists, run the local mock API from `mobile-app`:

```powershell
node scripts/mock-api-server.mjs
```

It serves:

- `GET /health`
- `POST /weather/provider-snapshot`
- `POST /field-reports/snapshot`
- `POST /field-reports`
- `POST /report-requests`
- `POST /report-requests/:id/answer`
- `POST /reports/:id/moderation`

Use it with:

```env
EXPO_PUBLIC_DATA_MODE=api
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8793
```

For phone testing on the same Wi-Fi, replace `127.0.0.1` with the PC LAN IP.

## Shared Search Context

Every weather, map, report, and comparison request is based on `SearchContext`.

```ts
type SearchContext = {
  raw: string;
  place: string;
  target: LocationReference;
  timeLabel: string;
  detectedWeather: string;
  interpretationNote: string;
  needsClarification: boolean;
};
```

The important part is `target`. The screen can still show `place`, but API calls should use `target` when coordinates or radius are available.

```ts
type LocationReference = {
  id: string;
  label: string;
  kind: 'current' | 'known-place' | 'custom';
  latitude?: number;
  longitude?: number;
  radiusMeters: number;
};
```

## Weather Provider Snapshot

Purpose:

- Compare KMA, Yr.no, and a third global-model provider.
- Explain why the app made a weather judgement.
- Feed hourly and daily comparison tables.

Endpoint placeholder:

- `POST /weather/provider-snapshot`

Request:

```ts
type ApiWeatherProviderSnapshotRequest = {
  context: SearchContext;
};
```

Current app contract:

```ts
type ApiWeatherProviderSnapshot = {
  generatedAt: string;
  source: 'mock' | 'api';
  context: SearchContext;
  meta: WeatherProviderSnapshotMeta;
  sources: ForecastSource[];
  summaries: CompareServiceSummary[];
  differences: CompareDifference[];
  hourlyRows: CompareRow[];
  dailyRows: CompareRow[];
};
```

Provider metadata tells the app which forecast values are live and which ones are currently fallback/sample values.

```ts
type WeatherProviderSnapshotMeta = {
  providerMode: string;
  liveProviderIds: ForecastProviderId[];
  fallbackProviderIds: ForecastProviderId[];
  thirdProviderId?: ForecastProviderId;
};
```

The app now sends the full `SearchContext` so the backend can resolve provider data for the same place, time, radius, and weather intent shown in the UI.

Current backend provider status:

- KMA: local placeholder by default; live short forecast adapter available when `WEATHER_PROVIDER_MODE=kma`.
- Yr.no: live Locationforecast adapter available when `WEATHER_PROVIDER_MODE=yr`.
- FMI ECMWF: live Open Data WFS adapter available when `WEATHER_PROVIDER_MODE=fmi`.
- Windy: optional Point Forecast adapter available when `WEATHER_PROVIDER_MODE=windy` and a Windy key is available.

## Field Report Snapshot

Purpose:

- Show nearby live reports.
- Show report requests.
- Feed the report tab and map tab from the same data shape.

Endpoint placeholder:

- `POST /field-reports/snapshot`

Request:

```ts
type ApiFieldReportSnapshotRequest = {
  context: SearchContext;
  localReports: LocalReport[];
  localRequests: ReportRequest[];
};
```

Current app contract:

```ts
type ApiFieldReportSnapshot = {
  generatedAt: string;
  source: 'mock' | 'api';
  context: SearchContext;
  reports: LocalReport[];
  requests: ReportRequest[];
};
```

## Field Report Writes

Purpose:

- Save a user field report.
- Save a report request.
- Persist that a report request received an answer.
- Mark harmful or questionable reports for moderation review.

Endpoints:

- `POST /field-reports`
- `POST /report-requests`
- `POST /report-requests/:id/answer`
- `POST /reports/:id/moderation`

Current write contracts:

```ts
type ApiCreateFieldReportRequest = LocalReport;

type ApiCreateReportRequestRequest = ReportRequest;

type ApiAnswerReportRequestRequest = {
  status?: string;
  hint?: string;
};

type ApiModerateReportRequest = {
  moderationStatus: 'pending' | 'hidden';
  reason: string;
};
```

The answer endpoint returns the updated `ReportRequest`, including the incremented `answers` count and latest answer status.

## Service Boundary

Screens should not call provider APIs directly.

- Weather data enters through `src/services/weatherProviders.ts`.
- Field reports enter through `src/services/fieldReports.ts`.
- Shared HTTP helpers live in `src/services/apiClient.ts`.
- Environment values live in `src/config/appConfig.ts`.

This lets the UI stay stable while the backend, provider APIs, location permission flow, and push notification logic evolve.
