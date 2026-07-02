# Weather Check Prototype Architecture

## Current Goal

The current prototype is an Expo app for Android, iOS, and web preview. It focuses on the core product loop:

1. Ask a natural-language weather question.
2. Interpret place, time, and weather intent.
3. Show a decision card.
4. Explain the decision.
5. Compare KMA, Yr.no, and Windy forecasts.
6. Show nearby field reports on a map-style screen.
7. Let users request or submit local reports.

The app still uses mock data, but the screen state already behaves like a real product flow.

## Main Runtime

App entry:

- `mobile-app/App.tsx`

Responsibilities:

- Holds active tab state.
- Holds current weather judgement.
- Holds local field reports.
- Wires shared state into all screens.

`App.tsx` should stay mostly as the coordinator. Weather interpretation and judgement creation now live in domain logic instead of being assembled directly inside the component.

## Screens

- Shared app shell
  - Header refresh state.
  - Question search bar disabled state while data is loading.
  - Data status banner for mock, loading, fallback, and error states.

- `src/screens/DecisionScreen.tsx`
  - Main decision card.
  - Search interpretation result.
  - Reasoning section.
  - Next 6-hour flow.
  - One-line field report input.
  - Empty state when no local reports exist.

- `src/screens/CompareScreen.tsx`
  - KMA / Yr.no / Windy forecast comparison.
  - Hourly and daily modes.
  - Uses search context to change forecast comparison rows.

- `src/screens/MapScreen.tsx`
  - Map-like field report distribution.
  - Shows context-aware temporary field signals when no real reports exist.
  - Lets users select report markers and list items.
  - Empty state for no marker/report results.

- `src/screens/ReportScreen.tsx`
  - Field report request flow.
  - Request list and reply box.
  - Turns replies into local field reports.
  - Empty states for no requests, no selected request, and no live reports.

## UI Components

- `src/components/DecisionCard.tsx`
  - Weather-specific judgement card.
  - This is the first major surface to receive the final mockup design treatment.

- `src/components/CompareOverview.tsx`
  - Provider comparison hero and service summary cards.

- `src/components/ForecastComparePanel.tsx`
  - Hourly/daily forecast comparison controls and rows.

- `src/components/CompareDifferenceSection.tsx`
  - Service difference cards and comparison focus copy.

- `src/components/FieldReportMapCard.tsx`
  - Map-like visual surface and report markers.

- `src/components/FieldReportList.tsx`
  - Selectable field report list used by the map screen.

- `src/components/EmptyState.tsx`
  - Shared empty-state card for report/map/request gaps.

## Domain Logic

Domain files separate app behavior from UI rendering.

- `src/domain/search.ts`
  - Default search context.
  - Suggested questions.
  - Natural-language question parsing.
  - Weather intent detection.
  - Place/time interpretation.

- `src/domain/location.ts`
  - Known place references for the prototype.
  - Current-location placeholder.
  - Radius formatting for map/report surfaces.

- `src/domain/judgement.ts`
  - Creates the default current-location judgement.
  - Creates a judgement from a natural-language question.
  - Updates the judgement when the user manually changes the weather chip.
  - Keeps `weatherKey`, `WeatherPreset`, and `SearchContext` together as one state object.

- `src/domain/compare.ts`
  - Context-aware forecast rows.
  - Hourly/daily comparison data.
  - Comparison focus copy.

- `src/domain/reports.ts`
  - Report condition inference.
  - Context-aware temporary field report rows.
  - Report prompt rows.

## Service Layer

Service files are API integration placeholders. They currently return mock/domain data, but they define where real external data should enter later.

- `src/config/appConfig.ts`
  - Reads Expo public environment values.
  - Defines whether the app is in `mock` or `api` mode.
  - Keeps provider keys and backend URL out of screen components.

- `src/services/apiClient.ts`
  - Common JSON API reader/writer for future backend calls.
  - Returns a small `{ ok, data, error }` result shape instead of throwing into UI code.

