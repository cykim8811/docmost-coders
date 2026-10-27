# Coders 문서 MVP

Docmost 0.97.0의 AGPL 코어를 Coders Core v2에서 실행하는 공개 포크입니다.
앱 이용료와 송금 권한은 사용하지 않습니다. 컴퓨팅·DB·Redis 비용은 Coders
리소스 공동 계좌에서 별도로 발생합니다.

## 현재 구현

- Coders가 주입한 `Coders-User-Id`, `Coders-Resource-Id`, `Coders-Resource-Role`을 HTTP와 협업 소켓에서 검증합니다.
- Coders 리소스 하나를 Docmost 워크스페이스 하나, DB 하나에 대응시킵니다.
- 검증된 `owner`가 처음 접속할 때 초기 관리자로 등록합니다. 일반 멤버의 선행 방문은 초기화하지 않습니다.
- 문서·공간·그룹 권한은 기존 AGPL 코어의 권한 검사를 유지합니다.
- 첨부파일은 PostgreSQL에 저장합니다. 파일당 5 MiB 제한, 범위 다운로드를 지원합니다.
- 컨테이너는 UID/GID 65534, 읽기 전용 루트, `/tmp` 64 MiB 조건에서 실행합니다.
- 프론트는 정적 파일과 해시 라우팅을 사용합니다. HTTP는 `/api/bridge`, 협업은
  `/api/collab`, 알림은 `/api/events`로 연결합니다.
- HTTP API는 Core의 `/_coders/sdk.js`와 Axios fetch 어댑터를 거칩니다.
  준비 중·계좌 확인·응답 불명 상태에서는 사용자 확인 후 SDK의 동일 요청
  `retry()`를 사용하며, 원본 키·본문을 유지합니다. JSON과 바이너리 응답을 지원합니다.
- 서비스 화면에 실행 버전의 소스 링크를 제공합니다.

Enterprise 소스 세 디렉토리는 제거했으며 해당 구현을 번들에 포함하지 않습니다.
라이선스 검사를 우회해 유료 기능을 활성화하는 방식이 아닙니다.

## 초기 관리자와 신원 확인

Core가 클라이언트의 신원·역할 헤더를 제거하고 원장에서 확인한 사용자 ID,
리소스 ID, `owner | member` 역할을 주입합니다. ID를 배포마다 고정하지 않습니다.
검증된 `owner`가 처음 접속하면 관리자 계정·워크스페이스·리소스 연결을
DB 트랜잭션과 잠금으로 원자적으로 생성합니다.

멤버가 먼저 방문하면 `403 coders_owner_setup_required`와 소유자의 초기 설정을
기다리는 화면을 표시합니다. 소유자가 설정을 마친 뒤 같은 멤버가 다시 접속하면
일반 멤버로 등록됩니다. 이후 관리자·편집자 등 앱 내부 역할은 Docmost 정책으로
관리합니다. Core 소유권 이전만으로 기존 Docmost 관리자 역할을 자동 이전하지 않습니다.

리소스의 멤버 초대·접근 철회는 Core에서, 앱 내부 공간 권한은 Docmost에서 관리합니다.
신원은 매 요청과 WebSocket 연결에서 확인하며 프로세스 전역에 사용자별 신원을 저장하지 않습니다.
일반 인터넷 요청이 이 헤더를 직접 보낼 수 있는 서버로 공개하면 안 됩니다.
신뢰 경계는 Core의 격리 프록시입니다.

## 빌드와 게시

Node.js 26, pnpm 11.28.2를 사용합니다.

```bash
pnpm install --frozen-lockfile
pnpm --filter @docmost/editor-ext build
pnpm --filter @docmost/base-formula build
pnpm --filter server build
node scripts/coders/build-frontend.cjs
node scripts/coders/check-community.cjs
```

`coders/public`의 빌드 결과도 Git에 커밋합니다. Core는 고정 커밋의 정적 프론트를
읽으므로 이미지 안에서만 프론트를 빌드하는 것으로는 충분하지 않습니다.

`codex/coders-community` 브랜치의 GitHub Actions가 linux/amd64 이미지를
`ghcr.io/cykim8811/docmost-coders:sha-{40자리_커밋}`에 게시하고 빌드 증명을 생성합니다.
새 GHCR 패키지는 GitHub 패키지 설정에서 Public으로 지정해야 합니다.
원본의 Enterprise 릴리스 워크플로는 이 포크의 배포에 사용하지 않습니다.

Coders에서 해당 공개 저장소와 커밋을 준비하고, 리소스의 PostgreSQL 보관 용량과
워크스페이스의 보관 용량·기간을 선택하고 `frontend` 권한을 승인합니다.
`coders.json`의 `services: ["postgres", "redis"]` 선언으로 두 서비스를 준비합니다. `network`, `transfer`,
`openai` 권한은 이 MVP에 필요하지 않습니다.

공개 빌드가 완료된 커밋에 대응하는 앱 주소는 다음 형식입니다.

```text
https://core-v2.coders.kr/github/cykim8811/docmost-coders/{40자리_커밋}
```

## 운영 조건과 남은 실환경 확인

- 실제 Coders DB에서 `unaccent`, `pg_trgm` 확장과 함수·트리거 생성 권한이 필요합니다.
- Redis 7.4의 Core ACL(Lua·Pub/Sub 허용, 관리·위험 명령 차단)과
  32개 연결·64 MiB·`noeviction`·AOF `appendfsync always` 조건에서 검증합니다.
  Coders에서는 큐의 일반 연결을 공유하고 워커 대기 연결만 별도로 유지합니다.
  `CODERS_MODE=true REDIS_URL=... node scripts/coders/redis-smoke.cjs`가 큐 13개·워커 7개의 연결 예산과 작업 처리를 검사합니다.
