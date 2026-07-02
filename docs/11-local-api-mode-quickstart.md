# Local API Mode Quickstart

This is the shortest path for checking the app with backend data.

## 0. Whole Project Check

Run this after meaningful changes:

```powershell
cd C:\Users\bskim\Documents\날씨앱만들기
.\scripts\check-project.ps1
```

This also checks that real provider keys were not accidentally saved into project files.

## 1. Backend, FMI Only

FMI does not need an API key, so this is the fastest real-provider smoke test.

```powershell
cd C:\Users\bskim\Documents\날씨앱만들기\backend
npm run start:fmi
```

Check provider setup in the browser:

```text
http://127.0.0.1:8796/provider-status
```

Expected:

- `FMI ECMWF` enabled and configured
- KMA and Yr.no may be disabled or fallback unless their environment values are set

## 2. Backend, MVP Live Mode

Use this when KMA and Yr.no values are ready in the terminal environment.

```powershell
cd C:\Users\bskim\Documents\날씨앱만들기\backend
$env:KMA_SERVICE_KEY="your-local-service-key"
$env:YR_USER_AGENT="WeatherCheck/0.1 weathercheck.official@gmail.com"
npm run start:mvp
```

One-shot live check:

```powershell
cd C:\Users\bskim\Documents\날씨앱만들기\backend
$env:KMA_SERVICE_KEY="your-local-service-key"
$env:YR_USER_AGENT="WeatherCheck/0.1 weathercheck.official@gmail.com"
npm run check:mvp-live
```

## 3. Mobile App API Mode

In another terminal:

```powershell
cd C:\Users\bskim\Documents\날씨앱만들기\mobile-app
npm run web:api
```

Mock API mode is also supported for local UI checks without the backend. It now supports report creation, request creation, request answers, and moderation smoke flows.

Static web export in API mode:

```powershell
cd C:\Users\bskim\Documents\날씨앱만들기
.\scripts\export-api-preview.ps1
```

Then serve the exported app:

```powershell
cd C:\Users\bskim\Documents\날씨앱만들기\mobile-app
node scripts/serve-dist-phone.mjs
```

## Notes

- Do not save real provider keys into repo files.
- For phone testing on the same Wi-Fi, replace `127.0.0.1` with the PC LAN IP.
- If provider data fails, the app falls back to sample values and explains that state in the top banner.
