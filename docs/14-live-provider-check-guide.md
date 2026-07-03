# Live Provider Check Guide

This guide records how to verify the MVP weather provider stack.

## Current MVP providers

- 대한민국 기상청: KMA short forecast API
- 노르웨이 기상청: Yr/MET Locationforecast API
- 핀란드 기상청: FMI Open Data / ECMWF forecast

## Render environment values

Render service: `weather-check-backend`

Required environment variables:

- `WEATHER_PROVIDER_MODE`: `kma,yr,fmi`
- `YR_USER_AGENT`: contact-aware User-Agent, for example `WeatherCheck/0.1 weathercheck.official@gmail.com`
- `KMA_SERVICE_KEY`: public data portal KMA service key
- `NODE_VERSION`: `24`

Do not commit the real `KMA_SERVICE_KEY` value to the repository.

## Quick status URL

Open:

```text
https://weather-check-backend-hvfs.onrender.com/provider-status
```

Success means:

```json
{
  "providerId": "kma",
  "enabled": true,
  "configured": true
}
```

and the same `enabled/configured` true state for `yr` and `fmi`.

## Command-line check

From `backend`:

```powershell
node scripts/check-render-live.mjs
```

Or:

```powershell
npm run check:render-live
```

Success means:

- `liveProviderIds` contains `kma`, `yr`, `fmi`
- `fallbackProviderIds` is empty
- `sources` contains readable Korean provider names and weather values

## APK rebuild rule

Changing Render environment variables does not require rebuilding the APK.

Rebuild the APK only when mobile app code, assets, Expo config, or public app environment values change.
