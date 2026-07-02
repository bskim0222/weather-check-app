# Backend MVP Guide

This backend is a local prototype server for the weather app.

## What It Does

- Returns provider comparison snapshots.
- Stores field reports in a local JSON file.
- Stores report requests in a local JSON file.
- Replaces an existing field report or report request when the same `id` is submitted again.
- Hides or marks reports through a moderation endpoint.
- Lets the mobile app test API mode without waiting for a hosted server.

## Run

From `backend`:

```powershell
npm start
```

Default URL:

```text
http://127.0.0.1:8796
```

Provider setup status:

```text
http://127.0.0.1:8796/provider-status
```

This endpoint never returns secret key values. It only reports whether each provider is enabled and configured.

## Enable Live Yr.no Forecast

By default, the backend keeps provider snapshots local and stable.

To replace only the Yr.no values with live Locationforecast data, start the backend with:

```powershell
$env:WEATHER_PROVIDER_MODE="yr"
$env:YR_USER_AGENT="WeatherCheck/0.1 weathercheck.official@gmail.com"
npm start
```

To test only the Yr.no adapter once:

```powershell
$env:YR_USER_AGENT="WeatherCheck/0.1 weathercheck.official@gmail.com"
npm run check:yr-live
```

Important:

- Yr.no/MET requires a clear `User-Agent` with contact information.
- The backend rounds latitude/longitude before calling Yr, following MET guidance.
- If the Yr request fails or no coordinates are available, the backend falls back to the local mock provider values.

## Enable Live KMA Forecast

KMA requires a service key from the Public Data Portal.

Start only KMA live mode with:

```powershell
$env:WEATHER_PROVIDER_MODE="kma"
$env:KMA_SERVICE_KEY="your-local-service-key"
npm start
```

Start both KMA and Yr.no live mode with:

```powershell
$env:WEATHER_PROVIDER_MODE="kma,yr"
$env:KMA_SERVICE_KEY="your-local-service-key"
$env:YR_USER_AGENT="WeatherCheck/0.1 weathercheck.official@gmail.com"
npm start
```

To test only the KMA adapter once:

```powershell
$env:KMA_SERVICE_KEY="your-local-service-key"
npm run check:kma-live
```

Important:

- Keep the real KMA key in your local environment only.
- KMA uses grid coordinates (`nx`, `ny`), so the backend converts latitude/longitude before calling the API.
- If the KMA request fails or no coordinates are available, the backend falls back to the local mock provider values.
- A `401` response usually means the service key is not active for this API yet, the wrong key type was copied, or the key needs more time after approval.

## Enable Live FMI ECMWF Forecast

FMI Open Data does not require an API key for the current WFS forecast endpoint.
This is the recommended third provider for the MVP while Windy remains optional.

Start only FMI live mode with:

```powershell
$env:WEATHER_PROVIDER_MODE="fmi"
npm start
```

Start KMA, Yr.no, and FMI together with:

```powershell
$env:WEATHER_PROVIDER_MODE="kma,yr,fmi"
$env:KMA_SERVICE_KEY="your-local-service-key"
$env:YR_USER_AGENT="WeatherCheck/0.1 weathercheck.official@gmail.com"
npm start
```

To test the recommended MVP live comparison once:

```powershell
$env:KMA_SERVICE_KEY="your-local-service-key"
$env:YR_USER_AGENT="WeatherCheck/0.1 weathercheck.official@gmail.com"
npm run check:mvp-live
```

To test only the FMI adapter once:

```powershell
npm run check:fmi-live
```

Important:

- FMI returns ECMWF-based point forecast values through Open Data WFS.
- No secret key is needed, but attribution is required under FMI Open Data / CC BY 4.0 terms.
- In the app's current three-column comparison table, FMI fills the third provider slot.
- If the FMI request fails or no coordinates are available, the backend falls back to the local mock provider values.

## Enable Live Windy Forecast

Windy is now optional for MVP. It requires a Point Forecast API key.

Start only Windy live mode with:

```powershell
$env:WEATHER_PROVIDER_MODE="windy"
$env:WINDY_API_KEY="your-local-windy-point-forecast-key"
npm start
```

Start KMA, Yr.no, and Windy together if a Windy key is available:

```powershell
$env:WEATHER_PROVIDER_MODE="kma,yr,windy"
$env:KMA_SERVICE_KEY="your-local-service-key"
$env:YR_USER_AGENT="WeatherCheck/0.1 weathercheck.official@gmail.com"
$env:WINDY_API_KEY="your-local-windy-point-forecast-key"
npm start
```

To test only the Windy adapter once:

```powershell
$env:WINDY_API_KEY="your-local-windy-point-forecast-key"
npm run check:windy-live
```

Important:

- The key must be a Windy Point Forecast API key.
- The backend currently uses the `gfs` model by default.
- If the Windy request fails or no coordinates are available, the backend falls back to the local mock provider values.

## Verify

From `backend`:

```powershell
npm run verify
```

From `mobile-app`:

```powershell
npm run check:backend-mode
```

## Moderate Prototype Reports

From `backend`:

```powershell
npm run moderate -- list
npm run moderate -- hide <report-id> "reason"
npm run moderate -- pending <report-id> "reason"
npm run moderate -- show <report-id> "reason"
```

## Data Storage

Prototype data is stored in:

```text
backend/data/weather-check-db.json
```

This file is ignored by git.

## Endpoints

- `GET /health`
- `GET /provider-status`
- `POST /weather/provider-snapshot`
- `POST /field-reports/snapshot`
- `POST /field-reports`
- `POST /report-requests`
- `POST /reports/:id/moderation`

## Next Backend Steps

- Mobile report submission now calls `POST /field-reports` when API mode is enabled.
- Mobile report request creation now calls `POST /report-requests` when API mode is enabled.
- Mobile refresh now pulls backend field reports and report requests back into the app.
- The compare tab now consumes the provider snapshot kept in app state.
- Prototype moderation script added for listing, hiding, pending, and showing saved reports.
- Yr.no Locationforecast adapter added behind `WEATHER_PROVIDER_MODE=yr`.
- KMA short forecast adapter added behind `WEATHER_PROVIDER_MODE=kma`.
- FMI ECMWF Open Data adapter added behind `WEATHER_PROVIDER_MODE=fmi`.
- Windy Point Forecast adapter added behind `WEATHER_PROVIDER_MODE=windy`.
- Replace JSON-file storage with SQLite or a hosted database.
- Replace the script with a small admin moderation screen later.
- Use `WEATHER_PROVIDER_MODE=kma,yr,fmi` as the recommended MVP comparison mode.
