# Next Work Queue

This queue is ordered for the next focused development sessions.

## 1. Native Location

Goal:

- Replace web-only geolocation with Expo-native location support.

Status:

- `expo-location` installed.
- Native foreground permission flow connected through `src/services/locationService.ts`.
- Resolved coordinates are copied into the current `SearchContext` target for API use.

Needs testing later:

- Test location permission prompt on Android/iOS.

Implementation notes:

- Keep `src/services/locationService.ts` as the public app boundary.
- Preserve fallback behavior when permission is denied.

## 2. Native Storage

Goal:

- Replace web-only `localStorage` with native-safe storage.

Status:

- AsyncStorage installed.
- `src/services/persistentStorage.ts` now uses web `localStorage` on web and AsyncStorage on Android/iOS.

Implementation notes:

- Only update `src/services/persistentStorage.ts`.
- Keep `src/services/appPersistence.ts` unchanged if possible.

## 3. API Mode Dry Run

Goal:

- Run the app in API mode against the local mock API.

Status:

- Local mock API server exists at `mobile-app/scripts/mock-api-server.mjs`.
- `npm run check:api-mode` verifies provider snapshots, field-report snapshots, report creation, request creation, request answers, and moderation through API mode.
- `npm run verify` now includes typecheck, domain checks, mock API health, API-mode, backend-mode, and release-readiness checks.
- Local backend API mode quickstart is documented in `docs/11-local-api-mode-quickstart.md`.

Manual preview steps:

1. Start `node scripts/mock-api-server.mjs`.
2. Set `EXPO_PUBLIC_DATA_MODE=api`.
3. Set `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8793`.
4. Verify judgement, compare, map, and report tabs still render.

Phone testing:

- Replace `127.0.0.1` with the PC LAN IP.
- Friend web/PWA testing guide is documented in `docs/12-friend-web-test-guide.md`.

## 4. Backend MVP

Goal:

- Add a tiny backend that stores field reports and report requests.

Status:

- Local backend scaffold added in `backend`.
- JSON-file storage added for prototype field reports and report requests.
- Backend endpoints added for provider snapshots, field report snapshots, field report creation, report request creation, report request answers, and report moderation.
- Backend verification script passes.
- Backend provider status endpoint added at `GET /provider-status`.
- Mobile app can smoke-test against the backend through `npm run check:backend-mode`.
- Mobile report submission, report request creation, and report request replies can write to the backend when API mode is enabled.
- Mobile refresh now applies backend field reports and report requests back into app state.
- Compare tab now reads the app-level provider snapshot instead of rebuilding mock comparison data inside the screen.
- Field report moderation endpoint is wired from the app's report action.
- JSON storage compacts old prototype data so local test data does not grow without limit.

Recommended first backend endpoints:

- `POST /weather/provider-snapshot`
- `POST /field-reports/snapshot`
- `POST /field-reports`
- `POST /report-requests`
- `POST /report-requests/:id/answer`
- `POST /reports/:id/moderation`

First storage option:

- Simple JSON or SQLite while prototyping.
- Move to a hosted database after user flow stabilizes.

## 5. Store Prep

Goal:

- Prepare for first Android internal test and iOS TestFlight.

Status:

- EAS CLI installed locally.
- `eas.json` created with Android `preview` APK and `production` AAB profiles.
- Android app package/versionCode configured.
- Android test build guide added in `docs/09-android-test-build-guide.md`.
- Release readiness script added with `npm run check:release-readiness`.
- User-generated field reports now have a lightweight report action and pending moderation state.

Needs later:

- Expo/EAS account login.
- First Android preview APK build was generated once, but remote install feedback needs a local Android device/tablet for reliable debugging.
- App icon polish on a real phone.
- Splash screen polish on a real phone.
- Store screenshots.
- Privacy policy finalization.
- Apple Developer account.
- Google Play Console account.
- EAS Build setup.

## 6. Design Follow-Up

Keep current `alt3` as the active visual direction.

Later improvements:

- Polish top app header spacing.
- Recheck bottom tab icons on a real phone.
- Map tab now uses OpenStreetMap iframe on web preview and `react-native-maps` on Android/iOS builds.
- Tune native map marker styling after the first Android APK install.
- Create store screenshot states from the best-looking screens.

## 7. Next Engineering Step

Goal:

- Move from prototype readiness toward the first installable Android test build.

Recommended next slice:

- Run the app in API mode against the local backend with `WEATHER_PROVIDER_MODE=fmi`.
- Then run `kma,yr,fmi` once the KMA key and Yr User-Agent are present in the terminal environment.
- Prepare the first Android preview build after Expo/EAS login.