- `src/services/locationService.ts`
  - App-side current location resolver.
  - Provides checking, denied, unavailable, fallback, and granted states before native location integration is added.

- `src/services/persistentStorage.ts`
  - Storage boundary for persisted app state.
  - Uses web localStorage today and can later be replaced with native storage without touching screen code.

- `src/types/appState.ts`
  - Shared data loading status shape.
  - Used by the app shell to explain whether the screen is loading, mock-backed, API fallback-backed, or failed.

- `src/services/weatherProviders.ts`
  - Future home for KMA / Yr.no / Windy fetch logic.
  - Returns a `WeatherProviderSnapshot` with source metadata, provider sources, service summaries, and difference cards.
  - Currently returns mock provider summaries and comparison data.

- `src/services/fieldReports.ts`
  - Future home for user field reports and report requests API logic.
  - Returns a `FieldReportSnapshot` with source metadata, ordered report feed, and report requests.
  - Currently returns local mock reports, context-aware prompt rows, and mock request ordering.

## Data

- `src/data/mockWeather.ts`
  - Weather presets.
  - Initial field reports.
  - Default report requests.
  - Static comparison summaries and difference cards.

This is where mock data lives now. Later, actual API or server data should flow into the domain functions instead of replacing screen UI directly.

## Future API Integration Points

1. Weather providers
   - Replace or enrich `weatherPresets`.
   - Feed provider data through `src/services/weatherProviders.ts`.
   - Keep `src/domain/compare.ts` focused on turning provider data into comparison-ready rows.
   - Store local Expo keys in `.env.local` using `.env.example` as the template.

2. Location
   - Replace the default `현재 위치` context with a permission-based location result.
   - Keep `SearchContext` as the shared UI contract.

3. Field reports
   - Replace local `reports` state in `App.tsx` with server-backed data through `src/services/fieldReports.ts`.
   - Keep `LocalReport` shape or evolve it into a server model.

4. Report requests
   - Replace local `requests` state in `ReportScreen.tsx` with API-backed request data.
   - Add push notifications later after the request model stabilizes.

5. Map
   - Replace visual mock map in `MapScreen.tsx` with Naver Map, Kakao Map, Google Maps, or another native map SDK.
   - Keep the selected report behavior.

## Current Prototype Status

Completed:

- Shared search context across all tabs.
- Central weather judgement state.
- Search contexts now include a `LocationReference`.
- Weather-specific decision cards.
- Context-aware forecast comparison.
- Context-aware map and report placeholder signals.
- Weather provider snapshot placeholder.
- Field report snapshot placeholder.
- Recent and suggested questions.
- Current-location refresh behavior.
- Basic Expo structure for Android/iOS/web.
- Environment configuration placeholder.
- Common API client placeholder.
- API requests now send `SearchContext` to provider and field-report snapshot endpoints.
- API mode has a local smoke test through `scripts/check-api-mode.mjs`.
- Current-location status flow with fallback state.
- Persistent storage boundary for future native storage.
- Domain smoke check script.
- Loading, mock, API fallback, and error status UI.
- Empty states for reports, map results, and report requests.
- Decision card extracted into a design-ready component.
- Compare tab extracted into design-ready components.
- Map tab extracted into design-ready components.

Next structural steps:

- Apply the selected mockup visual direction to `DecisionCard`, then shared cards.
- Then apply the same visual system to compare, map, and report components.
- Add lightweight screen-level interaction tests after the UI settles further.

## Design Application Order

Recommended order for the final mockup treatment:

1. `DecisionCard` - first visual pass started.
2. Search/result card and data status banner
3. Forecast/provider source cards
4. Bottom tabs and app shell spacing
5. Compare components
6. Map and report components

Current design note:

- The first `DecisionCard` pass moves the card toward the selected burgundy storm direction.
- Weather-specific colors remain, but their saturation is lowered so they fit the overall app shell.
- The card now emphasizes judgement, summary, temperature, and three compact evidence signals.

See `docs/04-api-data-contracts.md` for the current app-side API contract.
