# 웨더체크 신고·운영 가이드

## 목적

사용자는 부적절한 현장 제보를 즉시 삭제하지 못하고 `검토 요청` 상태로 보낼 수 있습니다. 운영자만 검토 목록을 조회하고 게시물을 다시 공개하거나 숨길 수 있습니다.

## 운영 환경 설정

Render의 `weather-check-backend` 서비스 환경 변수에 다음 값을 설정합니다.

- Key: `ADMIN_API_TOKEN`
- Value: 충분히 긴 무작위 문자열

토큰은 GitHub, 앱 번들, 문서에 기록하지 않습니다. 환경 변수가 없으면 일반 날씨·제보 API는 계속 동작하지만 관리자 API는 `503`을 반환합니다.

## 관리자 API

모든 요청에 다음 헤더가 필요합니다.

```text
Authorization: Bearer <ADMIN_API_TOKEN>
```

## 관리자 화면

백엔드가 배포된 뒤 아래 주소를 엽니다.

```text
https://weather-check-backend-hvfs.onrender.com/admin
```

Render에 등록한 `ADMIN_API_TOKEN`을 입력하면 검토 중·공개·숨김 글을 조회하고
공개 또는 숨김 처리할 수 있습니다. 토큰은 서버가 HTML에 포함하지 않으며,
관리자 브라우저의 현재 탭 세션 저장소에만 보관됩니다.

검토 대기 글 조회:

```text
GET /admin/reports?status=pending
```

전체 글 조회:

```text
GET /admin/reports?status=all
```

글 숨김:

```text
POST /admin/reports/<글 ID>/moderation
Content-Type: application/json

{"moderationStatus":"hidden","reason":"운영 정책 위반"}
```

글 복원:

```text
POST /admin/reports/<글 ID>/moderation
Content-Type: application/json

{"moderationStatus":"visible","reason":"검토 완료"}
```

## 검증

로컬 자동 검증은 잘못된 토큰 차단, 검토 목록 조회, 숨김 처리를 확인합니다. 운영 서버에서는 아래 환경 변수를 현재 셸에만 설정한 뒤 검증합니다.

```powershell
$env:WEATHER_CHECK_ADMIN_TOKEN='<Render와 같은 토큰>'
node backend/scripts/verify-live.mjs
Remove-Item Env:WEATHER_CHECK_ADMIN_TOKEN
```

검증 스크립트는 테스트용 질문과 제보를 생성한 뒤 수정·신고·복원·삭제까지 확인하고 마지막에 정리합니다.
