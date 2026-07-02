# Privacy And Safety Draft

This is a working draft for product decisions and store-review preparation. It is not a final legal document.

## Data The App May Use

### Location

Purpose:

- Show weather judgement near the user.
- Compare nearby field reports.
- Sort map/report content by distance.

MVP rule:

- Ask for location only when needed.
- Keep the app usable when location is denied.
- Avoid showing the user's exact coordinates to other users.

### Weather Questions

Purpose:

- Interpret place, time, and weather intent.
- Improve recent-question convenience on the device.

MVP rule:

- Store recent questions locally first.
- Do not treat questions as public posts.

### Field Reports

Purpose:

- Let nearby users share what they are seeing.
- Improve the judgement card with real-world signals.

MVP rule:

- Field reports are public within the app experience.
- Reports should avoid personal information.
- Reports should include a moderation status such as `visible`, `pending`, or `hidden`.

## User Safety Rules

The app should not present itself as an official alert system.

Suggested wording:

> 웨더체크는 여러 예보와 현장 제보를 비교해 참고용 날씨 판정을 제공합니다. 태풍, 호우, 폭설, 낙뢰 등 위험 상황에서는 기상청과 재난문자 등 공식 안내를 우선 확인하세요.

## Report Moderation

Minimum MVP moderation features:

- Users can report inappropriate field reports.
- Admin/server can hide reported content.
- Public content does not reveal precise user identity.
- Offensive, deceptive, personal, or unsafe posts can be removed.

Future server fields:

```ts
type ModerationStatus = 'visible' | 'pending' | 'hidden';

type FieldReportModeration = {
  reportId: string;
  status: ModerationStatus;
  reason?: string;
  reviewedAt?: string;
};
```

## Permission Copy

### iOS Location Permission

Current app copy:

> 현재 위치 기준 날씨 판정과 주변 현장 제보를 보여주기 위해 위치 정보가 필요합니다.

### In-App Explanation

Suggested short copy:

> 위치를 허용하면 지금 있는 곳 주변의 예보와 현장 제보를 더 정확히 맞춰볼 수 있어요. 허용하지 않아도 장소를 검색해서 사용할 수 있습니다.

## Store Submission Notes

App Store / Play Store reviewers may care about:

- Why location is requested.
- Whether user-generated reports can be moderated.
- Whether the app makes unsafe weather guarantees.
- Whether privacy policy explains field reports and location use.
- Whether the app still works if permissions are denied.
