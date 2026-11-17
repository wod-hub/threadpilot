# ThreadPilot (v1.0.0)

붐비다(BUMBIDA)가 운영하는 **스레드 예약 발행 · 댓글 자동 답글** 앱입니다.
정적 PWA(GitHub Pages) + Cloudflare Worker API + D1로 실제 동작합니다.

- 서비스: <https://thread.bumbida.com>
- API: `https://thread.bumbida.com/api/*`, Threads OAuth 콜백 `https://thread.bumbida.com/oauth/threads/*`

## 이번 버전에서 바뀐 것

이전 프로토타입은 localStorage에서만 도는 시뮬레이션이었습니다. v1.0.0은 화면을 그대로 두고
**데이터 계층을 실제 API로 교체**했습니다.

- 회원가입 · 로그인 · 로그아웃 · 세션 복원 (서버 세션, HttpOnly 쿠키 `tp_session`)
- Threads 계정 연결 (메타 OAuth, `GET /api/threads/oauth/start` → `/oauth/threads/callback`)
- 자동화 규칙 저장 (`PATCH /api/rules`): 주제·금지어·말투(반말/존댓말)·톤·하루 횟수·시간대·자동 발행·답글 설정
- 초안 예약 (`POST /api/posts`), 캘린더(`GET /api/posts`), 수정·취소·즉시 발행
- 발행 로그 (`GET /api/logs`) — 서버가 기록한 발행·답글·오류를 그대로 표시
- 댓글 자동 답글 (`GET /api/replies`, `POST /api/replies/:id/send`) — 수집·자동 전송은 서버 크론
- 관리자 콘솔 `#/admin` (`GET /api/admin/overview` 등) — 권한이 없으면 401/403을 받아 안내만 표시
- 서비스 워커: 정적 자산만 캐시, `/api/*`·`/oauth/*`는 **절대 캐시하지 않음**

## 화면

해시 라우팅: `#/login` `#/signup` `#/connect` `#/home` `#/drafts` `#/calendar` `#/log` `#/settings` `#/replies` `#/pricing` `#/admin`

- **홈** — 오늘 발행 진행률, 다음 예약, 오늘 타임라인, 최근 알림
- **글쓰기** — 템플릿 기반 초안 3개 생성(기기에서 생성) → 서버가 고른 빈 시간에 예약
- **예약** — 주간 캘린더, 항목별 보기·수정·즉시 발행·취소
- **로그** — 발행·답글·시스템 기록(서버 생성), 60초마다 새로고침
- **설정** — 계정 연결/해제, 주제·금지어·말투·톤·발행량·시간대·자동화, 구독 상태
- **댓글 자동 답글** — 수집된 댓글과 답글 상태, 말투/톤/응답 시점 설정, 수동 전송
- **관리자 콘솔** — KPI, 고객 목록, 자동 발행 정지/재개, 요금제 변경, 실패 로그 재시도

## 데이터

- 서버(D1): 계정, Threads 연결(토큰은 AES-256-GCM 암호화), 규칙, 예약 큐, 댓글/답글, 감사 로그
- 브라우저(localStorage): 생성한 **초안**, 캘린더 주 이동, 읽음 시각만 저장합니다.
  새로고침하면 서버 상태를 다시 읽습니다.

## 세션과 권한

- `tp_session` (HttpOnly · Secure · SameSite=Lax, 30일) — 모든 `/api/*` 요청에 자동 전송
- 관리자는 `role='admin'` + 별도 `tp_admin` 쿠키(8시간)가 있어야 `/api/admin/*`가 200을 돌려줍니다.
  공개 가입으로는 관리자가 될 수 없고, 서버의 `ADMIN_SETUP_TOKEN`으로만 승격합니다.

## API 요약

| 영역 | 엔드포인트 |
| --- | --- |
| 인증 | `POST /api/auth/signup` · `login` · `logout`, `GET/PATCH /api/auth/me` |
| 연결 | `GET /api/threads/oauth/start`, `GET /api/threads/accounts`, `PATCH`/`DELETE /api/threads/accounts/:id` |
| 규칙 | `GET/PATCH /api/rules`, `GET /api/slots?n=5` |
| 예약 | `GET/POST /api/posts`, `GET/PATCH /api/posts/:id`, `POST /api/posts/:id/cancel` · `/publish-now` |
| 기록 | `GET /api/logs`, `GET /api/replies`, `POST /api/replies/:id/send` |
| 관리자 | `GET /api/admin/overview` · `tenants`, `PATCH /api/admin/tenants/:id`, `POST /api/admin/logs/:id/retry`, `GET /api/admin/audit-logs` |
| 상태 | `GET /api/health` |

응답 형식은 `{ ok: true, data }` / `{ ok: false, error: { code, message } }` 입니다.

## 개발·배포

- 이 저장소(`main`)는 GitHub Pages로 `thread.bumbida.com`에 배포됩니다.
- `index.html`이 `app.js?v=…`, `styles.css?v=…`로 버전 쿼리를 붙입니다.
  **정적 파일을 바꾸면 버전을 올려 주세요** — CDN·서비스 워커 캐시 때문에 같은 URL은 잠시 이전 파일이 보일 수 있습니다.
- 로컬에서 `python3 -m http.server`로 열면 **화면만** 확인할 수 있습니다.
  API가 `thread.bumbida.com`의 같은 출처 쿠키 세션을 쓰므로 실제 동작·로그인은 배포 도메인에서 확인합니다.

## 참고

- 메타 앱이 개발 모드인 동안에는 앱에 등록된 테스터 계정만 Threads 연결이 됩니다.
  연결 실패 시 화면에 한국어 안내가 표시됩니다.
- 개인정보처리방침·이용약관·데이터 삭제 안내: `privacy.html`, `terms.html`, `data-deletion.html`
- 운영: 붐비다 (BUMBIDA) · 붐비다 자동화 스튜디오
