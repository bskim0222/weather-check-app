# 제보/문의 DB 안정화 설계

작성일: 2026-07-19

## 목표

지인 테스트 전에 제보탭을 “여러 기기에서 같은 글이 보이고, 시간이 지나도 사라지지 않는 상태”로 만든다.

현재 백엔드는 `backend/data/weather-check-db.json` 파일에 제보와 문의를 저장한다. 이 방식은 Render 재시작, 동시 작성, 배포 직후 동기화에서 불안정할 수 있으므로 출시용 테스트에는 맞지 않다.

## 이번 단계의 원칙

- 샘플 글은 라이브 앱 상태에 섞지 않는다.
- 내가 쓴 문의, 다른 사용자의 질문, 현장 답변, 현재위치 제보를 서로 구분한다.
- 질문의 답변 수는 수동 숫자가 아니라 실제 답변 개수에서 계산한다.
- 삭제는 우선 `deleted_at`을 기록하는 소프트 삭제로 처리한다.
- 지도에는 정확한 개인 좌표를 직접 노출하지 않고, 지역 묶음 좌표만 사용한다.
- 신고된 글은 `pending` 상태로 바꾸고, 운영자가 숨김 처리할 수 있게 남겨둔다.

## 데이터 모델

### field_reports

판정탭의 “현재 위치 날씨 남기기”와 질문에 달린 현장 답변을 저장한다.

- `id`: 글 ID
- `request_id`: 질문 답변이면 연결된 질문 ID, 일반 현장 제보면 비움
- `author_device_id`: 임시 사용자 식별자
- `place`: 표시 장소명
- `body`: 사용자가 남긴 글
- `condition`: 비, 비 없음, 흐림 등 사용자가 선택/추론한 상태
- `latitude`, `longitude`: 원본 좌표, 서버 내부용
- `cluster_latitude`, `cluster_longitude`: 지도 표시용 묶음 좌표
- `privacy_radius_meters`: 위치 보호 반경
- `moderation_status`: `visible`, `pending`, `hidden`
- `created_at`, `updated_at`, `deleted_at`

### report_requests

제보탭 “문의하기”에서 올린 질문을 저장한다.

- `id`: 질문 ID
- `author_device_id`: 질문 작성자 임시 식별자
- `question`: 질문 내용
- `place`: 질문 장소명
- `latitude`, `longitude`: 질문 장소 좌표
- `cluster_latitude`, `cluster_longitude`: 지도/지역 묶음 기준 좌표
- `status`: `open`, `answered`, `closed`
- `created_at`, `updated_at`, `deleted_at`

### moderation_events

신고/숨김/복구 이벤트를 기록한다.

- `id`
- `target_type`: `field_report` 또는 `report_request`
- `target_id`
- `action`: `reported`, `hidden`, `restored`
- `reason`
- `created_at`

## API 계약

### 조회

- `POST /field-reports/snapshot`
  - 현재 검색 장소와 현위치 기준으로 질문/제보/답변을 가져온다.
  - 응답에는 샘플 데이터가 절대 섞이면 안 된다.

### 문의

- `POST /report-requests`: 문의 작성
- `PATCH /report-requests/:id`: 내가 쓴 문의 수정
- `DELETE /report-requests/:id`: 내가 쓴 문의 삭제

### 현장 제보와 답변

- `POST /field-reports`: 현재위치 현장 제보 작성
- `POST /report-requests/:id/answer`: 질문에 현장 답변 작성
- `PATCH /field-reports/:id`: 내가 쓴 제보/답변 수정
- `DELETE /field-reports/:id`: 내가 쓴 제보/답변 삭제

중요: `POST /report-requests/:id/answer`는 답변 수만 올리면 안 되고, 반드시 `field_reports`에 답변 글을 새로 저장해야 한다.

## 출시 전 필수 테스트

- A 기기에서 문의 작성 → B 기기 질문모음에 표시
- B 기기에서 답변 작성 → A 기기 문의 상세에 답변 표시
- 답변 수가 새로고침 후에도 유지
- 작성 글 수정/삭제 후 다른 기기에도 반영
- 지도 마커 클릭 시 해당 지역 글만 표시
- 앱 재배포 후에도 글이 사라지지 않음

## 추천 실행 순서

1. Postgres DB 생성
2. `backend/db/schema.sql` 실행
3. Render 백엔드 환경변수에 `DATABASE_URL` 추가
4. 백엔드 저장소를 파일 저장소에서 DB 저장소로 교체
5. 제보탭 API 응답과 프론트 상태 병합 방식 정리
6. 외부 웹 링크로 두 기기 동시 테스트
