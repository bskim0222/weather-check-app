# MVP Release Checklist

This checklist keeps the first app-store MVP focused and reviewable.

## MVP Scope

The first releasable version should do these things well:

- Show a current-location weather judgement.
- Accept a natural-language question such as "잠실운동장 지금 비 와?"
- Compare KMA, Yr.no, and FMI ECMWF provider snapshots.
- Let users leave a short local weather report.
- Let users answer simple report requests.
- Keep report request answer counts/status in the backend during API mode.
- Show nearby reports on a map-style screen.
- Render a real native map on Android/iOS and a web map preview in browser testing.
- Keep the mobile-first layout readable on Android tablets by constraining the app width.
- Show hourly and daily forecast comparison tables.

Do not include these in the first MVP unless the core loop is already stable:

- Full social profiles.
- Public follower or ranking systems.
- Complex push notification routing.
- Paid features.
- AI chat beyond weather-question interpretation.

## Store Review Sensitive Areas

### Location

The app needs a clear reason for location access:

- Show weather judgement near the user.
- Match nearby field reports.
- Sort map/report results by distance.

The app should still work when location is denied:

- Use a default/sample location.
- Let the user search a place manually.
- Explain that the result may be less local.

### User Reports

Because users can write field reports, the app needs moderation basics:

- Report/block path for harmful content.
- Basic prohibited content policy.
- Ability to remove reported content from the server.
- Field report cards include a lightweight report action.
- Reported field reports can be marked `pending` through the backend moderation endpoint.
- Report request answers are counted server-side so refreshes do not lose the request state.
- Avoid exposing precise user identity or exact home location.

### Weather Disclaimer

The app should say that weather judgement is informational:

- It compares forecasts and nearby reports.
- It is not an official safety warning system.
- Users should follow official emergency alerts in severe weather.

## Tester Distribution Plan

### Before Store Submission

- Web preview for quick design and flow checks.
- PWA-style mobile web preview for friends while APK testing is limited.
- Android APK or internal Play test for early installation checks.
- iOS TestFlight once Apple account and signing are ready.

### Recommended First Tester Group

- 3 to 5 close testers first.
- Then 10 to 20 testers once reports, location, and comparison screens feel stable.
- Ask testers to check one real place they know, submit one report, and compare one forecast table.

## Technical Readiness

- Expo app builds for web.
- Android build path prepared.
- iOS build path prepared.
- Location status has a fallback state.
- Weather provider data enters through `src/services/weatherProviders.ts`.
- Field report data enters through `src/services/fieldReports.ts`.
- API contracts are documented in `docs/04-api-data-contracts.md`.
- App state persistence works on web preview and native builds through the storage abstraction.
- Map rendering uses OpenStreetMap iframe on web preview and `react-native-maps` on Android/iOS.
- Root `scripts/check-project.ps1` runs secret hygiene, backend checks, mobile checks, and release readiness checks.
- Android preview build has a checked wrapper script that runs preflight before EAS build.
- Web export injects PWA metadata and icons through `scripts/post-export-pwa.mjs`.

## Next Engineering Milestones

1. Run release readiness checks before every native test build.
2. Connect `kma,yr,fmi` live backend mode in app API mode.
3. Add user-facing report/block entry points for field reports.
4. Create Android internal test build.
5. Prepare iOS TestFlight build profile and Apple account setup.
