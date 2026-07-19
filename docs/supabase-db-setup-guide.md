# Supabase DB 연결 가이드

작성일: 2026-07-19

## 목적

웨더체크 제보탭의 문의, 질문, 답변, 현장제보 글을 여러 기기에서 안정적으로 공유하기 위해 Supabase PostgreSQL을 사용한다.

## 1. Supabase 프로젝트 만들기

1. https://supabase.com 접속
2. 로그인
3. `New project` 선택
4. Organization 선택
5. Project name: `weather-check`
6. Database password 입력 후 따로 보관
7. Region은 가능하면 `Northeast Asia` 계열 또는 가까운 지역 선택
8. Free plan으로 시작

## 2. DATABASE_URL 가져오기

Supabase 프로젝트가 만들어진 뒤:

1. 왼쪽 메뉴 `Project Settings`
2. `Database`
3. `Connection string`
4. `URI` 또는 `Transaction pooler` 형식 복사
5. 비밀번호 자리(`[YOUR-PASSWORD]`)가 있으면 프로젝트 생성 때 만든 DB 비밀번호로 바꾸기

Render에 넣을 값 예시:

```text
postgresql://postgres.xxxxx:비밀번호@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

## 3. Render 백엔드 환경변수 추가

Render Dashboard에서 `weather-check-backend` 서비스로 이동:

1. `Environment`
2. `Edit`
3. 아래 변수 추가

```text
REPORT_STORAGE_MODE=postgres
DATABASE_URL=Supabase에서 복사한 PostgreSQL 연결 문자열
```

4. 저장
5. `Manual Deploy` 또는 `Deploy latest commit`

## 4. 정상 연결 확인

배포 후 아래를 확인한다.

1. 앱에서 문의하기 글 작성
2. 다른 기기에서 질문모음에 같은 글이 보이는지 확인
3. 다른 기기에서 답변 작성
4. 원래 기기에서 문의 상세에 답변이 보이는지 확인
5. 새로고침해도 글과 답변 수가 유지되는지 확인

## 주의

- `DATABASE_URL`은 비밀번호가 들어간 민감 정보라 GitHub에 올리면 안 된다.
- Render 환경변수에만 넣는다.
- Supabase 무료 플랜으로 먼저 테스트한다.
