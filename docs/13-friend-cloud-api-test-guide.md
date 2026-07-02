# Friend Cloud API Test Guide

This guide is for testing Weather Check with 5-10 friends before store release.

## Goal

Use a small public backend so testers outside the home Wi-Fi can use the same API.

```text
Android APK
-> Render backend URL
-> KMA / Yr.no / FMI provider adapters
-> field reports stored on the backend
```

## 1. Deploy Backend To Render

1. Create or log in to a Render account.
2. Connect this project repository.
3. Use the root `render.yaml`.
4. Create the `weather-check-backend` web service.
5. Add secret environment variables if available:

```text
KMA_SERVICE_KEY=...
YR_USER_AGENT=WeatherCheck/0.1 weathercheck.official@gmail.com
WEATHER_PROVIDER_MODE=kma,yr,fmi
```

6. After deployment, open:

```text
https://YOUR-RENDER-SERVICE.onrender.com/health
```

Expected:

```json
{ "ok": true, "service": "weather-check-backend" }
```

## 2. Build Android APK For Friends

In PowerShell:

```powershell
cd C:\Users\bskim\Documents\날씨앱만들기\mobile-app
$env:EXPO_PUBLIC_API_BASE_URL = "https://YOUR-RENDER-SERVICE.onrender.com"
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-cloud-preview.ps1
```

The script builds an APK with:

```text
EXPO_PUBLIC_DATA_MODE=api
EXPO_PUBLIC_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

## 3. Friend Test Checklist

Ask testers to check:

- App opens without force close.
- Location permission appears and app still works if denied.
- `미리보기 데이터` does not stay visible after loading.
- Question search works.
- Weather decision card changes by question/weather state.
- Field report can be posted.
- Posted field report appears in field/report sections.
- Map tab opens without app crash.
- Forecast compare tab scrolls horizontally.

## Notes

- Render free services may sleep after inactivity, so first load can be slow.
- The current backend uses a simple file database. That is acceptable for friend testing, but production should move reports to a managed database such as Supabase Postgres.
- Do not put public API keys directly into the app build.