- Redis는 앱 자동 중지와 별개로 실행·과금됩니다. Redis의 AOF·스냅샷·재작성 파일은
  PostgreSQL과 보관 용량을 공유합니다. 64 MiB 초과 시 키를 삭제하지 않고 쓰기를 거부합니다.
  잔액 부족·소유자 중지·보관 만료 정책을 따르며, 재연결이 저장 용량 부족을 해결하지는 않습니다.
- 플랫폼의 기본 WebSocket 최대 300초, 메시지 1 MiB, 리소스 동시 연결 32개 제한을 따릅니다.
  연결 수는 사용자 수와 같지 않습니다. 대규모 문서의 첫 동기화는 1 MiB 제한에 걸릴 수 있습니다.
- 재접속과 DB 복원은 구현했지만, 프로세스가 강제 종료되면 마지막 DB 저장 이전 편집은
  유실될 수 있습니다. 편집 저장 지연은 500 ms, 최대 2초로 줄였습니다. 무손실 저장을 보장하지 않습니다.
- 백그라운드 큐 작업을 접속과 무관하게 처리하려면 Core에서 계속 실행을 선택합니다.
  자동 중지에서는 다음 실행까지 지연될 수 있습니다.
- 앱 서명 비밀키는 DB에 한 번 생성하고 재시작 시 재사용합니다. 이미지·소스·파일에 기록하지 않습니다.
- Docmost DB 마이그레이션은 시작 시 실행됩니다. 버전 변경 전에 백업하고,
  최신 스키마를 이전 버전 코드로 되돌리지 마십시오.
- 공개 공유 URL도 Core 리소스 접근 검사를 거칩니다. 로그인 없는 공개 문서 포털은 MVP 범위 밖입니다.
- 외부 iframe·원격 이미지·Worker가 필요한 기능은 Core CSP에 제한됩니다.
  MVP의 검증 범위는 기본 문서·공간 권한·첨부파일·실시간 협업입니다.
- 운영 리소스의 DB·Redis 한도, 메모리·CPU, HTTP 본문 상한, 이미지 압축 크기는 실제 배포에서 검증해야 합니다.

## 검증 방법

```bash
NODE_OPTIONS=--no-experimental-webstorage pnpm --filter client test
pnpm --filter server test --runInBand --silent integrations/queue/queue-connection integrations/health/redis.health integrations/coders common/guards/jwt-auth.guard collaboration/extensions/authentication.extension common/helpers/with-cache
```

로컬 통합 검증은 별도 PostgreSQL 18·Redis 8과 읽기 전용 앱 컨테이너를 사용합니다.
`scripts/coders/smoke.mjs`는 인증 우회 차단, 초기 설정 전 멤버 차단과 설정 후 비관리자 상태,
리소스 격리, 문서·첨부파일, 두 사용자 Yjs 편집과 재접속·DB 저장을 확인합니다.
`scripts/coders/dev-proxy.cjs`는 Core의 동작을 흉내내는 **로컬 테스트 전용** 프록시이며
운영 이미지에 포함되지 않습니다. 브라우저 검증 스크립트는 `.coders-tools`에
Playwright를 별도 설치한 뒤 실행합니다.
SDK 브라우저 검증에는 `TEST_SDK_SOURCE`로 로컬 Core SDK 파일을 읽기 전용으로
제공합니다. Core SDK 구현 자체를 이 저장소에 복사하거나 배포하지 않습니다.
브라우저 컨테이너는 host 네트워크로 실행하고 `http://127.0.0.1:33080`을 사용합니다.

명시적 `POST /github/{owner}/{repo}/{commit}/_prepare`는
`core-v2.coders.kr`의 로그인·CSRF 문맥이 필요합니다. 외부 엔드포인트 호출과
`/_status` 조회는 문서의 `api.coders.kr` API 주소를 사용합니다.

전체 서버 테스트에는 원본의 Nest 테스트 모듈에 의존성 제공자가 없는 스캐폴딩
테스트 실패가 있습니다. Coders 변경과 직접 관련된 테스트와 실제 DB 통합 테스트를
별도로 확인하고, 전체 테스트가 모두 통과했다고 표시하지 않습니다.

## 라이선스

[NOTICE.coders.md](../NOTICE.coders.md)와 [LICENSE](../LICENSE)를 따릅니다.
변경한 서비스의 이용자가 실행 버전의 대응 소스와 빌드 자료를 무료로 받을 수 있게
제공해야 합니다. 서비스에 저장한 비공개 문서·첨부파일은 이 공개 소스에 포함하지 않습니다.

명세 기준: https://docs.coders.kr/guide.md (2026-10-28 확인).

Core 기본 정적 프론트 제한(256파일, 10MiB)에 맞추기 위해 Coders 빌드는
Excalidraw/Draw.io 편집과 Mermaid 미리보기를 제공하지 않습니다. 기존 노드의
저장 데이터는 유지하며 Mermaid는 코드로 표시합니다. 일반 Docmost 빌드는
이 제한을 적용하지 않습니다. `scripts/coders/check-community.cjs`가 배포 파일
수·크기와 Core 허용 HTTP 메서드를 검사합니다.
