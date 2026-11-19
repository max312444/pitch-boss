# PITCH BOSS (가칭)

2000/01 시즌부터 지금까지, 유럽 5대 리그의 시즌별 선수단으로 시작하는 **한국어 축구 감독 시뮬레이션**입니다.
비공식 팬 프로젝트이며, 실제 리그 · 구단 · 선수 및 어떤 게임사와도 관계가 없습니다 ([NOTICE.md](NOTICE.md)).

## 실행

```bash
cd game
npm install
npm run dev        # http://localhost:5173
npm test           # 단위 테스트 (vitest)
npx tsc --noEmit -p .   # 타입 검사
```

- 기본 데이터는 `data-public/`의 **가상 이름 데이터**입니다 (선수 · 구단 · 리그 이름을 바꾼 패러디 데이터).
- 진행은 브라우저에 자동 저장되며, 슬롯 3개에 직접 저장할 수도 있습니다. 사이드바 '파일로 내보내기'로 `.pitchboss` 파일을 받아 두고 첫 화면에서 불러올 수 있습니다.
- **웹에서 바로 하기**: https://max312444.github.io/pitch-boss/ (GitHub Pages · 패러디 데이터만, 사진 기능 없음)

### 배포 (GitHub Pages)

- `master` 에 푸시하면 `.github/workflows/deploy.yml` 이 자동 빌드 · 배포합니다 (저장소 Settings → Pages → Source: **GitHub Actions**).
- 배포 빌드는 `PUBLIC_ONLY=1` 로 실명 데이터(`data/`) 대신 빈 폴더 `game/empty-data` 를 씁니다. `BASE=/pitch-boss/` 는 주소 경로.
- 로컬에서 배포판 확인: PowerShell 에서 `$env:PUBLIC_ONLY='1'; $env:BASE='/pitch-boss/'; npm run build; npx vite preview`
  (Git Bash 는 `/pitch-boss/` 를 Windows 경로로 바꿔 버리므로 `MSYS_NO_PATHCONV=1` 을 붙일 것).

## 주요 기능

**커리어 · 시즌**
- 원하는 시즌 · 리그 · 구단으로 시작, 다음 시즌으로 이어지는 커리어 (실제 능력치 갱신 · 새 선수 등장 · 데이터가 끝난 뒤 성장/노화 엔진)
- **1부 · 2부 승강제**: 나라 · 시대별 실제 규칙 (자동 승강 · 승격 플레이오프 · 승강 플레이오프 · 승부차기). 게임 순위대로 승강하며 내 구단도 강등될 수 있음
- 시즌 수상 (우승 · 득점왕 · 도움왕 · MVP · 영플레이어 · 골든글러브)과 수상 연출, 보상 (팬 · 상금 · 일시 능력치 상승)
- 시즌 말 소식: 계약 만료로 팀을 떠난 핵심 선수 → 은퇴 선수 → 시즌 결산

**경기**
- 5분 단위 경기 엔진: 경기 중 전술 변경 · 교체, 컨디션과 경기 기복
- 경기 전 스쿼드 설정 (상대에 맞춘 AI 추천에서 시작), 경기별 POM · 워스트

**선수 · 구단 관리**
- 이적: 선수 검색 · 관심 목록 · 영입 협상 창 (이적료 · 주급 각 3번, 결렬 시 이적시장 동안 협상 불가), FA는 주급만 협상
- 받은 제안에 역제안 협상, 이적 명단 선수 판매
- 계약: 불만 없는 선수는 자동 재계약, 불만 있는 선수는 재계약 요청 팝업 → 직접 협상, 안 하면 FA로 떠남
- 재정 (중계권 · 입장 · 스폰서 · 상금 / 주급 · 운영비, 이사회 예산), 팬 수
- 호칭 (경기 기록으로 붙고 노쇠 · 스타일 변화로 사라짐), 충성도, 숨은 속성, 언론 평가
- 선수 상세 정보 (능력치 · 호칭 · 수상 경력 · 이전 구단 경력), 상단 전체 검색 (`/` 또는 Ctrl+K)

## 실명 데이터로 플레이하기 (선택, 각자 생성)

저장소에는 실명 데이터가 없습니다. 원하면 공개 출처(Wikidata · 위키백과)에서 **직접 만들 수 있습니다.**
만든 데이터는 내 PC의 `data/`에만 저장되고 저장소에는 올라가지 않습니다 (`.gitignore`).

```bash
# 리그별 구축 (리그당 약 1시간, 위키미디어 API 요청 간격을 지킵니다). --apply 없으면 미리보기
node tools/data_pipeline build --league eng1 --apply     # 1부: eng1 esp1 ita1 ger1 fra1
node tools/data_pipeline build --league eng2 --apply     # 2부: eng2 esp2 ita2 ger2 fra2

# 한국어 이름 (Wikidata 한국어 표기)
node tools/data_pipeline names --league eng1 --apply

# 검사
node tools/validate.js
```

실명 데이터가 있으면 새 게임 화면의 **"이름 데이터 → 실명 (내 PC)"**로 바꿀 수 있습니다.

> 실명 데이터는 개인적 · 비상업적 용도로만 사용하세요. 다른 곳에 배포하지 마세요.

### 공개용 데이터 다시 만들기 (관리자용)

```bash
node tools/data_pipeline publish --apply   # data/ (실명) → data-public/ (패러디)
cd game && npm run history                 # 선수 이력 (data-public/history/players.json)
```

## 구성

| 경로 | 내용 |
|---|---|
| `game/` | 게임 (React 19 + TypeScript + Vite 6 + Tailwind 4 + Zustand 5). 엔진은 `game/src/engine/` |
| `tools/data_pipeline/` | 데이터 수집 · 검증 · 공개용 변환 파이프라인 (Node.js) |
| `data-public/` | 공개용 패러디 데이터 (CC BY-SA 4.0) |
| `data/` | 파이프라인 설정 (리그 · 국가 · 구단 별칭). 실명 데이터는 여기에 생성되며 저장소에서 제외 |
| `docs/` | 엔진 설계 문서 |

### 엔진 파일 (`game/src/engine/`)

| 파일 | 역할 |
|---|---|
| `world.ts` | 월드 생성 · 하루 진행 (`advanceDay`) · 경기 결과 적용 |
| `season.ts` | 시즌 마감 (`closeSeason`) · 다음 시즌 (`startNextSeason`: 승강 · 은퇴 · 계약 만료 · 새 선수) |
| `pyramid.ts` | 1부 · 2부 승강 규칙 (`pairRule`), 플레이오프 진행 (`playoffDay`), 순위 구간 |
| `match.ts` | 경기 엔진 (POM · 워스트 포함) |
| `transfer.ts` | 몸값 · 이적시장 기간 · 영입 판단 · 협상 횟수 · AI 이적 · 받은 제안 · 역제안 |
| `contract.ts` | 재계약 판단 · 자동 재계약 · 재계약 요청 |
| `finance.ts` | 수입 · 지출 장부, 이사회 예산 |
| `awards.ts` | 시즌 수상 · 팬 수 |
| `traits.ts` | 호칭 |
| `loyalty.ts` · `condition.ts` · `ratings.ts` · `squad.ts` · `ai.ts` · `analysis.ts` | 충성도 · 컨디션 · 능력치 · 선발 · AI 선발 · 구단 분석 |

화면은 `game/src/ui/` (screens · views · components), 상태는 `game/src/store/` (`game.ts` 게임 진행, `app.ts` 화면 전환).

## 라이선스

- 코드: MIT ([LICENSE](LICENSE))
- 데이터: CC BY-SA 4.0 · 출처 Wikidata (CC0), English Wikipedia (CC BY-SA 4.0) ([data/LICENSE.md](data/LICENSE.md))
- 이름 · 상표에 대한 권리는 부여하지 않습니다 ([NOTICE.md](NOTICE.md))

---

## 개발 현황 · 이어서 하기

> 새 작업 세션은 이 절을 먼저 읽고 이어서 진행한다. **지금 하던 일은 아래 "▶ 새 세션은 여기부터"** (마지막 갱신: 2026-11-19)

### 작업 규칙

- 설명 · 보고는 **한국어**로 한다. 변경할 때마다 **테스트 후 결과를 보고**한다 (타입 검사 · `npm test` · 필요하면 브라우저).
- 테스트 · 시연 기본 구단은 **리버풀** (공개 데이터 이름 "리버폴", ID `c83d96l`).
- 커밋 · 푸시는 **요청이 있을 때만**. **실명 데이터(`data/seasons` 등)는 절대 커밋하지 않는다.** 실제 로고는 쓰지 않는다.
- 데이터 원칙: 공개 출처(Wikidata · 위키백과 API)만, 웹 스크래핑을 기본 수집 방식으로 쓰지 않음, FM 등 상용 게임 DB 복제 금지,
  출처 없는 능력치를 사실처럼 저장하지 않음 (능력치 · 재정 · 명성은 자체 추정 모델 `derived`), 이름 유사도만으로 자동 병합 금지,
  유료 API · 유료 리소스는 사용자 승인 없이 사용 금지, API 키는 환경 변수로만 (`.env` 커밋 금지).
- 데이터 작성 규칙: [data/DATA_GUIDE.md](data/DATA_GUIDE.md)
- 테스트: 작업 중에는 **바뀐 부분만** 테스트하고, **전체 테스트(`npm test`)는 커밋 직전에만**. 화면이 바뀌면 **PC · 휴대폰 · 태블릿** 세 가지로 확인.
- 버전: 큰 변화(새 모드) = 앞자리 (v1 → v2), 기능 추가 +0.1, 수정 +0.0.1. `game/src/version.ts` (GAME_VERSION + CHANGELOG 한 줄) · `game/package.json` · 아래 완료 목록 맨 위 `0. **vX …**`.
- 커밋 메시지는 `vX 요약` 형식, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 커밋 대상은 코드 · `data-public` · `data/canonical/club-aliases.json` · `club-same.json` · `club-reserves.json` · `club-era.json` 만.
- 게임 · 문서에 "월드컵" · "FIFA" 같은 실제 대회 · 단체 이름을 쓰지 않는다 (세계 대회). 테스트 코드에도 실제 구단 이름을 쓰지 않는다 (공개 ID 사용). 사진은 올리지 않는다.
- 모든 구단 (AI 포함) 은 수입을 벌고 예산 안에서만 영입한다. 부자 구단은 더 많이 가지고 시작한다.

### 개발 팁

- 개발 모드에서 브라우저 콘솔 `window.__game` 으로 게임 상태(Zustand 스토어)에 접근할 수 있다 (배포 빌드에는 없음).
- 브라우저 확인은 Playwright(`playwright-core` + 설치된 Chrome)로 스크린샷을 찍어 확인해 왔다.
- 엔진 테스트는 `data-public/`을 직접 읽어 월드를 만든다 (`*.test.ts` 참고).
- `publish --apply` 로 `data-public/`을 다시 만들면 켜 둔 개발 서버가 빈 파일 목록을 기억해 화면이 안 뜰 수 있다 → 개발 서버를 껐다 켤 것
- Windows: Git Bash 의 `/c/...` 처럼 소문자 `c:` 경로에서 켜면 data 경로가 `../../c:/...` 로 깨져 메모리 부족(heap out of memory)으로 꺼지던 문제 → vite.config 가 드라이브 문자를 대문자로 맞춰 어디서 켜도 됨 (2026-11-12, Git Bash 로 켜서 게임 진행 · 메모리 246MB 확인). vite.config 는 `data/_pipeline` (캐시 · 백업) 을 감시하지 않는다
  (Windows에서 `npm run dev` 를 멈춰도 vite 프로세스가 5173 포트에 남을 수 있음 — 포트를 쓰는 프로세스를 끈다).

### ▶ 새 세션은 여기부터: 지금 하던 일 (2026-11-19 기준)

**현재 버전 v2.12.2** (은퇴 선수 보관으로 세이브 약 20% ↓, 2026-11-19) — 커밋 · 푸시 완료 (실명 데이터는 원래 커밋 안 함).
2부 리그 5개 수집 · publish · 게임 확인까지 끝 (2026-11-19). 다음 할 일은 아래 로드맵.

| 리그 | 상태 (실명 데이터는 로컬 `data/` 에만, 커밋 안 함) |
|---|---|
| ger2 | 완료 (2026-11-10) |
| eng2 | **완료** — build · names · dedupe · fix-league · unify-names · validate 오류 0 (26시즌 × 24팀) |
| esp2 | **완료** (2026-11-19) — 26시즌 × 22팀, validate 오류 0 |
| ita2 | **완료** (2026-11-19) — 551 구단 시즌 (실제 구단 수와 일치: 03-04 24팀 · 18-19 19팀), validate 오류 0. Pordenone (Q257078) · Ternana (Q8623) 는 한 항목인데 영어 문서 제목만 재창단 이름 → 별칭 `pordenone` · `ternana`. Vicenza 2001~17 이 LR Vicenza 로 잡히던 것 (14-15 · 16-17 은 두 번 들어가 23팀) · A.C. Ancona 0명은 `club-era.json` 으로 바로잡음. 남은 16명 미만 8개 (mantova 24-25 · ternana 17-18 · virtus-entella 25-26 등, 출처 한계 → 유스로 채움) |
| fra2 | **완료** (2026-11-19) — 26시즌 (2024-25~ 18팀은 실제), CA Bastia → `ca-bastia` 분리, 2025-26 최소 12명 (2월 판 · Wikidata 보충), validate 오류 0 |

리그마다 순서 (미리보기 결과에서 **시즌별 구단 수 · 16명 미만 선수단 · 구단 충돌 · "이름으로 연결한 구단 (확인 필요)"** 을 꼭 볼 것):
```bash
node tools/data_pipeline build --league esp2            # 미리보기 (1시간 안팎, 캐시가 있으면 빠름)
node tools/data_pipeline build --league esp2 --apply    # 저장 (이미 있는 파일을 다시 쓰려면 --overwrite)
node tools/data_pipeline names --league esp2 --apply    # 한국어 이름
node tools/data_pipeline dedupe --apply                 # 같은 시즌 중복 소속 정리
node tools/data_pipeline fix-league --league esp2 --apply   # 동명이인 (나이 15 미만 · 45 초과) 삭제 · 생년월일을 기존 리그 기록에 맞춤
node tools/data_pipeline unify-names --apply            # 같은 선수 이름 표기 통일 (최근 시즌 표기)
node tools/validate.js                                  # 오류 0 이어야 함 (GK 없음은 경고 — 게임이 유스로 채움)
```
남은 fra2 까지 끝나면:
```bash
node tools/data_pipeline publish --apply   # data-public (가상 이름) 다시 만들기 → 개발 서버 껐다 켜기
cd game && npm run history                 # 역대 기록 (감독 기록의 cesena → cesena-1 도 여기서 바뀜)
```
그다음 **게임에서 확인** (PC · 휴대폰 · 태블릿, Playwright):
2부 구단으로 새 게임 → 시즌 진행 → 승격 플레이오프 · 승강 · **B팀 규칙** (모구단이 1부면 승격 · PO 제외, 순위표 색) ·
**홀수 리그 일정** (ita2 2018-19 는 실제 19팀) · 44팀 컵 · **역제안 이적 건수** (한 시즌 20건 안팎이면 적당, 너무 많으면 `appeal.ts` 25% 를 줄임) ·
`npm run invariants` · `npm run economy`. 문제 없으면 버전 올리고 (데이터 추가 = +0.1) README · 커밋 (data-public · 코드만).

**2부 수집 중 정한 것 · 알아 둘 것**
- **구단 합치기 규칙 (사용자 결정)**: Wikidata 항목 두 개가 같은 구단처럼 보여도 기록이 완전히 같을 때만 합친다. 다르면 `-1` · `-2` (또는 따로 ID) 로
  `data/canonical/club-aliases.json` 에 **Wikidata 번호로** 지정하고 사용자에게 알린다. 이미 쓰던 ID 를 바꿀 때는
  `node tools/data_pipeline rename-club <옛 ID> <새 ID> --apply` + `data/canonical/public-map.json` 키도 옮겨 공개 ID 유지 (cesena 때처럼).
  - 나눈 구단: ssv-ulm-1/-2 · vicenza-1/-2 · ancona-1 · extremadura-1/-2 · cesena-1/-2 · cosenza-1/-2 · granada-74 · universidad-las-palmas ·
    B팀 7개 (barcelona-atletic · real-madrid-castilla · athletic-bilbao-b · real-sociedad-b · sevilla-atletico · villarreal-b · atletico-malagueno)
- **B팀**: `data/canonical/club-reserves.json` (B팀 → 모구단). build 가 새 구단 정보에 `parent` 를 넣고 publish 가 공개 ID 로 바꾼다.
  esp2 저장 뒤 `data/clubs/<B팀>.json` 에 `parent` 가 들어갔는지 확인 (없으면 넣기). 다른 리그에서 B팀 · II팀이 나오면 여기에 추가.
- 16명 미만 선수단: eng2 2000~2007년 하위권 40곳 (그 시대는 위키백과 선수단 표를 안 쓰고 Wikidata 소속 기록만 — 데이터 한계).
  게임은 시작할 때 포지션 최소 인원을 유스로 채우므로 (`academyFill`) 그대로 둔다.
- v2.11 에 고친 파이프라인: `fix-league` 가 맞출 생년월일 기준으로도 나이를 봄 (동명이인이 생년월일만 바뀌어 남던 문제), `rename-club` 이 `_league.json` standings 도 바꿈 (cesena 때 ita1 3시즌 standings 가 옛 ID 로 남아 있었음 → 로컬 데이터 고침).
  `unify-names` 는 여전히 일부 파일을 "줄 형식이 달라 건너뜀" (2013-14 real-sociedad · 2016-17 villarreal) → validate 가 이름 불일치를 잡으면 손으로 맞춘다 (최근 · 다수 표기).
- 이번에 고친 파이프라인 (v2.10): 잘린 응답 → 종료 연도 구간으로 나눠 받기 (`wikidata.js clubMemberships`), 선수단 틀 `fs player2 (sort)` ·
  `first/last/dab` · `{{sortname}}`, 시즌 순위표가 별도 틀이면 따라가기, 위키백과 명단 나이 필터, 이름으로 추측 연결한 구단 표시,
  `unify.js` 여러 줄 형식, `fix-league` 명령.

### 다음 로드맵 (2부 데이터 다음)

1. 사진 · 실제 이름 넣는 방법 안내 문서 (사용자 요청). 화면에 사진 출처 표시는 하지 않음
2. ~~세이브 크기~~ (v2.11.1 은퇴 선수 보관으로 약 20% ↓). 더 줄이려면: 현역 선수 경력 (0경기 시즌도 연속 시즌 판정에 씀) · 숨은 속성
3. 나중 후보: 대륙 대회 (유로 · 코파), 유럽 대회 36팀 리그 페이즈, 재판매 · 보너스 조항 보강

### 남은 과제 · 알려진 문제

- 데이터에 계약 정보는 약 19%만 있음 → 나머지는 게임이 1~5년 부여 (`contractGen`, 화면에 "게임 설정" 표시).
- 로컬에서 실명 데이터까지 넣은 `npm run build` 는 메모리 부족 — 배포는 `PUBLIC_ONLY=1` 이라 무관.
- 점검 스크립트: `npm run fairness` (경기 형평성) · `npm run economy` (FA · 잔고) · `npm run invariants` (여러 시즌 불변 조건).
  화면 점검: `node game/scripts/screens.mjs [출력 폴더]` (개발 서버 켠 상태, `DEVICES=phone,tablet` 로 기기 고르기) — 7기기 (휴대폰 · 휴대폰 가로 · 태블릿 세로/가로 · PC) × 제목 · 새 게임 3모드 · 허브 10탭 · 서랍 · 선수 · 구단 · 경기 준비 · 경기.
  콘솔 오류 · 가로 넘침 · 화면 밖 요소 · 스크롤해도 가려지는 버튼 · 스크롤해도 닿지 않는 버튼 · 터치 24px 미만 버튼을 찾고 스크린샷을 남긴다 (서랍 메뉴 뒤 버튼 '가려짐'은 정상).
  그 밖의 Playwright 점검도
  (패턴: `tools/node_modules/playwright-core` + 설치된 Chrome, `localStorage` 에 intro · notice · tutorial · update · dataset=public 넣고,
  `import('/src/store/game.ts')` 로 `useGame.getState().newGame('2025-26', 'eng1', 'c83d96l')`).

### 완료된 작업 (최근 순)

> 버전: `game/src/version.ts` (첫 화면 표시). 기능 추가 +0.1 · 작은 수정 +0.0.1, 바꿀 때마다 여기에 적는다.
> 같은 파일의 `CHANGELOG` 맨 위에 플레이어용 한 줄 요약도 넣는다 → 첫 화면 '업데이트 소식' (새 버전을 처음 본 뒤 24시간 표시, `UpdateNotes.tsx`).

0. **v2.12.2 이적 조건 역제안 금액 · 어필 주급** (2026-11-19) — evaluateBid 가 셀온 · 보너스 값어치를 판단에만 더하고 역제안 ask 는 조건 없는 값이라 금액이 안 내려가 보였음 → `cashNeeded` (조건을 건 채 필요한 현금, 보너스 ≤ 이적료 절반 유지) 를 ask 로. 어필 메시지는 InboxView 가 열 때마다 wageDemand 를 다시 계산해 기한 뒤 127K → 127K → 이벤트에 wage · cut 저장. 테스트 addons · appeal.
0. **v2.12.1 포지션별 능력 범위 순서** (2026-11-19) — 다른 구단 선수 포지션 표가 `seenRange(..., 'pos:' + 자리)` 로 자리마다 흔들림이 달라 보조 포지션(LW 75–85)이 주 포지션(ST 69–79)보다 높게 보이던 문제. 모든 자리를 `'ovr'` 흔들림으로 통일 (Scout.tsx) → 주 포지션 범위 = 맨 위 능력 범위, 다른 자리는 절대 위로 안 보임. 엔진 값 (`ratingAt` 상한) 은 원래 맞았음. 테스트 posOrder.test.ts (2005-06 · 2025-26 전체 선수 × 13자리 × 스카우트 0~100%).
0. **v2.12 2부 리그 5개 · 데이터 끝난 뒤 승강 · 아래 리그 대기열** (2026-11-19) — esp2 · ita2 · fra2 수집 (eng2 · ger2 와 함께 5개, validate 오류 0), publish · history. 아래 리그 대기열: `SeasonInput.pools` (store `loadSeasonInput` 이 직전 시즌 2부에 있다가 이번 시즌 1부 · 2부에 없는 구단을 `poolOf(2부)` 로, 이번 시즌 데이터에 있는 선수는 뺌) → createWorld 가 경기 안 하는 구단으로 만듦 (컵 · 유럽 · 아카데미 채우기 제외). 최근 시즌으로 시작해도 데이터 끝난 첫 전환에서 2부 크기 유지 (확인: 2025-26 → 2026-27 eng2 24 · esp2 22 · ita2 20 · fra2 18 · ger2 18, 1부 2~3팀씩 승강, 플레이오프 21경기, B팀 규칙 위반 0, AI 역제안 이적 시즌 ~10건). invariants · savesize 스크립트도 같은 대기열. 파이프라인: build 가 시즌 초 판에 링크가 16명 미만이면 2월 판도 보고, 8명 이상이면 쓰고 Wikidata 로 보충 (fra2 2025-26 0명 → 최소 12명), publish `club-public-seed.json` (공개 데이터가 나간 뒤 ID 를 바꾼 구단은 옛 ID 로 공개 ID · 가상 이름 — cesena-1 → c16lcttc 유지. 예전 "public-map 키 옮기기" 는 효과가 없었음: 공개 ID 는 실제 ID 해시). 화면: TableView · NewGameScreen 리그 탭 PC 에서 줄바꿈, SquadView 필터 줄, screens.mjs 에 '잘린 줄' (PC 가로로 넘쳐 숨은 버튼 줄) 점검.
0. **v2.11.2 첫 화면 의견 보내기 하나로** (2026-11-19) — TitleScreen 아래 「의견 보내기 · 버그 제보」 버튼 삭제 (메뉴 08 「의견 보내기」 와 같은 FeedbackDialog). 문의는 이 의견 보내기 (구글 설문) 로 이미 연결됨.
0. **v2.11.1 은퇴 선수 보관 (세이브 크기)** (2026-11-19) — `engine/archive.ts`: `retiredOn` (은퇴 시즌, season.ts retire · transfer.ts FA 정리) 이 지금 시즌보다 앞이고 intlOnly 가 아니면 `packWorld` (writeSave · 파일 내보내기) 가 능력치 · 숨은 속성 · 성장 · 시즌 기록 · 컨디션 · 계약 등을 빼고 `archived: true` 로 저장 (경력은 뛴 시즌만, 평점 뺌). 원본 월드는 그대로. 불러올 때 `migrate` → `unpackPlayer` 가 기본값으로 채움. 예전 세이브는 경력이 있는 은퇴 선수 (generated · intlOnly 제외) 에 `retiredOn '0000-00'` → 다음 저장부터. `npm run savesize -- [시즌] [시작 연도] [덤프 파일]` (항목별 크기): 공개 데이터 8시즌 9.68MB → 7.79MB (gzip 1.34 → 1.10), 은퇴 선수 2,003명 보관. 테스트 `archive.test.ts` · 브라우저 저장/불러오기 확인.
0. **v2.11 호칭 8개 추가 · 기기별 화면 점검** (2026-11-19) — `traits.ts`: 골잡이 (poacher, 경기당 0.5골↑ 12골↑) · 원더키드 (wonderkid, 21세↓ 15경기 평점 7.0↑, `maxAge` 23 넘으면 시즌 말 졸업) · 페널티 장인 (spotkick, PK 골 4↑, `pen` +0.06 → `match.ts` 성공률 상한 0.95) · 세트피스 달인 (setpiece, 세트피스 골+도움 5↑, `set` ×1.12 키커 정확도) · 슈퍼 서브 (supersub, 교체 골 3↑, bench 0.5) · 철인 (ironman, 선발 32↑ 부상 0, injury 0.8) · 노장의 품격 (elder, 33세↑ 20경기 평점 6.9↑) · 실수 제조기 (blunder, 실점 실책 3↑). `TraitLog` subG · pen · set · err (`world.ts` 경기 뒤 기록, 예전 세이브는 없으면 0). excludes 는 양쪽에 적음 (테스트). 화면: `game/scripts/screens.mjs` (아래 남은 과제 참고) 7기기 × 19화면 — 팝업 15개 `max-h-[calc(100dvh-3rem)] overflow-y-auto` (낮은 화면에서 아래 선택지가 잘리던 문제), SquadView 낮은 화면 스크롤 (표 높이 0 이던 문제), MatchPrep 오른쪽 칸 스크롤 · 후보 칸 최소 높이, Sidebar 메인 메뉴 아이콘 `exit`, 태블릿 작은 버튼 `.tap`. 휴대폰 보기: `ui/components/fold.ts` (`useCompact` = 폭 768 미만 또는 높이 500 이하 · `useFold` localStorage `pitchboss.fold`), `Card` 에 `fold` (기억 키) · `shut` (처음 접힘) · `peek` (접혔을 때 요약) — 홈 · 구단 · 재정 · 전술 · 경기 준비 카드 30개 (휴대폰 스크롤 홈 3.4→1.7 · 구단 4.4→2.5 · 재정 3.0→1.8 · 전술/경기 준비 3.5→2.1 화면). PlayerPanel 휴대폰 탭 (능력치 · 호칭 성향 · 경력 평가, 위에 붙음). ScheduleView 열면 다음 경기 위로 자동 스크롤. 데이터 파이프라인: 미리보기에 16명 미만 선수단 목록, `data/canonical/club-era.json` (재창단 구단 시즌별 항목 바로잡기: `use` · `members`).
0. **v2.10 이적 어필 (역제안) · B팀 승격 규칙 · 2부 리그 수집 준비** (2026-11-18) — `appeal.ts`: `troubleOf` (충성도 55 미만 · 불만 · 벤치 4경기+ · 사가 · 사기 35 미만 · 계약 만료 임박) > 0 인 선수만 어필, 겨룰 주전 = 받는 구단의 같은 포지션 (보조 포지션 포함) 최고 선수, 능력 차 −3~+6 (빈 자리면 팀 전력 ±6), 명성 −5 (갈등 2 이상 −10) 까지. 우리 구단 대상 `appealDay` (이벤트에 `rival`, 받은편지함 `appealWhy`), 다른 구단 대상 `aiAppealDay` (이적시장 중 하루 25%, 날짜 시드 난수라 다른 시스템 난수 순서 그대로, 시세 80% 이적), 우리 선수가 연락하면 그 구단이 `offers` 에 `appeal: true` 제안 (85%, 역제안 95%까지) · 거절하면 충성도 −8 · 사기 −6 (`answerOffer`). B팀: `World.reserves` (B팀 → 모구단, 새 게임 · 불러오기 때 구단 정보 `parent` 로 채움), `pyramid.ts reserveBlocked` — 플레이오프 시드 · 자동 승격 · 승격 채우기에서 제외, 모구단이 2부로 오면 B팀은 대기 리그, `TableView` 승격권 색. 데이터: `data/canonical/club-reserves.json` (B팀 ID → 모구단 ID, build 가 구단 정보에 `parent`, publish 가 공개 ID 로). 파이프라인: `wikidata.js clubMemberships` 잘린 응답이면 종료 연도 구간으로 나눠 받음, `wikipedia.js` 선수단 틀 `fs player2 (sort)` · `first/last/dab` · `{{sortname}}`, 시즌 순위표가 별도 틀이면 항상 따라가 읽음, `build.js` 위키백과 명단도 15세 미만 · 45세 초과 제외 (동명이인 링크), 이름으로 추측 연결한 구단 (exact · suffix · prefix) 을 미리보기에 표시, `unify.js` 여러 줄 형식 파일도 이름 통일, `validate.js` GK 없음은 경고 (게임 시작 때 유스로 채움). 구단 나눔 (합치기 규칙): B팀 7개 · extremadura-1/-2 · cesena-1/-2 (cesena → cesena-1, 공개 ID 유지) · cosenza-1/-2 · granada-74 · universidad-las-palmas. 테스트 `appeal.test.ts` · `pyramid.test.ts` B팀.
0. **v2.9.5 터치 영역** (2026-11-18) — `styles.css` `.tap` (pointer: coarse 에서 ::after 로 위아래 11px · 좌우 6px 넓힘, absolute · fixed 버튼은 position 유지): SortTh · HomeView ActionLink · 전술 「현재 선발 고정」 「+ 만들기」 · NameEdit ✎ · 새 게임 · 세계 대회 「메인 메뉴」 · 「인트로 다시 보기」 · 스카우트 리그 관찰 · 구단 창 「순위 보기」.
0. **v2.9.4 전체 점검 · 임대 선수 방출 고침** (2026-11-18) — 점검 항목: 타입 · 테스트 229 · 공개 빌드 (`PUBLIC_ONLY=1`, 로컬 실명 포함 빌드는 메모리 부족 — 배포와 무관), 공개 데이터 실명 유출 0 (세계 대회 풀 24,160명 이름+생일 일치 0). `scripts/invariants.ts` (`npm run invariants -- [시즌] [시드] [시작 연도]`): 매주 두 구단 소속 · clubId 불일치 · 은퇴 선수 · 주급 · 계약 · 체력 · 사기 · 능력치 범위 · 16명 미만 · GK 없음 · 재정 NaN · 지난 경기 결과 · 순위표 (재정 규정 감점 허용) — 2023→2031 8시즌 × 시드 2. 찾은 것: `transfer.ts releasePlayer` 가 임대 선수를 무소속으로 만듦 → 원소속 복귀 (테스트). 승격팀 데이터 14~15명은 며칠 안에 채움. ger2 한 구단 재정 규정 감점 반복 (강등 뒤 매출 ↓ · 주급 그대로 — 현실적). 1부만 있는 리그 (eng1 등)는 데이터가 끝나면 강등 없음 (2부 데이터 필요). 세이브 원본 8시즌 12MB (gzip 저장). 그 밖: 경기 엔진 극단 상황 (체력 0 · 9명 · GK 없음 · 후보 없음) 2만 경기 문제 0, 모드별 3~4시즌 자동 진행 (store) 멈춤 · 예외 0, 투자 인수 조건 실패 → 해임 → 새 구단 확인, 사용자 행동 21가지 (영입 · 방출 · 재계약 · 저장/불러오기 · 하프타임 배치 · 교체) 예외 0, 6개 기기 × 35 화면 오류 · 가로 넘침 · 누를 수 없는 버튼 0 (휴대폰 글자 버튼 높이 18px 만).
0. **v2.9.3 태블릿 이적 표 구단 이름** (2026-11-18) — `TransfersView.tsx touchOnly()` (`(hover: none) and (pointer: coarse)`): 터치 화면은 구단 칸 버튼이 필터를 걸지 않고 줄 클릭 (선수 정보)으로 넘김. 휴대폰은 구단 칸이 없음 (lg 부터).
0. **v2.9.2 자유계약 선수 정리 · 받은편지함 이름** (2026-11-18) — `scripts/economy.ts` (`npm run economy -- [시즌 수] [시드]`): 6리그 여러 시즌 FA 수 (나이대 · 능력 70↑) · 선수단 크기 · 1부/2부 잔고. 점검: 33세↑ FA 가 시즌 내내 남고 (AI 이적시장 후보가 32세 이하), 이적시장 밖은 급할 때만 영입, FA 은퇴는 시즌 전환 때만. `transfer.ts`: 이적시장 후보 FA 는 35세까지 · FA 를 먼저 봄 (60%) · 31세↑ FA 1년 계약 (`faYears`), `aiFreeAgentDay` (시장 밖 하루 1.5%, 27명 미만, 수준 −7~+5 또는 잠재력 있는 21세↓), `faCleanup` (마감일: 33세↑ · 22세↑ 능력 62 미만 · 21세↓ 잠재력 65 미만 은퇴). 결과 (4시즌): 1월 FA 140→266→406 에서 16→63→118, 33세↑ 1월 FA 0, 능력 70↑ FA 1월까지 모두 팀 찾음. 잔고: 최상위 구단이 주급 예산의 60~85% 만 쓰고 매출의 30~40% 가 이익으로 남아 최대 1.1~1.5B → AI 이적 예산 €30M↑ 구단은 영입 시도 2배 · 보강 기준을 '그 포지션 주전 중 가장 약한 선수 +2' 까지 (`rich` · `floor`), `season.ts` 구단주 배당 매출 40% 초과분의 80% (예전 60% · 60%), `board.ts` 재정 점수 상한 0.45 × 0.4 (최대 점수 같음). 시즌 시작 잔고 1부 중간 70~78M · 최대 570~680M 에서 안정. 받은편지함 info 알림의 선수 이름은 `{p:선수ID}` → InboxView 에서 `playerKo` (traits · loyalty). 테스트 `freeAgents.test.ts`.
0. **v2.9.1 경기 형평성 점검 · 대승 꼬리 보정** (2026-11-17) — `scripts/fairness.ts` (`npm run fairness -- [시즌 수] [경기 수]`): 6리그 × 시즌 전체 전력 차 구간별 승/무/패 · 4·5·6골 차 비율 · 내 구단 경기 비교, 내 전술(매우 공격 · 매우 수비 등)별 1000경기. 결과: 승률 · 평균 득실은 현실적이었으나 전력 차 8↑ 경기에서 6골 차↑ 3%대 · 최대 11골 차. `match.ts` TUNING.easeLead 3 · easeMul 0.75 + `easeOf(lead)`: 3골 이상 앞선 쪽의 일반 공격 · 세트피스 · 페널티 · 실책 기회에 배율 (3골 0.75 · 4골 0.56 …). 보정 후 전체 4골 차↑ 6.4% · 5골↑ 1.5% · 6골↑ 0.2% · 최대 7 (실제 축구 약 6~7 / 2 / 0.6%), 승률 변화 없음. 내 구단 경기만 다르게 다루는 코드는 없음 (난이도 aiEdge 쉬움 1 · 보통 1.05 · 어려움 1.1 만).
0. **v2.9 무작위 구단 · 감독 이름** (2026-11-17) — `ui/components/randomIdentity.ts`: randomDesign (지어낸 지명 28개 × 꼬리말 · 앞말, 약칭 로마자 3글자, 경기장 이름, 직접 넣은 로고는 지움) · randomCrest (주색 · 보조색 밝기 차 0.3 이상) · randomManagerName (한국 성 30 × 이름 40). MyClubForm 「무작위 구단 (이름 · 엠블럼)」 · 「엠블럼만」, ManagerSetup 「무작위」.
0. **v2.8 나의 구단 인수 방식** (2026-11-17) — MyClubState.takeover (plain · invest) · goal {pos, from, by, level?, met?, failed?}. `myclub.ts` plainStart (대신한 구단 값 그대로) · investStart (잔고 · 이적 예산 = 리그 명성 상위 1/3 중간값, 주급 = 리그 중간 ×1.1, 매출 ×1.25, 명성 +3, 훈련 시설 +1) · investGoal (3시즌 안에 6위 이내, 18팀 미만이면 상위 1/3, 2부면 승격) · ownerGoalSeasonEnd (managerSeasonEnd 에서: 달성 → 관계 +15, 기한 실패 → sackAtEnd, 매 시즌 받은편지함). swapInput keepSquad (첫 시즌 선수단 그대로), setupMyClub 은 인수면 FA · 유스 없음 (setup false). managerNewSeason 은 조건 실패면 내 구단이어도 해임. 새 게임 `TakeoverPick` (모드 다음 인수 방식) · 오른쪽에 인수 재정 비교 · 조건, 홈 시즌 목표에 구단주 조건. 예전 세이브(takeover 없음)는 예전 방식 그대로. 테스트 `takeover.test.ts`.
0. **v2.7 자유 배치 · 경기 화면 정보** (2026-11-17) — `engine/placement.ts`: slotXY (전술 화면에서 옮김, 측면 선수 옆 가운데 줄은 34~66 으로 좁혀 겹침 방지) · `Placement {formation, pts}` (Tactics.xy · MatchDraft.xy · 경기 중 tactics.xy, 포메이션 이름이 다르면 무시) · `placeXY` · `moveFree` (놓은 위치 저장, zonePos 가 바뀌면 reshape → 순서대로 위치도) · `ZONES` (끄는 동안 Pitch 구역 표시). 스토어 reshapeTactics · reshapeDraft · liveReshape 는 (i, x, y), 포메이션 버튼은 xy 초기화, 전술 → 경기 준비 → 경기로 이어짐. 경기 화면: 점수판 아래 `ScorerList`, LivePitch 자리 능력 · 골(G) · 도움(A) 표시, 홈 경기 끝나면 `gateAmount` (finance.ts, gateIncome 에서 분리) 표시. 하프타임 되돌리기: LiveMatch.layout {base, hist} (LayoutSnap: 자리 순서 선수 · 지시 · 포메이션 · 자리 구성 · xy), 하프타임에 layoutBegin · 후반 시작에 layoutEnd, liveSwap · liveReshape · changeFormation 전에 기록, 교체하면 기록 속 선수도 바꿈, restoreLayout. 빈 자리(퇴장 등)는 LivePitch 에서 놓을 수 있는 자리 (data-slot) → liveToSlot (원래 자리가 빔, 되돌리기 기록). 고침: liveReshape 가 autoFormation 으로 ★ 내 배치 를 덮어쓴 뒤 slotOrder 를 읽어 선수가 빠지던 문제 → reshapeTeam(before), Placement.slots 로 모양이 바뀐 배치 무시. 테스트 `placement.test.ts`.
0. **v2.6 게임 깊이: 유스 아카데미 · 포지션 전환 훈련 · 내 선수 강등 조항** (2026-11-17) — `engine/academy.ts`: w.academy (내 구단, w.players 밖) · 시즌 시작 `academySeason` (19세 떠남 · 3명 + 유스 시설 4/5단계 +1, rollPotential · 15~17세 · 국적 70% 구단 나라 · 받은편지함 academy) · 매달 `academyMonth` (21세에 잠재력 닿는 속도 × 시설 × 프로의식) · `potentialRange` (18 − 시설×2 − 달×0.35) · `promote` (3년 유스 계약, 주급 능력 기준 60%, 최대 인원 · 재정 규정). season.ts 유스 입단에서 내 구단 제외 (아카데미로). 선수단 탭 「유스 아카데미」 `AcademyList`. `engine/retrain.ts`: p.retrain {pos, progress} · retrainSaved · learned (altPositions 에 추가) · 매달 진행 (친숙도 0.8↑ 34% · 0.7↑ 22% · 그 밖 13% × 나이 × 프로의식 × 훈련 시설), 훈련 중 친숙도 진행도만큼 · 일반 성장 ×0.7 · 최대 3명 · 받은편지함 retrain, 선수 정보 `RetrainBox`. 강등 조항: `clauses.ts relClauseAllowed · relegationRisk · relOptions (×1 · ×1.5) · relWageFactor (0.95 · 0.97) · relJoinBonus (+0.6 · 위험 구단 무조항 −0.4)`, playerWillJoin · evaluateRenewal · sign · renew 에 rel, 내 선수는 무작위 강등 조항 없음, 발동 시 받은편지함. 영입 · 재계약 창 `RelSelect`. 테스트 `depth.test.ts`.
0. **v2.5 의견 보내기 (구글 설문)** (2026-11-17) — `data/feedback.ts`: 개발자 구글 설문 (질문: 종류 entry.1180164544 · 내용 entry.1103273511) 미리 채운 주소. 종류는 설문 선택지 문구 그대로 (버그 · 개선 의견 · 문의, 기타는 비움), 내용 칸 아래에 게임 정보 (버전 · 기기 종류/OS/브라우저/화면 크기 · 모드 · 시즌 · 날짜 · 구단 · 데이터 종류, 개인 정보 없음). `FeedbackDialog` (종류 4개 → 새 탭, 보내질 정보 미리 보기), 첫 화면 메뉴 08 · 첫 화면 아래 버튼 · 게임 메뉴(Sidebar) 「의견 보내기」. 설문에 질문을 더 넣으면 (연락처 등) `ENTRY` 에 번호 추가.
0. **v2.4.3 전체 UI 점검 · 겹침 · 잘림 고침** (2026-11-17) — Playwright 점검 (휴대폰 390 · 작은폰 360 · 태블릿 세로 820 · 아이패드 미니 768 · 태블릿 가로 1180 · PC 1440 × 화면 35개: 가로 넘침 · 누를 수 없는 버튼 (화면 밖 · 가려짐, 열린 창 안만) · 작은 버튼). 고친 것: `slotXY` 같은 세로줄 (가로 12 미만) 선수 사이 최소 15 · 휴대폰 피치 68/100 · 선수 표시 너비 min(6rem, 22%) (작은폰 수비 라인 겹침), PlayerPanel 위 정보 + 능력치 한 스크롤 (버튼 아래 고정), 이적시장 검색 조건 접기 · 주급 · 계약 칸 xl 부터, 창 닫기 버튼 h-9, 재정 · 구단 · 홈 휴대폰 여백.
0. **v2.4.2 휴대폰 업데이트 소식 바** (2026-11-17) — `UpdateNotes.tsx UpdateBar`: 휴대폰(sm 미만) 첫 화면 위쪽 한 줄 바 (버전 · 새 소식 개수 · 보기 · ✕), 누르면 아래에서 올라오는 내역 창 (createPortal 로 body 에, 머리글 애니메이션 transform 영향 없음). PC · 태블릿은 오른쪽 카드 그대로. 메뉴 안에 펼쳐 두던 휴대폰 내역 (UpdateNotesSlot) 제거.
0. **v2.4.1 고지 새로 · 인트로 뒤 바로** (2026-11-17) — `NoticeDialog` 키 v3 (내용이 바뀌어 한 번 다시): 가상 세계 대회 · 체형 · Wikidata 참고 · 가상 엠블럼 · 실명 데이터와 사진은 사용자가 직접 업로드 (브라우저에만 저장, 전송 없음) · 브라우저 저장과 파일 내보내기. TitleScreen: 인트로를 닫으면 바로 고지, 고지 중에는 업데이트 소식 숨김. 휴대폰에서 고지 창 스크롤.
0. **v2.4 몸무게 · 패러디 세이브 실명 전환** (2026-11-17) — 파이프라인 `weights [--apply] [--refresh]`: Wikidata 몸무게 (P2067, kg 정규화, 시점이 여럿이면 최근 값, 45 ~ 115kg) → `data/meta/player-weights.json` (실명 번호라 gitignore) · 시즌 파일 `weight` (키와 BMI 18.5 ~ 28.5 밖이면 버림). Wikidata 항목 18,866명 중 9,560명 (51%), 시즌 칸 64%. publish 가 공개 데이터에도 복사. 게임 `body.ts bmiOf`: 몸무게가 있으면 BMI 로 무겁다/가볍다, 없으면 몸싸움. 세이브 실명 전환 `engine/convertReal.ts`: 실명 데이터의 `canonical/public-map.json` (실명 번호 → 공개 번호)을 거꾸로 세이브 JSON 의 공개 번호 (p… · c…)를 실명 번호로, 그 시즌 실명 시즌 파일로 영문 이름 · 생일 · 키 · 몸무게 · 주발. 불러오기 목록 「실명 전환」 → `pitchboss.convert` + 실명 데이터로 새로 고침 → `load()` 에서 바꿔 같은 슬롯에 저장. 브라우저 실명 데이터 넣기도 public-map 포함 (예전에 넣었으면 다시 넣어야 전환 가능). 테스트 `convertReal.test.ts` (실명 데이터가 있는 PC 에서만).
0. **v2.3 정렬 · 주요 능력치 · 이적 허용 표시 · 키/체형 · 피지컬 대결** (2026-11-17) — 공용 `ui/components/SortTh.tsx` (SortTh · SortPicker · TopAttrs · seenAttr): 이적시장 · 선수단 · 구단 창 정렬 (능력치 `a_<key>` · 키 포함, 스카우트 범위 가운데 값). `engine/market.ts saleTag`: free · bargain · request (불만 · 이적 요청 · 6경기 결장) · expiring (이번 시즌 끝) · surplus (선수단 능력 21위 이하 · 21세 이상, 26명 넘으면 더) · listed. 목록은 기본 전체 + 이적 허용 표시, 시장에 나온 선수는 `askingPrice` ×0.85 (시즌 시작 eng1 AI 선수의 22%). `engine/body.ts`: 키 (데이터 `height` → PlayerState, 없으면 포지션 · 공중볼 · 몸싸움으로 추정), 체형 7가지 (키 + str · pac), 시즌 전환에 바뀌면 `bodyChange`. 경기 `match.ts`: 공중 경합 · 세트피스 득점자에 키 배율 (183cm 기준 ±0.6%/cm), 근육질 체력 소모 ×1.05, `duels()` 구간마다 공격수 vs 수비 (속도 · 몸싸움 · 공중볼 · 빌드업) → 실책 확률 0.02 × 차이 × 침착성/위치 선정 · 체력 → xG 0.3 기회, `summary.errors` · 평점 −0.3 / 실점 −0.7 · 중계. baseXg 0.068 → 0.0612 (골/경기 2.85 → 2.90, 실책 0.6 · 실책골 0.2). 테스트 `body.test.ts` · `market.test.ts`.
0. **v2.2 이용자 의견 반영 (선수단 전체 · 윙어 측면 · 후보 빼기 · 정렬 · 느리게)** (2026-11-17) — 새 게임 구단 고르기: 핵심 선수 6명 → 선수단 전체 (GK/DF/MF/FW 묶음, 나이 · 오버롤), 오른쪽 패널 `lg:overflow-y-auto` 로 태블릿에서도 시작 버튼까지. `ratings.ts WIDE_PAIR`: LM↔LW · RM↔RW 는 짝 포지션 원값 -1 까지 인정 (NEAR 0.97). 후보 ✕: `lineup.benchExact` (직접 고친 후보 명단은 `pickLineup` 이 자동으로 채우지 않음, MatchDraft 도 같음). 선수 바꾸기 목록 `bySlotFit` (그 자리 포지션 → 같은 라인 → 나머지, 각 묶음 안은 그 자리 능력 순). 경기 속도 `느리게` (2200ms, 설정값 3 — 예전 값 0 · 1 · 2 유지). 이적시장 표 머리 `SortTh` 정렬 (다시 누르면 반대), 휴대폰은 고르기 + 높은/낮은 순. 테스트 `feedback.test.ts`.
0. **v2.1.2 대표팀 엠블럼 색 · 세계 대회 이름 · 대표 선수 고침** (2026-11-16) — 모든 「월드컵」 표기를 「세계 대회」로 (리그 목록 wc 이름 · 출처 표기 포함, 예선 경기 이름은 `isQualiName` 이 예전 이름도 인식). 세계 대회 모드 세이브 불러오기 (userClubId nt- 허용) · 불러올 때 `repairIntl` (실제 명단 · 대표 풀로 소집 후보 다시, 가상 선수 빼고 채움) · 가상 이름 `pickName` (나라 안 겹침 없음) · 대표 전용 선수가 실제 데이터에 나오면 시즌 전환 `미래 선수 등장` 에서 같은 번호 실제 선수로. 새 게임 화면: 명단 데이터가 없으면 안내. 대표팀 경기 (stage intl) 이변: `match.ts INTL_RATIO_K` 0.45 (능력 비 · 점유율 민감도) + 그날 팀 컨디션 ±15% (xG 배율), 예선 빠른 계산도 같은 생각 (÷16 · 컨디션). 측정 (300경기): 강팀 62 ~ 71% · 무 17 ~ 22% · 약팀 12 ~ 16% (이전 약팀 0 ~ 3%). 실제 데이터 없는 시즌은 지난 실제 국내파를 이어감. 파이프라인 `natcolors --apply`: Wikidata 대표팀 공식 색 (P6364) → 없으면 국기 색 (P163 → P462 → P465), 원색은 차분하게 다듬어 두 색 → `data/meta/nation-colors.json` (사실 정보, publish 가 공개 데이터에 복사). 엠블럼은 손으로 정한 유니폼 색 → 이 색 → 약자로 정한 색 순.
0. **v2.1.1 모드 고르기 창 색 · 아이콘** (2026-11-16) — `ModePicker` TONE: 모드별 위 띠 · 아이콘 칸 · 부제 · 버튼 색 (기본 neon · 나의 구단 sky · 세계 대회 amber). 대표팀 엠블럼 `ui/crests/nationColors.ts` (나라별 유니폼 색, 없으면 약자로 정한 색) + 나라 약자. 업데이트 알림 `UpdateBanner` 가운데 창 · 배경 흐림.
0. **v2.1 대표 선수 풀** (2026-11-16)
   - 파이프라인 `node tools/data_pipeline natpool --apply`: 나라별 대표팀 항목 (위키백과 "{나라} national football team" → Wikidata) 의 선수 소속 기록 (P54 + 기간 P580/P582 · 출전 P1350 · 골 P1351 · 포지션 P413), 1998년 이후 → `data/worldcups/pools.json` (실명, Git 제외 · 실명 데이터 옮기기에 포함) · 한국어 이름은 `data/locale/ko/wcplayers.json` 에 더함. 140개국 24160명 (게임 선수 6417명 맞춤). `publish` 가 공개 번호 · 패러디 이름으로 `data-public/worldcups/pools.json`.
   - 게임: `wcsquads.ts poolOf` (그 시즌 대표였던 선수) · `playerFromPool` (게임에 없으면 그 나라 수준 + A매치 + 나이로 오버롤). `intl.ts refreshDomestic` 이 시즌마다 이번 주기 세계 대회 명단 + 그 시즌 대표 풀 → 소집 후보. 풀 파일은 세계 대회 모드에서만 읽음 (4.6MB). AI 나라 선발은 그대로.
0. **v2.0 세계 대회 모드 (대표팀 감독)** (2026-11-16)
   - 파이프라인 `node tools/data_pipeline wcsquads --apply`: 위키백과 대회별 대표 명단 문서 선수 줄 → `data/worldcups/squads.json` (실명, Git 제외) · `data/locale/ko/wcplayers.json`. 위키백과 문서 → Wikidata 번호 (50개씩) → canonical 선수와 정확히 맞춤 (2002 ~ 2026 5759명 중 3704명), 나머지는 게임에 없는 선수 (wc 번호, 한국어는 Wikidata 이름표). `publish` 가 공개 번호 · 패러디 이름으로 `data-public/worldcups/squads.json`.
   - `engine/wcsquads.ts`: 명단 → 선수 (없으면 실명 대표 전용 선수, 능력 = 소속 리그 수준 + A매치 + 나이, retired · intlOnly). 본선 AI 나라는 실제 명단 (worldcup.ts callUpSquads).
   - `engine/intl.ts` (`w.intl`): 내 대표팀 nt-나라 (userClubId), 일정 = A매치 기간 토 · 화 (세계 대회 시즌: 9 · 10 · 11월 예선 6경기 + 3월 플레이오프, 그 밖: 친선), 같은 조 다른 경기 · 상대는 빠른 계산, 상대 대표팀은 사흘 전 준비 · 시즌마다 정리, 국내파 (실제 명단 · 모자라면 가상), 목표 (전력 순위), 통과 / 탈락에 따라 본선 참가국 바꾸기, 주기 끝 협회 평가 (2단계 미달 경질 · 2단계 초과 제안 → `switchNation`). 클럽 일 (이적 제안 · 스폰서 · 이사회 · 재계약 · 기자회견 등) 은 건너뜀.
   - `engine/matchEvents.ts`: 경기 중 사건 (하프타임 · 통증 · 우리 / 상대 페널티 · 막판), `shootoutSeq.ts` 직접 승부차기 규칙 (`kickChance` · `resolveKick` · `shootoutOver`). store: 경기 단계 `pens` (비긴 녹아웃 `decidesOnDraw`), `finishShootout` · `resolveEvent`. 이미 정한 승부차기 승자는 `s.pens ??=` 로 유지.
   - UI: 모드 창 세계 대회 · `IntlNewGame` (주기 · 대륙 · 나라 · 실제 명단 미리 보기), `IntlViews` (대표팀 홈 · 대표 명단 · 순위), `ShootoutGame`, `MatchEventModal`, `IntlJobModal`, 세계 대회 모드 튜토리얼. 테스트 `intl.test.ts` · `shootoutLive.test.ts`.
0. **v1.1 모드 고르기 창 · 로고 이미지** (2026-11-16)
   - 타이틀 `새 게임` → `ModePicker` 팝업 (모드별 설명, 세계 대회 준비 중) → `useApp.newMode` → 새 게임 화면 (모드 탭 없앰, 그 외 흐름 · 감독 설정 · 튜토리얼은 기본 모드와 같음).
   - 나의 구단 로고 이미지: `MyClubDesign.image` (128×148 PNG data URL, 세이브에 함께) → `ClubMaster.crestImage` → `Crest` 가 이미지로 그림.
0. **v1.0 게임 모드 · 나의 구단 만들기** (2026-11-16)
   - 새 게임 화면 모드 탭 (기본 · 나의 구단 · 세계 대회 준비 중). `engine/myclub.ts` + `myclubDesign.ts`(타입 · `myClubMaster`, db.ts 가 가볍게 씀): 고른 리그 꼴찌 자리 (`weakestClub` 명성 → 전력) 를 `swapInput` 으로 내 구단 (`my-…`) 으로 바꿔 읽고, 그 구단 선수는 FA (`setupMyClub`), 유스 6명 (`youthIntake`, createWorld `skipFill` 로 아카데미 자동 채우기 제외). 시작값 `myStart`: 리그 아래쪽 절반 중간값 × 이적 1.6 · 주급 1.25 · 잔고 1.3 · 매출 1.1, 명성 max(대신한 구단, 중간값)+2. 다음 시즌 데이터도 store `nextSeason` 에서 `swapInput(…, currentAsData)` → 리그 크기 · 승강 수 그대로, 대신한 구단은 다시 안 나옴.
   - `world.myClub {id, replaced, design, setup}` 저장, 불러올 때 `registerMyClub` 으로 db `clubs` 에 등록 (이름 · 엠블럼 · 색). 시작 조건 `squadNeeds`: GK 2 · DF 6 · MF 6 · FW 3 + 전체 11 + 후보 수. 그 전에는 '계속' 대신 '선수단 채우기 n/20' (FA 목록으로), 홈 `MyClubSetup` 카드. 테스트 `myclub.test.ts` (2012/13 → 2013/14 실제 데이터 전환 · 경질 없음 포함).
   - 내 구단을 맡는 동안 경질 없음 · 감독 계약 자동 연장 (`manager.ts ownClub`). 경기장 이름 `ClubMaster.stadiumName` (구단 화면 · 홈 경기 카드). 세이브 목록 `SaveMeta.myClub` · 명예의 전당 `CareerRecord.myClub` 으로 불러오기 전에도 이름 · 엠블럼 등록. 점검: 5대 리그 + 독일 2부 · 2001/02 · 2005/06 · 2012/13 창단 → 규칙대로 선수단 채우기 (주전 평균 ≈ 리그 아래쪽 30% 수준) → 3시즌 (첫 시즌 9~17위, 대신한 구단 재등장 없음, 리그 크기 유지).
0. **v0.27 셀온 · 보너스 조항** (2026-11-16)
   - `engine/addons.ts`: 선수 `sellOn {club, pct}` (다음 이적 때 `completeTransfer` → `settleSellOn` 이 파는 구단 몫에서 떼어 원래 구단에) · `addOn {club, payer, amount, apps, done}` (world.ts 출전 기록 → `addOnApp`, 채우면 그날 지급, 그 전에 떠나면 없어짐). 파는 구단 판단 `evaluateBid(…, terms)` 는 `termsWorth` 를 이적료에 더함 (셀온 × 나이 계수 0.75/0.5/0.3/0.1 · 보너스 × 가능성 0.75/0.55/0.35). 받은 제안 역제안 `counterOffer(…, sellOn)` 은 사는 구단 한도에서 셀온 값어치를 뺌. AI 제안 30% 에 보너스 (`aiOfferBonus`), AI 끼리 이적에 가끔 조건 (`aiTerms`). 알림 `clause` 이벤트. 보너스는 이적료 절반까지 (`termsError`).
   - UI: 영입 협상 이적료 단계에 셀온 · 보너스 선택 (구단이 보는 값어치 표시), 받은 제안 협상에 셀온 요구 · 보너스 표시, 선수 정보 '이적 조건' 줄. 테스트 `addons.test.ts`.
0. **v0.26 업데이트 알림 · 개발 서버 상태 두 벌 고침** (2026-11-16)
   - 업데이트 알림: `vite-build-id.ts` 가 빌드 번호를 `build.json` 으로 (개발 서버: 게임 코드 · 데이터가 바뀔 때마다 새 번호, `data/photos` · 수집 중간 파일 제외 / 배포판: 빌드 때 파일로). `ui/components/UpdateBanner.tsx` 가 처음 번호와 비교 (개발 4초 · 배포 5분마다 + 앱으로 돌아올 때) → 다르면 화면 위 띠 + 새로 고침 버튼. `sw.js` 는 build.json 을 저장하지 않음.
   - 증상: 새 게임 → 타이틀로 튕김 (이어하기로는 들어가짐), 업데이트 뒤 불러오기 안 됨. 원인: Vite HMR 이 바뀐 파일을 `?t=` 주소로 내주면서 `store/game.ts` 가 두 주소로 두 번 실행 → 새 게임 화면과 App 이 서로 다른 상태를 봄 (새로 고침해도 그대로, 서버를 다시 켜야 풀림). `vite.config.ts` `server.hmr: false` 로 막음 (고친 뒤 새로 고침으로 반영). 배포판과는 무관.
   - 확인: v0.20 · v0.24 에서 만든 세이브를 지금 버전에서 불러오기 · 이어하기 · 한 시즌 끝까지 + 다음 시즌 넘기기까지 오류 없음.
0. **v0.25 내 데이터 (이름 · 사진 · 옮기기)** (2026-11-16)
   - `data/custom.ts`: 이 기기 브라우저(IndexedDB `pitchboss-custom`)에 바꾼 이름 `names.{players,clubs,managers}[id] = {name, short?}` · 사진 Blob (`id` 또는 `id|시즌`, 300×360 JPEG). `main.tsx` 가 `bootCustom()` 으로 먼저 읽음. `db.ts` `playerKo` · `clubKo` · `managerKo` 가 바꾼 이름 먼저. `photos.ts` `usePhotos` 가 기기 사진 먼저 (개발 서버 없어도 사진 칸 사용, `server` 일 때만 자동 수집 · PC 폴더 기능).
   - UI: 사진 창 '이 기기에 사진 넣기' → `PhotoCrop` (끌기 · 확대 · 모든 시즌/이번 시즌), 이름 옆 ✎ `NameEdit` (선수 정보 · 구단 창 · 감독 한 줄), 데이터베이스 `MyData` (이름 목록 CSV 내려받기 · 올리기 · 예시, 사진 여러 장, 내 데이터 내보내기 · 가져오기 · 지우기).
   - `data/customIO.ts`: CSV `id,구분,소속,지금 이름,바꿀 이름,짧은 이름` (내려받기 UTF-8 BOM · 구단 → 선수(최근 시즌 소속 순) → 감독, 약 2만 줄 / 올리기 UTF-8 · EUC-KR · 탭 · JSON), 사진 파일 이름 = id · 지금 이름 (+ `_시즌`), `.pitchboss` = gzip JSON {names, photos(base64), real?[경로, JSON]} — 실명은 개발 폴더(`devRealEntries`) · 브라우저(`exportRealEntries`) 에서, 가져오면 `importRealEntries`. 측정: 실명 포함 5.9MB · 내보내기 7초, 휴대폰 가져오기 + 실명 전환 3초. CSV 파서는 `data/csv.ts` (테스트).
   - PC 사진 폴더(`data/photos`, Git 제외) → 이 기기: `importPhotoFolder` (manifest.json 의 선수|시즌 사진을 `faceCrop` 으로 얼굴 맞춰 300×360 으로, 367장 7초). 실명 데이터 폴더 고르기 · 끌어놓기에 사진 폴더가 있으면 함께 (`filesFromDrop` 이 `photos/files` 사진도 읽음). 개발 서버에서 실명과 함께 내보내면 PC 사진도 묶음 (같은 사진 파일은 한 번만, `same` 으로 가리키기) → 15.3MB · 휴대폰 가져오기 5초 (한꺼번에 저장 `putDevicePhotos`). 폴더에서 넣은 사진 키는 `custom.folder` (IndexedDB kv `folderKeys`, 묶음 파일에서는 `folder: true`) 로 따로 기억 → `removeFolderPhotos` 로 그것만 빼기 (직접 넣은 사진으로 바꾸면 표시 지움). `files` 폴더만 골라도 개발 서버의 manifest 로 넣음.
0. **v0.24 재정 규정 위반 징계** (2026-11-16): `engine/ffp.ts` — `club.ffp` (위반 횟수 · 시즌 시작 잔고 · 최근 3시즌 손익 · 예약 징계 · 영입 금지 기한). `ffpSeasonEnd` (closeSeason): 초과율 = 선수단 비용 ÷ 한도 − 1, 손실 규정이면 3시즌 누적 손실 초과도. 처음 · 10% 이하 경고 / 벌금 = 초과액 50% (매출 10%까지, 장부 `fine`) / 재위반 · 25%+ 감점 3~10 / 50%+ · 세 번째 영입 금지. 지킨 시즌마다 횟수 −1. `ffpNewSeason` (startNextSeason): 감점 · 여름 이적시장 끝까지 영입 금지 (`transferBan` → `canAfford`(이적료 > 0) · 임대 · store 입찰/임대/완전 영입 막음, 자유계약 가능). `ffpMidSeason` 1월 1일 경고. 받은편지함 `ffp`, 재정 화면 배지. 보통 시즌 2개 리그 40구단 심사 결과 모두 통과 (징계는 매출이 줄었을 때만).
0. **v0.23 리그 우승 확정 축하** (2026-11-13): `engine/clinch.ts` `clinchCheck` — 다른 모든 구단 승점 + 3 × 남은 리그 경기 < 내 승점이면 확정 (시즌 · 리그당 한 번, `w.clinched`). 내 경기 직후 `stepMatch` → 경기 화면 `TrophyOverlay` (headline '리그 우승 확정!'), 다른 팀 결과(`advanceDay`) · 결과만 보기는 `w.clinchShow` → 홈 · 경기 준비 `ClinchCeremony` 한 번. 받은편지함 `clinch`.
0. **v0.22.1 휴대폰 화면 점검** (2026-11-13): 390×844 로 타이틀 · 새 게임 · 허브 10개 화면 · 구단 창 · 선수 정보 · 협상 · 메뉴 · 저장 · 설정 · 경기 준비 · 하프타임 · 경기 끝을 돌며 가로 넘침 0 확인. 고친 것: 새 게임 구단 정보 팝업 위쪽 칸 `shrink-0` (감독 설정이 들어가며 눌림), 구단 창 머리 휴대폰은 숫자를 아래 줄로, 경기 끝 최우수 · 워스트 카드 휴대폰은 한 줄에 하나.
0. **v0.22 스폰서 계약** (2026-11-13): `engine/sponsors.ts` — 모든 구단 `club.sponsors` (메인 45% · 용품 25% · 상품 · 기타 30% 는 계약 없이, 합계 = 기존 매출 25%). `financeDay` 매월 `monthlyCommercial` (계약 연액 / 12 + 상품 몫 × 팬 · 여론). 내 구단: 첫 시즌 메인 계약은 시즌 끝 만료 · 용품 3시즌, 만료 시즌 3월 1일 `sponsorDay` → `makeOffers` 고정형 · 성과형(×0.8 + 우승 35% · 4위 15% · 컵 10% · 유럽 30% 보너스) · 장기형(5년 ×0.93), 금액 = 기준 × `performance` (목표 대비 순위 0.8~1.3 · 팬 여론) × ±8%, 6/25 지나면 고정형 자동. `sponsorSeasonEnd`: 성과 보너스 (모든 구단) · AI 만료 계약 자동 갱신. 재정 화면 `SponsorCard`, 받은편지함 `sponsor`. 회사 이름은 가상 조합.
0. **v0.21 경기 중 피치 지휘 · 큰 경기 연출** (2026-11-13)
   - `LivePitch.tsx`: 경기 화면 가운데 (전술 화면 `Pitch` · `slotXY` · `usePitchDrag`), xl 이상 [후보 | 피치 | side(성향 · 압박)] 3칸 · 그 아래는 세로 (피치 → 후보 → 성향), 피치 폭은 화면 높이에 맞춤. 오른쪽 내 팀 목록 칸은 없앰 (2칸 그리드), 하프타임은 한 줄. 후보 칸 data-slot 100+. 선수 누르기 → 후보 누르기 / 후보 → 선수 끌기 = `sub` (`canSubInto`), 선수끼리 = `liveSwap` (`swapSlots`), 빈 곳 = `liveReshape` (`reshape` · `autoFormation` → `reshapeTeam`). `slotOrder` 로 포메이션 자리 ↔ 뛰는 선수. 통계 칸은 2열로 줄이고 아래로.
   - `engine/shootoutSeq.ts`: 정해진 승자(`cup.shootout`)에 맞는 키커 순서 (슈팅 · 침착성 vs 골키퍼 반사 · 1:1, 5명 조기 종료 · 서든데스), `stepMatch` 끝에서 `summary.shootout`. `BigMoments.tsx`: `FinalIntro` (컵 · 유럽 결승 · 승격 PO 결승 킥오프), `ShootoutOverlay` (준비 → 골/선방/실축), `TrophyOverlay` (결승 승리, 꽃가루). styles.css `bm-*` 애니메이션 (움직임 줄이기 설정이면 끔).
0. **v0.20 이적 어필 · 관심 자동 해제 · 스카우트 기억** (2026-11-13)
   - `engine/appeal.ts` `appealDay`: 이적시장 중 · 열리기 30일 전, 하루 10% · 동시에 2명, 후보 = 다른 구단 33세 이하 · 우리 주전 전력 −8~+4 · (우리 명성 +3 이상 높음 또는 불만 · 결장 · 이적 요구로 명성 −5까지), 가중치 명성 차 · 불만 · 야망 · 충성도. `w.appeals` (기한 = 그 이적시장 끝) · `appealSeen` (선수당 시즌 1번), 관심 목록에 자동 추가, 받은편지함 `appeal`. 효과: `wageDemand(w, p, buyer)` 우리 구단이면 ×0.85 (`APPEAL_WAGE`), `playerWillJoin` +2.5. 이적료(`askingPrice`)는 그대로. 협상 창 '우리 구단 희망 · 주급 −15%'.
   - 관심 해제: `completeTransfer` 에서 우리 구단으로 오면 관심 · 어필 제거, `shortlistDay` 가 매일 우리 선수 정리 (임대 등).
   - 스카우트: `ScoutState.ours` (우리 구단에 있었던 선수, `rememberOurs` 매일 · 시즌 시작 · 새 게임) · 임대 보낸 선수(`loan.from` = 우리) → `knowledge` 100. `scoutNewSeason` 이 새 시즌에 `k` 비움 (보고서 · 리그 관찰 · 경기 관찰은 그 시즌만).
0. **v0.19.1 로테이션** (2026-11-13): `ai.ts` `rotationLevel(edge, fixture)` (전력 차 2 이하 0 → 8 이상 1, 컵 +0.35, 유럽 대회 조별은 덜, 16강 · 8강 · 준결승 · 결승 · 플레이오프 0) × `rotationBias` (연속 선발 `startStreak` 많은 주전 −최대 8.5%, 연속 결장 `benchStreak` +최대 7%, 21세 이하 +3%) → `pickLineup(bias)`. 직접 고정한 선발 · 내 포메이션 유지 경로는 그대로. `recommend` 에 경기 정보 전달 (world.prepareMatch · store · MatchPrep). 측정 (2025-26 eng1 반 시즌 6시드): 강팀 1군급 18명 중 선발 2경기 이하 7.2 → 2.3명, 강팀 승점 35.8 → 33.8.
0. **v0.19 경기 중 자동 교체** (2026-11-13): `match.ts` `autoSubs` 를 상황 판단으로 다시 짜고 직접 지휘 팀에도 (`TeamInMatch.autoSub`, false 면 안 함): 점수차별 계획 (지면 55·70·80분 2·2·나머지, 비기면 65분 1~2 · 77분 나머지, 1골 리드 70·80·85분, 2골+ 리드 60·70·78분 핵심 선수 휴식), 경기마다 ±5분 흔들림, 체력 50 미만 즉시, 경고 · 경기력(dayZ · 골 · 도움) 반영, 경기 중 타이밍 최대 3번 · 10분 간격 (`subWindows` · `lastSubSeg`). 40경기 측정: 첫 교체 지고 56분 · 비김 58 · 앞섬 62, 경기당 타이밍 2.7, 2골+ 리드 15경기 모두 2명 이상 휴식. 내 팀은 `canSubInto` 맞는 후보만 (`bestBenchFor(fitOnly)`). 설정 `autoSubs` (기본 켬) → `confirmLineup` 에서 반영, 경기 화면 내 팀 칸 체크박스 `setAutoSub`. 결과만 보기(playToEnd)에도 적용. `autoSub.test.ts`: 12경기 켬 59회 · 끔 0회 (부상 제외).
0. **v0.18.2 저장하기 창 잘림 수정** (2026-11-13): `Sidebar` 저장 창을 사이드바 안 absolute → 화면 가운데 fixed 창 (사이드바 overflow-y-auto 가 잘라 냄), 바깥 누르면 닫힘.
0. **v0.18.1 검색 결과 가림 수정** (2026-11-13): `TopBar` header 에 `relative z-30` (backdrop-blur 로 생긴 쌓임 맥락 때문에 뒤에 오는 `.panel relative` 가 검색 결과(z-40)를 덮었음).
0. **v0.18 난이도 · 감독 시스템** (2026-11-13)
   - 난이도 `gameSettings.ts` `difficulty` (쉬움 · 보통 · 어려움): AI가 내 구단과 싸울 때 경기력 배율 `aiEdge` 1 · 1.05 · 1.1 + 이사회 인내심 · 재정 규정 · 이적 협상 묶음(`difficultyPreset`). 설정 store `difficulty` (저장된 예전 설정은 'easy'). 측정: 강팀 상대 홈 경기당 승점 쉬움 1.64 · 보통 1.39 · 어려움 1.16.
   - `engine/managers.ts`: 모든 구단 감독 (`w.managers`, `club.managerId`, 내 감독 `w.managers.user`). 능력 tac(경기력 `managerEdge` 1 + (tac−60)×0.0012, 팀 케미 배율에 곱함) · mot(사기 기준 `moraleTarget` 52 + mot×0.14) · dev(월간 성장 `devBonus`) · rep · potential · style(AI 전술 공격 · 압박). 시즌 끝 `managerSeasonGrowth` (전력 순위 대비 성적 · 우승 → 잠재력까지, 60세+ 하락). 경질 `hireManager` (실업 감독 중 명성 맞는 사람 75% · 아니면 가상 감독). 다음 시즌 데이터가 있으면 `assignManagers` 로 실제 감독. 예전 세이브는 `ensureManagers` 로 가상 감독.
   - 내 감독: 새 게임 구단 정보 칸 `ManagerSetup` (이름 · 철학 공격/균형/실리 · 선호 압박 · 강점 전술가/동기부여가/육성가, 능력 55 · 강점 65 · 잠재력 92). 철학 · 압박이 경기 전술과 맞으면 최대 +1.2%. 구단 화면 `MyManagerCard` 에서 이름 · 철학 · 압박 변경. 구단 창 · 경기 준비 `ManagerLine`, 감독 교체 소식에 새 감독.
   - 데이터: `node tools/data_pipeline managers --apply` → `data/history/managers.json` (실명, 감독 1071명 · 시즌별 구단 감독 `seasons`) · 한국어 이름은 따로 `data/locale/ko/managers.json` (위키데이터 ko 있는 551명만, 없으면 영문). 출처: 영문 위키백과 리그 시즌 문서 감독 교체 표 → 위키데이터 P286 · P6087(직책 필터) → 구단 시즌 정보 상자. 9월 15일 기준 감독. 실제 감독 94.2% (eng1 · ita1 100%, ger2 77%), 나머지 가상. 능력 = 전력 대비 순위 · 우승 · 젊은 선수 성장 · 위키 지명도, 백분위로 맞춤 (전술 중간 63 · 상위 3% 86 · 최고 95). 성향 덮어쓰기 `data/canonical/managers-override.json` (실명, 커밋 안 함). `publish --apply` 가 `data-public/history/managers.json` · `data-public/locale/ko/managers.json` (패러디 이름) 생성.
   - 알려진 빈틈: ger2 2000~07 일부 가상 감독, 감독 교체 표 없는 시즌 216개는 시즌 끝 기준일 수 있음 (예: 2005-06 레알), 위키백과 · 위키데이터 불일치 64건 (같은 사람이 ID 둘일 수 있음). 자세한 건 `data/_pipeline/reports/managers.txt`.
0. **v0.17.3 나이별 체력 회복** (2026-11-13): `condition.ts` `ageRecovery(age)` (20세 이하 1.3 → 27세 1.0 → 33세 0.75 → 36세+ 0.6), 기본 회복 6.5→7.5, 85 이상 회복 배율 0.25→0.5, 경기 소모 `TUNING.tire` 2.1→1.95 (풀타임 약 32). 사흘 간격 풀타임 5연전 시작 체력: 20세 100·97·94·91·94 / 27세 100·90·85·80·74 / 33세 100·88·76·64·52 (`condition.test.ts`). 성장은 이미 출전 수 반영 (`season.ts` minutesBonus).
0. **v0.17.2 주급 칸 · 홈 정리 · 경기 사건 팀 표시** (2026-11-13): 협상 · 재계약 주급 칸 최소 200px (`NegotiationModal` · `ContractBox`). 홈 '주요 선수' 카드 삭제 (리그 순위표 · 득점 순위만). `Crest.tsx` `clubColor(id)` — 유니폼 주색 → 보조색 → 엠블럼 색 중 어두운 배경 대비 3 이상인 첫 색. 경기 화면 문자 중계 · 주요 장면에서 골 · PK 실축 · 경고 · 퇴장 줄에 구단 색 왼쪽 막대 + 엠블럼 + 구단 이름 머리 (골은 크게).
0. **v0.17.1 스카우트는 구단 창에서** (2026-11-13): 구단 창(`SearchModals` `ClubModal`) 머리 아래 `ClubScoutBar` — 진행 중이면 진행률 %(`scoutProgress`) · 남은 날 · 막대, 아니면 '아직 모르는 선수 N / 전체' + 스카우트 보내기 (금액 · 일), 다 알면 완료 표시. 선수 정보 `ScoutBox` 는 앎 정도 · 구단 스카우트 진행률 · '○○ 창에서 스카우트 보내기 →' (구단 창 열기)만. 자유계약 선수는 `knowledge` 100 (공개, ScoutBox 숨김).
0. **v0.17 홈 이적시장 · 관심 선수 알림 · 구단 스카우트** (2026-11-13)
   - 홈 `WindowBar`: 이적시장 열림 (마감 · D-day, 3일 이하 강조) / 닫힘 (다음 열리는 날 · D-day) · 관심 선수 수, 누르면 이적 화면.
   - `engine/shortlist.ts` `shortlistDay` (advanceDay): 관심 목록 선수가 급매물 · 자유계약 · 보스만 가능 · 계약 6개월 이내가 되면 받은편지함 `shortlist` (선수 · 사건 · 시즌마다 한 번, `w.shortlistSeen`). 홈 최근 소식은 받은편지함을 그대로 보여 줌.
   - 스카우트 `kind: 'club'`: 그 구단 선수 모두 앎 95 (보고서가 나온 날 기준), 비용 = 아직 모르는 선수(`clubScoutTargets`) × 한 명 비용, 기간 같은 리그 7일 · 다른 리그 14일, 동시에 3곳. 자유계약 선수는 한 명 단위 그대로. 선수 정보 버튼 '○○ 전체 스카우트 · N명 · 금액 · 일'.
0. **v0.16.1 튜토리얼 새로** (2026-11-13): `Tour.tsx` 단계마다 `tab` 으로 해당 화면 이동 후 `data-tour` 대상 비춤 (화면 밖이면 스크롤, 큰 대상은 화면 안으로 잘라 비춤, 카드는 오른쪽 · 왼쪽 · 위 · 아래 순으로 자리 찾기). 새 단계: 뉴스 · 선수단 선발 · 후보 (squad-filter) · 팀 케미 (squad-chem) · 전술 피치 끌어서 포메이션 (tactics-pitch) · 후보 편집 (tactics-bench, `Card` 에 `tour` 속성) · 이적 시장 상황 (transfers-top) · 이적 조항 · 경기 날 · 업데이트 내역. PC 19단계 · 휴대폰 20단계 모두 대상 확인. 저장 값 `pitchboss.tutorial` = 'v2' (내용이 바뀌면 VERSION 을 올려 한 번 더 보여 줌), 끝나면 홈으로.
0. **v0.16 테스터 피드백: 선발 표시 · 후보 편집 · 끌어서 포메이션 · 불만 사유 · 체력** (2026-11-13)
   - 끌어서 포메이션: `PitchDrag` 에 `onFree` (피치 `data-pitch` 빈 곳에 놓으면 `zonePos` 로 위치 → 포지션, 끄는 동안 '→ ST 자리로'), `reshape` (같은 구성 기본 포메이션이면 그 이름 · 선수 배치 유지, 없으면 '★ 내 배치' 로 저장 · 덮어씀), 스토어 `reshapeTactics` · `reshapeDraft`, 숙련도는 원래 포메이션 −10 이어받기 (`inheritFam`). `validateFormation` 규칙 위반이면 안내만.
   - 후보 편집: `BenchEditor` (✕ 빼기 · 명단 밖 + 넣기, 전술 · 경기 준비), `pickLineup` 은 사용자가 후보로 정한 선수를 자동 선발에서 뺌 (그 자리에 아무도 없을 때만 씀).
   - 선발 표시: `currentLineup` → 선수단 (등번호 초록 원 · 왼쪽 초록 막대 · 옅은 초록 줄, 후보는 파란 테두리 · 막대, '선발 · 후보' 모아 보기) · 이적(내 선수) 막대 + 배지. 불만 사유: `unrestReasons` (출전 · 약속 역할 · 언론 플레이 · 오래 결장 · 사기) → 선수단 (이름 아래) · 선수 정보 · 라커룸 · 경기 준비.
   - 체력: 85 이상은 하루 회복 ×0.25 (풀타임 62 → 7일 뒤 약 95, 연전이면 약 83). 측정: 엔진에서 풀타임 −30~39.
0. **v0.15.2 능력치 재구성** (2026-11-12) — v0.15.1 의 '부풀림 되돌리기'(ovr_audit.py, 삭제)를 대신함
   - `node tools/data_pipeline rebuild [--apply]` (steps/rebuild.js): 진짜 실력 = 실제 기록 + 이후 경력 (지명도는 보조). 포지션 교정 전 백업에서 원래 기준 실력 역산 → 재능 점수 S (지명도 + 대표팀). `steps/careerStats.js`: 위키백과 정보 상자 캐시의 구단별 기간 · 리그 출전 · 득점 · 성인 대표팀 (1만 4천여 명, 2군 II · B · 카스티야 등 구분). 시즌 기록 점수 = S×0.3 + 구단 명성 × 출전 비중 + 주전 + 득점력 (포지션별, 작게) + 3시즌 안에 더 큰 구단 (숨은 에이스). 경력 상위 3시즌 평균 = 전성기, 시즌 점수 = 기록 ½ + 전성기 ½ + 나이 (25세 미만 −0.9/년, 30세 넘어 −1.2/년 최대 −8, 30대 정상급 주전은 절반). 시즌 · 포지션 묶음마다 1부 리그 분포로 펼침 (중앙 71 · 10% 81 · 1% 88 · 최상위 94). 능력치 = model.attributes 후 주 포지션 오버롤 = 실력. 몸값 `marketValue` 은 능력 1당 23% 이던 것을 85부터 10% 로 (최상위 94 전성기 ≈ €160M, 어린 스타 ≈ €220M). 테스트 `news.test` 소문 수 기준 30 → 20 (재구성 뒤 27개).
   - 결과: 메시 15-16 93 · 호날두 13-14 94 · 판데이크 20-21 94 · 리버풀 20-21 살라 94 · 마네 91 · 피르미누 87 · 번리 72~79 · 모드리치 17-18 86 · 숨은 에이스 (예: 찰리 오스틴 QPR, 2부 하셈리안). 모델 LM/RM 편차 조정.
   - 순서: 포지션 패치 (`py scripts/position_pipeline.py --apply`) → `rebuild --apply` (항상 마지막) → `publish --apply`. 백업 data/_pipeline/backup-seasons-before-rebuild. patch_07: 메시 RW + ST · AM · CM 전 시즌, 비야 2010-12 LW.
   - 현황 엑셀 · 자료: 바탕화면 PITCH_BOSS\ (01_실명데이터 최신 · 이전_보관, 02_현황 엑셀 — 요약 · 전체(실력 근거 열) · 선수별 경력 · 확인 필요, 03_검수_기록, 04_지난_자료, 읽어보기.txt).
0. **v0.15.1 오버롤 바로잡기** (2026-11-12)
   - 원인: 포지션 교정 때 `ensureMainBest` · `position_pipeline --apply` 가 '주 포지션이 가장 높게' 능력치를 올려 부풀림 (+3 이상 2,928줄 · +5 이상 618줄, 예: 피르미누 2020-21 AM 87 → ST 91). 사용자가 본 ST 80 / AM 87 은 브라우저에 가져온 11-11 실명 백업 (교정 전).
   - `scripts/ovr_audit.py --deflate`: 부풀린 만큼 모든 필드 능력치에서 같은 정수를 빼서 교정 전 실력(주 · 인접 자리 최고)으로 (28,475줄, 백업 data/_pipeline/backup-seasons-before-deflate). `--report`: 역전 · 부풀림 통계 + 바탕화면 CSV.
   - `position_pipeline --apply` 는 더 이상 능력치를 올리지 않음 → 다른 자리가 더 높을 때만 `rebalance` (주 포지션 쪽으로 균형을 옮기고 최고값은 그대로).
   - 섞인 위키 표기 ('Right-back, midfielder') 의 넓은 말에서 풀린 보조 포지션 정리 3,672줄 (다른 시즌 주 포지션 · 사람이 고친 선수 제외). patch_07: 리베리 LW · 네이마르 LW · 디 마리아 RW · 메시 2010-13 ST.
   - 게임: `ratingAt` 다른 자리 능력은 주 포지션 능력을 넘지 않음 (표시 · 선발 판단, 경기 힘 unitValue 는 그대로). `pickLineup`: 그 자리가 주 포지션인 선수가 최고 후보의 93% 이상이면 우선, 보조 · 다른 자리 ×0.97.
0. **v0.15 라커룸 · 팀 케미** (2026-11-12)
   - `engine/chemistry.ts`: 핵심 16명 기준 케미 = 함께한 시간 30% (현 구단 연속 시즌, 실제 기록 `seedClubSeasons` + 게임 속, 4시즌 만점) · 유대 20% (리그 나라 말 또는 같은 언어권 동료, `LANG_OF`) · 사기 30% · 리더십 20% (주장 `club.captain`, 없으면 리더십 최고 24세 이상) − 불만 1명당 8 (최대 32). 경기 `famMult × chemMult` (0.97~1.03).
   - 측정 (2025-26, 이력 반영): 최저 41 · 평균 55.5 · 최고 75 → 경기 배율 약 ×0.995~×1.015. 경기 균형 테스트 통과 (세트피스 확률 테스트는 표본 300 → 600경기로).
   - `lockerDay` (내 구단): 영향력 상위 3명 중 불만 1명당 선수단 사기 하루 −0.25 · 30일마다 알림 (`locker`), 리더십 70 이상 주장이 만족하면 사기 65 쪽으로. `teamMeeting` 30일에 한 번 (성공 +6 · 실패 −4, 확률은 케미 · 최근 5경기 · 주장 리더십).
   - 화면: 선수단 화면 '팀 케미' 줄 → `LockerRoom` (구성 막대 · 주장 지정 · 영향력 5명 · 불만 / 말이 통하는 동료 없음 / 새로 온 선수 · 팀 미팅), 받은편지함, 도움말.
0. **v0.14 뉴스 · 이적 소문** (2026-11-12)
   - `engine/news.ts` · `w.news` (최근 250개) · `newsDay` (advanceDay 끝): 이적 (내 구단 · 2천만 유로 이상 · 능력 80 이상), 받은편지함의 바이아웃 · 보스만 · 급매물, 감독 교체, 데드라인 데이 결산.
   - 소문: 이적시장 + 직전 한 달 (6월 · 12월) 하루 0~2개. 출처 신뢰도 ★1~5 → 실제 추진 확률 10 · 25 · 45 · 65 · 85%. 실제 추진은 그 구단 수준 +1~+7 · 감당 가능 · 선수 동의 이적만, 정한 날(이적시장 안) `pursue` (다른 구단 선수: 구단 부르는 값으로 이적 시도 · 내 선수: 영입 제안). 그 구단으로 가면 사실, 이적시장 마감까지 안 되면 무산. 내 선수 소문 20%.
   - 측정 (2025-26 여름 이적시장): 소문 45개 · ★1~2 사실 12% · ★4~5 사실 52% · 이적 뉴스 98 · 하루 약 57ms.
   - 화면: 메뉴 '뉴스' (`NewsView`: 전체 · 이적 소문 · 이적 · 소식 · 내 구단), 홈 '이적 소문' 카드, 도움말.
0. **v0.13.1 설정 창 업데이트 내역** (2026-11-12): 설정 창에 '설정 / 업데이트 내역' 탭 (`ChangelogList`, CHANGELOG 전체 · 지금 버전 표시), CHANGELOG 에 v0.1 (첫 공개 2026-11-11) 추가.
0. **v0.13 급매물: 강제 매각 · 강등 조항** (2026-11-12)
   - `engine/firesale.ts` · `w.bargains`: 이적시장이 열린 첫날 (`fireSaleKey`) 선수단 비용이 재정 규정 한도의 115% 이상인 AI 구단은 상위 1명 (130% 이상 2명, 32세 이하)을 가치 70~80%에 매물. 측정: 2024-25 → 2025-26 새 시즌 직후 한도 10% 이상 초과 약 10곳, 시즌 중 0곳 (AI 는 한도 안에서만 영입).
   - 강등 조항 `relClauseOf`: 1부 명성 하위 40% 구단의 상위 3명 중 60%, 가치 ×0.8~1.2. 시즌 전환 때 `fixRelClauses` (리그 바뀌기 전) → `triggerRelClauses` (1부에서 떨어진 구단) → 여름 이적시장 급매물 (한 번 발동하면 끝).
   - `evaluateBid` · `askingPrice`: 급매물이면 그 가격 (핵심 선수 · 인원 규칙 없음, 85% 이상이면 역제안). `bargainDay`: AI 구단 하루 2.5% (첫날 제외), 마감 · 소속 변경 정리. 받은편지함 `bargain`.
   - 화면: 이적 화면 '강제 매각 −N%' · '강등 조항 발동' · '강등 조항' 표시, 리그 필터 '급매물', 협상 창 안내 · '강제 매각가 / 강등 조항 제안' 버튼, 선수 정보 강등 조항, 도움말.
0. **v0.12 데드라인 데이 · 보스만 룰** (2026-11-12)
   - `engine/bosman.ts`: `deadlineCheck` (하루 넘긴 뒤 마감 3일 전 · 당일이면 `w.deadlineAlert` → `advanceToUserMatch` 멈춤 · `DeadlineAlert` 팝업), 마감 당일 AI 영입 확률 ×3 (`aiTransferDay`).
   - 보스만: `inFinalMonths` (계약이 시즌 끝 · 1월 1일부터) + `bosmanEligible` (다른 나라 구단만) → `signPrecontract` (`p.precontract`), 시즌 전환 때 `joinPrecontract` (이적료 0). 사전 계약 선수는 이적 불가 · 재계약 불가 · 제안 없음. `aiBosmanDay`: 1월 2일부터 재계약 안 한 내 선수에게 해외 구단 하루 1%.
   - 화면: 이적 화면 마감 D-day · '보스만' / '계약 만료 예정' / '사전 계약' 표시 · 리그 필터 '보스만', 협상 창이 보스만이면 이적료 단계 없이 사전 계약 (`precontract`), 선수단 '보스만 이적 예정', 받은편지함 `bosman`, 도움말.
0. **v0.11 임대 개편** (2026-11-12)
   - `engine/loan.ts`: 이적 조건 셋 중 하나 — 없음 · 완전 영입 옵션 (`buy` + 영입 후 주급 `buyWage`, 사용자는 언제든 · AI 는 시즌 끝 주전급이면 행사) · 의무 이적 (`must`, `endLoans` 에서 자동 이적). 최저 이적료 `buyFloor` 옵션 가치 90% · 의무 75%. 행사하면 영입 후 주급으로 3년 계약.
   - 사용자 빌려 오기: 영입 후 주급이 선수가 원하는 주급의 90% 이상이어야. 보내기: `loanCandidates(…, deal)` 로 그 이적료 · 주급을 감당할 수 있는 구단만.
   - 화면: `LoanModal` 이적 조건 선택 (옵션 없음 · 완전 영입 옵션 · 의무 이적) · 이적료 · 영입 후 주급, 이적 화면 임대 정보 · 받은편지함 문구, 도움말.
0. **v0.10 계약 조항: 바이아웃** (2026-11-12)
   - `engine/clauses.ts`: `buyoutOf` (선수 · 구단마다 처음 볼 때 정해 저장, 구단이 바뀌면 새로) — 스페인 리그 의무 (능력 80 이상 가치 ×3~5, 그 외 ×2~3.5), 다른 리그 20% (×1.8~3). `evaluateBid` 에서 바이아웃 이상이면 무조건 수락 (선수 동의는 따로).
   - 계약 때 선택 (`buyoutOptions` 없음 · 가치 ×1.5 · ×2.5 · ×4, 스페인은 없음 불가, 기본 없음) → `buyoutWageFactor` 주급만 ×1 · 0.9 · 0.94 · 0.97 (안 넣으면 일반 계약, 이적료는 그대로). 영입 `sign(…, clause)` · 재계약 `renew(…, clause)` (자동 재계약은 지금 조건 유지).
   - `aiBuyoutRaids` (이적시장 동안 매일): 내 선수 바이아웃이 가치 ×1.3 이하면 하루 2% · ×2 이하 0.4% · ×3 이하 0.08%, 그 선수가 주전급이고 감당 가능한 구단 중 명성 1위가 데려감 (거절 불가, 받은편지함 `buyout`).
   - 화면: 영입 협상 창에 바이아웃 표시 · '바이아웃 지불' 버튼, 계약 단계 · 재계약 창에 바이아웃 선택, 선수 정보 · 계약 상자에 표시, 도움말 항목.
0. **v0.9.3 포지션 2차 교정 · 아카데미 끌어올림** (2026-11-12)
   - `scripts/position_pipeline.py` (`py scripts/position_pipeline.py --extract` · `--apply`): positions-check 보고서를 읽어 오탐(넓은 표기와 같은 줄 · 경계 자리)을 거르고 검수 배치(data/batches, 80줄씩)를 만들고, data/patches/patch_*.json 을 원본에 반영 후 다시 점검. 같은 선수 · 시즌은 마지막 패치만 적용, 적용 뒤 '주 포지션이 가장 높게' 보정. data/batches · data/patches 는 실명이라 gitignore.
   - 패치: 01 확실한 6명 · 02 넓은 표기와 줄이 다른 551명을 겹치는 자리 중 원래 자리에서 가장 가까운 곳으로 · 03 유명 선수 21명(메시 RW 등) · 04 사람 검수 16명 · 05 좌우 반전 등 16명 · 06 넓은 표기 선수의 기계적 보조 포지션(ST/RW,LW · CB/RB,LB · CM/DM,AM) 정리 6,098명 (다른 시즌 주 포지션은 보조로 남김).
   - 점검: 인포박스와 줄이 다른 선수 551 → 0 (남은 306줄은 넓은 표기를 구체화한 것), 주 포지션보다 높은 자리 0. 선수 추가 · 삭제 없음 (바탕화면 백업과 18,901명 같음).
   - 게임: `academyFill` (youth.ts) — 새 게임 · 새 시즌에 골키퍼 2 · 수비 5 · 미드 4 · 공격 2 미만인 구단은 아카데미 선수를 최저 주급으로 승격 (시즌 보고 `academy`).
0. **v0.9.2 포지션 바로잡기 · 체력 · 교체 제한** (2026-11-12)
   - 데이터: `positions --apply` (위키백과 인포박스 98% · 바뀐 줄 19,794 · 수동 수정 4명) → `publish --apply`. 규칙: 지금 포지션이 구체적인 위키백과 포지션 안이면 유지 · 시즌 선수단 묶음 안의 구체적 포지션 우선 · 'Forward/Midfielder' 처럼 뭉뚱그린 말만 있으면 바꾸지 않고 확인 목록(631명, reports/positions-review.txt) · 방향 없는 'Winger/Full-back' 은 지금 방향 유지.
   - 능력치: 데이터 공식의 스트라이커 위치 선정 −20 → 0 (게임은 공격 위치 선정으로 씀), 측면 미드 · 윙백 편차 추가, 공식으로 만든 선수는 같은 OVR 로 다시 만듦, 모든 선수 '주 포지션이 가장 높게' (주 포지션이 더 쓰는 능력치만 올림). 점검: 주 포지션보다 높은 자리 1,559 → 0, 리그 평균 +0.5~1.0 (모든 리그 비슷).
   - 백업: data/_pipeline/backup-seasons-before-positions. 점검: `positions-check`.
   - 게임: 경기 체력 소모 TUNING.tire 2.1 (90분 약 34) · 하루 회복 9 → 6.5 · 직접 교체는 `canSubInto` (골키퍼↔필드 불가, 친숙도 0.7 이상).
0. **v0.9.1 중계 이모지** (2026-11-12): 문자 중계 골 ⚽ · 경고 🟨 · 퇴장 🟥.
0. **v0.9 문자 중계 · 하프타임 · 경기 중 포메이션 변경** (2026-11-12)
   - `engine/commentary.ts`: 구간마다 장면(캐스터) · 의견(해설: 감독 칭찬 · 비판 · 걱정, 흐름) 문장, 이름은 {p:ID} · {c:ID} 토큰. 따로 만든 난수만 써서 경기 결과 불변 (테스트로 확인). 내 경기만.
   - 하프타임 자동 멈춤 (`MatchScreen` half 상태) · `setFormation` (뛰는 선수 자동 재배치, 지시 초기화) · 해설 반응.
   - 결과만 보기 이변 확인: 리그 최강 대 최약 400경기 강팀 승 62.5% · 무 19.3% · 패 18.3%.
   - 데이터 도구 (적용 전): `positions` (위키백과 인포박스 기준 포지션 바로잡기 · 수동 수정 positions-override.json) · `positions-check` (점검). 결과는 다음 버전(v0.9.2)에서 적용.
0. **v0.8.2 새 게임 구단 목록 간소화 · 휴대폰 구단 팝업** (2026-11-12): 막대 그래프 빼고 로고 · 이름 · 평균 능력. 휴대폰은 구단을 누르면 아래에서 팝업(history.pushState 로 뒤로 가기 = 닫기), 팝업 안 시작 버튼.
0. **v0.8.1 잘린 글자 흐르기** (2026-11-12): `ui/marquee.ts` 가 화면 전체의 `.truncate` 칸 중 잘린 것에 `mq-run` (text-indent 애니메이션, styles.css). 글자 · 칸 너비가 그대로면 다시 재지 않음 · 동작 줄이기 설정이면 끔 · `data-no-marquee` 로 제외.
   버전 원칙: v1.0 은 휴대폰 실명 데이터 · 사진 넣기까지 끝나고 실제 기기에서 확인한 뒤 (그때까지 0.x).
0. **v0.8 끌어다 놓기 · 경기 후 홈 · 휴대폰 지원 2단계** (2026-11-12)
   - 피치 끌어다 놓기 (`PitchDrag.tsx usePitchDrag`, Pointer Events · touch-action none): 전술 · 경기 준비 공통, 짧게 누르면 선택 · 끌면 두 자리 맞바꿈.
   - `closeMatch` 끝에 `useApp.setTab('home')` — 경기가 끝나면 항상 홈.
   - 휴대폰 (1024px 미만): 선수 정보 = 전체 화면 창 (`PlayerPanel sheet`), 전술 · 경기 준비 자리 선택 = 아래 시트, 표는 핵심 열만 (나머지 `hidden lg:table-cell`),
     이적 검색 조건 접기, 경기 준비 · 경기 화면 세로 배치 + 진행 버튼 아래 고정, 팝업 바깥 여백 축소 · 창 안 스크롤 (styles.css), 인트로 · 첫 화면 스크롤.
   - 주의: 좁은 화면에서 스크롤 열 안의 패널은 `min-h-0` 이면 줄어들어 겹친다 → `shrink-0 lg:min-h-0`. 배지 같은 inline-block 은 `hidden` 을 감싸는 span 에.
0. **v0.7 휴대폰 지원 1단계** (2026-11-12) — 계획: v0.7 기반 → v0.8 주요 화면 → v0.9 나머지 화면 → v1.0 실명 데이터 · 사진 파일 (휴대폰은 폴더 고르기 불가)
   - 1024px 미만: 사이드바 → 서랍 메뉴 (`useApp.drawer`, 상단 바 ☰, transform 대신 left 로 움직여 안의 창이 화면 기준으로 뜸). 상단 바 · 하단 진행 바 축소, 안전 영역(노치) 여백.
   - 첫 화면 · 새 게임 화면 휴대폰 배치 (새 게임은 세로로 쌓고 시작 버튼 아래 고정). 업데이트 소식은 휴대폰에서 아래쪽 카드.
   - 튜토리얼: 좁은 화면이면 메뉴 단계에서 서랍을 열고, 카드는 위 · 아래에. '메뉴 (휴대폰)' 단계 추가.
   - PWA: `public/manifest.webmanifest` · 아이콘(`icon.svg` → png) · `public/sw.js` (HTML 네트워크 먼저 · assets 저장본 먼저), 배포판에서만 등록. 오프라인 실행 확인.
   - 좁은 화면 입력칸 16px (아이폰 자동 확대 방지), 100dvh.
0. **v0.6 경기: 세트피스 · 선수별 지시 · 포메이션 숙련도** (2026-11-11)
   - `match.ts`: 일반 공격 xG 80% + 세트피스(공중 경합 상위 4명 비율² × 키커 정확도) + 페널티(구간당 0.95% · 키커 슈팅+침착함 vs 골키퍼). 득점에 `kind: 'pen' | 'set'`.
     균형 (3개 리그 900경기): 경기당 2.85골 · 홈 승 44.6% · PK 0.22 · 세트피스 0.46 (`matchFeatures.test.ts` 가 범위 검사).
   - 선수별 지시 (`Tactics.instr`, 같은 포메이션일 때만): 공격 가담 · 수비 위치 유지 · 강한 압박 — 유닛 기여 · 체력 · 득점 · 카드 배율. 교체 선수도 자리 지시를 이어받음.
   - 키커 (`Tactics.takers`): 코너 · 프리킥 · 페널티, 없거나 교체되면 자동.
   - 포메이션 숙련도 (`ClubState.formFam`, `squad.ts famOf`): 경기한 포메이션 +5 · 나머지 −1 (30~100), 처음 원래 75 · 다른 50 · 내가 만든 30. 경기력 배율 0.94~1.0. AI 추천도 숙련도를 우대. 전술 · 경기 준비 화면에 막대.
0. **v0.5 튜토리얼 · 도움말** (2026-11-11): 처음 게임에 들어가면 화면을 비추며 기본 조작을 설명하는 튜토리얼 14단계 (`Tour.tsx`, `data-tour` 표식, 끝내면 이 브라우저에 기록).
   도움말 · 사용 설명서 10개 장 (`HelpDialog.tsx`, 첫 화면 메뉴 · 사이드바) · 튜토리얼 다시 보기. **기능을 바꾸면 도움말 설명도 같이 고칠 것.**
0. **v0.4.1 첫 화면 업데이트 소식** (2026-11-11): 마지막으로 본 버전 이후 내역을 하루 동안 표시 · 닫기 가능.

0. **v0.4 멀티 포지션 · 포지션별 능력 · 이벤트 결과 화면 · 새 이벤트** (2026-11-11)
   - 보조 포지션 (`ratings.ts altPositions`): 데이터(Wikidata, 약 12%) + 능력치로 추정 (가까운 자리 능력이 주 포지션과 1 이내, 최대 2개, 반대쪽 측면은 데이터 · 양발일 때만).
     주 · 보조 포지션은 능력이 깎이지 않고 그 밖 자리만 친숙도만큼 깎인다. 시즌마다 다시 정함. 선수 정보에 '포지션별 능력' 표 (스카우트 범위 반영).
     한계: 센터백은 데이터 능력치가 수비 위주라 풀백이 거의 안 붙는다 (예: 아라우호 RB 없음) → Wikidata 에 보조 포지션이 있어야 함.
   - 이벤트 팝업 (기자회견 · 이사회 · 논란 · 언론 플레이): 선택지의 효과 안내를 없애고, 고른 뒤 같은 자리에 결과를 문장으로 보여 줌 (`EventResult.tsx`, 기자회견은 숫자 없이 반응 문장).
   - 새 이벤트: 스폰서 제안(베팅 회사) · A매치 휴식기 해외 투어 · 자선 행사 · 선수단 미팅 요청(사기 낮을 때), 기자회견 질문 우승 경쟁/강등권 · 핵심 선수 장기 부상. 이사회 이벤트 확률 0.3→0.38, 간격 45→40일.
0. **v0.3 스카우트** (2026-11-11)
   - `engine/scout.ts`: 다른 구단 선수 능력치는 '앎'(0~100)만큼만 범위로 보임 (내 선수 100 · 같은 리그 · 능력 84+ 스타 40 · 나머지 20, 맞붙으면 경기마다 +6 · 70까지).
     앎 70+ 면 숨은 성향(프로의식 · 야망 · 충성 · 꾸준함 · 큰 경기 · 침착함 · 적응력 · 부상 경향) 공개, 95 면 정확.
   - 스카우트 보내기: 선수 한 명(같은 리그 7일 · 다른 리그 14일, 동시에 3명) · 리그 전체 관찰(28일, 앎 65). 비용은 매출 비례 (리버풀 기준 약 €40만~€70만 · 리그 €250만), 재정 '스카우트'.
   - 화면: 선수 정보(범위 막대 · 스카우트 상자 · 성향), 이적 목록(범위 · 가운데 값으로 정렬 · 능력 조건은 범위 위쪽 기준), 구단 선수단 · 경기 준비 상대 · 리그 주목 선수 · 협상 창.
   - 설정 → 난이도 '스카우트' 끄면 모두 정확히.
0. **v0.2 내 포메이션** (2026-11-11)
   - 전술 → 포메이션 '내 포메이션 + 만들기': 기본 포메이션을 본떠 자리마다 포지션 변경, 최대 6개 (`FormationEditor.tsx`, 세이브 `w.customFormations`).
   - 규칙 (`squad.ts validateFormation`): 수비 3~5 · 센터백 2~3 (2명이면 양쪽 풀백) · 같은 쪽 풀백/윙백 1 · 같은 쪽 측면 미드/윙어 1 · 중앙 미드 1+ · DM 2 · CM 3 · AM 3 · 스트라이커 1~3 · 공격 자원 5 이하.
   - AI 추천은 내 포메이션을 고르면 그대로 유지 (선수만 자동). AI 구단은 기본 포메이션만.
0. **웹 배포판 실명 데이터 넣기** (2026-11-11): 데이터베이스 화면에서 폴더 고르기 · 끌어다 놓기 → 브라우저(IndexedDB)에 저장 (`data/realStore.ts`, 전송 없음).

0. **무료 배포 · 파일 저장 · 명예의 전당** (2026-11-11)
   - GitHub Pages 배포 (위 '배포'). 배포판은 사진 기능 꺼짐(`import.meta.env.PROD`), 실명 문자열 0건 확인.
   - 파일 저장 (`store/save.ts`): gzip 압축 `.pitchboss` 내보내기 · 불러오기.
   - 명예의 전당 (`store/careers.ts`, `HallOfFame.tsx`): 이 PC의 감독 커리어 순위. 점수 = 챔스 12 · 1부 리그 10 · 유로파 6 · 2부 리그 4 · 국내 컵 4 · 시즌당 0.5.
0. **임대 · 역할 약속 · AI 감독 교체** (2026-11-11)
   - 임대 (`engine/loan.ts`, `LoanModal.tsx`): 주급 분담 50/75/100% · 임대료 · 완전 영입 옵션, 임대 보내기(후보 3곳), 시즌 시작 때 복귀. AI 구단도 21세 이하 유망주를 임대.
   - 역할 (`engine/roles.ts`): 핵심 · 주전 · 로테이션 · 유망주 · 백업. 계약 때 약속, 출전 기대치(사기)에 반영, 선수 화면에서 변경.
   - AI 감독 (`engine/coaches.ts`): 신뢰도 · 목표 대비 성적으로 경질(리그당 한 달 1명까지), 새 감독은 전술 성향이 바뀜, 공석 제안이 나에게 올 수 있음.
0. **이적시장 화면 · 인트로 · 사진 도구** (2026-11-11)
   - 이적시장: 필터 바꾸면 목록 맨 위로, 세부 포지션 여러 개 선택, 구단 검색.
   - 첫 화면 인트로 애니메이션 (`IntroScreen.tsx`, 브라우저를 닫기 전까지 한 번, 오른쪽 아래 '인트로 다시 보기').
   - 사진 수집 (`steps/photos.js`): `--league` 여러 개, 후보 8장, 이어 받기, 터미널 여러 개 동시 실행. `photos-ids` · `photos-import` 로 다른 곳에서 모은 사진 넣기.

0. **설정 · 데이터베이스 화면 · 이사회 요구 정리** (2026-11-10)
   - 설정 (`store/settings.ts` 이 PC 저장 + 게임 규칙은 `w.settings`, `engine/gameSettings.ts`): '계속'이 멈추는 곳(내 경기마다 · 중요한 일만 · 이적시장/시즌 끝),
     팝업 4종 빈도(끄기 · 드물게 · 보통 · 자주 — 끄면 `autoResolve.ts` 가 무난하게 자동 처리), 난이도(이사회 인내심 · 재정 규정 · 이적 협상, 내 구단만),
     경기 방식(직접 지휘 · 결과만) · 경기 속도, 자동 저장 간격, 글자 크기, 이름 표기(전체 · 짧은). 첫 화면과 게임 안 사이드바에서 연다.
   - 첫 화면 '데이터베이스' (`DatabaseDialog.tsx`): 실명 데이터 · 선수 사진 켜기/끄기 스위치 + 넣는 방법 · 수록 데이터.
   - 기자회견 35일에 한 번 · 시즌 3~4번. 이사회 '원하는 선수' · '판매 요구'는 이적시장 기간에만, 판매 요구는 큰 적자(매출 8%+) · 핵심 3명 제외.
0. **밸런스 점검 · 이름 정리** (2026-11-10)
   - 7시즌 점검(리버풀, 6개 리그) → 고친 것: 기자회견 21일에 한 번 · 열릴 확률 낮춤(시즌 5~8번), 재계약 제안은 계약 만료일까지 유효,
     **현금 상한**: 시즌 전환 때 잔고가 매출 60% 를 넘으면 넘는 돈의 60% 는 '구단주 배당 · 부채 상환'(모든 구단 같은 규칙) → 잔고/매출 중간 0.7대에서 안정,
     **FA 정리**: 시즌을 FA 로 넘긴 29세+ · 또는 22세+ 능력 62 미만 은퇴 → FA 약 1,000명에서 안정. 소속 오류 · GK 없는 구단 0건.
   - 이름: 한글 이름 없던 선수 10,107명 표기 추가(`data/locale/ko/players-5~10.json`, 실명 데이터 · Git 제외) → 18,901명 전원. 짝 검사(첫 자음 대조)로 밀림 없음 확인.
     구단 한글 이름 7곳(안코나 · 레겐스부르크 · 슈바인푸르트 · 지겐 · SPAL · 로이틀링겐 · 울름 -2 '풋볼'), 공개 데이터 다시 만듦.
0. **선수 언론 플레이 · 선수 논란** (커밋됨 23e9491)
   - 사가 (`saga.ts`): 연봉 인상 요구(시세 70% 미만) · 이적 요청(빅클럽 지목). 0 에이전트 발언 → 1 공개 인터뷰 → 2 훈련 불참 → 3 출전 거부.
     **태업(2 · 3단계)은 극히 드물게**: 프로의식 6↓ · 야망 14↑ · 충성 성향 8↓ 선수만, 이적시장 기간에, 25%. 지목 구단이 깎은 제안(단계마다 −7%).
     대응: 대화 · 약속 · 벌금 · 공개 비판 · 이적 허락. AI 구단 상위 3명도 이적시장에 같은 규칙(우리를 지목하면 원래 구단이 단계마다 10% 싸게 팖).
   - 논란 (`scandal.ts`): 게임이 만든 가벼운 논란만 (실제 사건 · 범죄 · 심각한 사생활 없음) — 클럽 사진 · SNS · 지각 · 동료 언쟁 · 감독 비판 · 교체 불만.
     기질 · 프로의식 낮을수록, 시즌 중 20일에 한 번까지(구단당 시즌 1~2건). 대응: 감싸기 · 징계 · 공개 비판 · 무시 · 중재. 기자회견 질문 · 사가 확률에 연결.
0. **감독 커리어 · 이사회 · 언론 · 시설 · 구단 메뉴 · 사진 · 실제 순위** (커밋됨 5739957)
   - 감독 (`manager.ts`): 3시즌 계약, 이사회 **신뢰도**(성적: 매달 목표 순위 비교 · 시즌 결과, 시즌 중 15 미만 · 시즌 끝 25 미만이면 경질),
     계약 마지막 해 3월 재계약 제안(신뢰도 45+), 다른 구단 **러브콜**(마지막 해 · 성적 · '다른 구단 제안 받기'면 자주, 수락하면 바로 이동),
     경질 · 만료 → 갈 구단 3곳 고르기(`pendingJob`, 진행 멈춤), 1시즌 넘게 함께한 충성도 높은 선수 0~2명이 따라옴(이적시장에 시장가). 감독 연봉 없음.
   - 이사회 (`board.ts`): **관계**(신뢰도와 별개) → 새 시즌 예산 ±15%, 요청(추가 이적 · 주급 예산, 시설 증축)에 **찬성 %**(관계 · 성적 · 재정 · 요구 크기 · 최근 거절), 같은 요청 30일에 한 번.
   - 팬 여론 · 갈등 (`boardEvents.ts`): 팬 여론은 기대 승점 대비 결과 · 큰 영입 · 핵심 판매 · 시즌 결과, 70+면 경질 기준 완화, 30-면 관계 하락, 내 구단 수입 ±5%.
     이벤트(선택지): 스타 판매 요구 · 유스 기용 요구(30일 약속) · 이사회가 원하는 선수(이적료 20% 지원) · 감독 교체 소문 · 팬 시위 + 우승 보너스 예산 · 구단주 교체(4%).
   - 기자회견 (`press.ts`): 큰 경기 이틀 전 · 대승/대패/이변 뒤 · 이사회 갈등 · 이적설, 10일에 한 번. 답변 → 사기 · 여론 · 관계 · 신뢰도. 도발하고 지면 여론 크게 −.
   - 시설 (`facilities.ts`): 훈련 시설 = 훈련 부하(체력 소모)에서 나오는 성장의 효율(×0.78~1.23) · 회복 ±2%/단계 — **강도 낮음이면 시설 보너스 없음**.
     유스 시설 = 유스 잠재력 평균 · 에이스 확률(1단계 1.7% · 3단계 3.9% · 5단계 6.7%). 투자: 매출 × 1.4%(유스 1%) × 단계, 공사 120~240일, 이사회 승인. 올린 단계는 데이터보다 안 내려감.
   - 구단 메뉴 (`ClubView.tsx`): 구단 정보 · 우승 기록(실제 + 게임) · 시즌별 순위 그래프 · 이사회 기대 · 재정 · 역대 출전/득점 · 감독 카드.
   - 새 게임 **완전 랜덤**(시즌 · 리그 · 구단) → 첫 시즌만 이적 +10% · 주급 +5% · 샐러리 캡 +5% (`w.randomBonus`).
   - 주급: 원하는 주급 = 같은 세계 비슷한 능력 선수 주급 중간값(시세표, `wageForAbility`) · 시즌 전환 때 AI 선수 실제 재계약 주급 반영 · 화면 '주급 여유' = 예산과 규정 중 좁은 쪽(이적료 상각 포함) · 예산 10% 여유(`WAGE_SLACK`) · 기본 샐러리 캡 80%.
   - 실제 최종 순위: `node tools/data_pipeline standings --apply` (위키백과 순위표, 구단 목록이 정확히 같을 때만) → 전 리그 · 전 시즌. 레겐스부르크 Q265570 은 순위표 매칭에만 인정(사용자 결정).
   - 선수 사진 (개인 PC 전용, `data/photos/` Git 제외): `node tools/data_pipeline photos [--club] [--season]` — 위키미디어 공용, 그 시즌 촬영 · 얼굴 인식(face-api)으로 그 선수 얼굴이 크고 선명한 사진.
     `tools/`에서 `npm i` 필요. 게임에서 사진 누르면 확대 · 후보 바꾸기 · **직접 넣기**(파일 · Ctrl+V · 주소) · 빼기 (`vite-photos.ts`). 공지: "선수 사진은 개인이 추가".
   - 그 밖: 대회 배지(리그 · 컵 · 챔스 · 유로파 · A매치 색), 킥오프 전 '홈으로', `publish` 가 `data-public/history` 를 지우지 않음.
   - 시험: manager · board · boardEvents · press · facilities 테스트, 전체 75개 통과.
0. **세계 대회 · A매치 차출** (커밋됨, 2026-11-10)
   - `national.ts`: 나라 → 대륙 연맹, 대표 선발 (23명 GK 3 · DF 8 · MF 8 · FW 4 / 26명), A매치 기간(9 · 10 · 11 · 3월 리그 휴식 주말)
     나라마다 상위 23명 차출 → 체력 −10~25 · 부상 1.5% · 경기 감각 +, 내 선수 차출 소식.
   - `worldcup.ts`: 2002부터 4년마다 시즌이 끝난 6~7월 (2022도 여름으로 단순화). 2002~2026 실제 참가국 · 조
     (`node tools/data_pipeline worldcups --apply` → `meta/worldcups.json`, 위키백과 대회별 대표 명단 문서), 그 뒤는 대표팀 전력 + 대륙 쿼터
     (32팀 UEFA 13 · CAF 5 · AFC 4 · CONMEBOL 4 · CONCACAF 3 + PO / 48팀 16 · 9 · 8 · 6 · 6 · OFC 1 + PO), 개최국 2030 스페인 · 포르투갈 · 모로코, 2034 사우디.
     조 추첨은 전력 포트 · 같은 연맹 한 조 1팀(UEFA 2팀). 32팀 16강 1A-2B 대진, 48팀 조 1 · 2위 + 3위 상위 8팀 → 시드 1 vs 32.
     대표팀은 경기용 구단 `nt-나라`(리그 'intl'), 유럽 리그 선수가 모자라면 '국내파' 가상 선수(retired 표시, 시즌 전환 때 `clearWorldCup` 이 지움).
     경기 기록은 `intlStats`, 구단 충성도 · 징계와 무관. 우승 출전 선수 수상 경력(wc) · 사기 +15, `w.worldCupHistory` (득점왕 포함).
     세계 대회가 7월까지 가면 다음 시즌 날짜를 되돌리지 않음. 화면: 순위 '대회' 줄 세계 대회 탭(조 · 녹아웃 · 우리 선수), 받은편지함 차출 · 대표 선발 · 우승, 선수 창 세계 대회 기록.
   - 시험: `worldcup.test.ts`, 10시즌 연속 진행(2026 · 2030 · 2034 세계 대회 포함) 문제 0건.
   - 이름: 실명 · 공개 데이터 모두 '세계 대회'.
0. **재정 개편 · 재정 규정 · 유스 · 훈련** (커밋됨 49516d6)
   - 원칙 (사용자 결정): 모든 구단은 수입이 있고 그 안에서 영입한다 — AI · 사용자 같은 규칙.
   - `finance.ts`: 모든 구단에 중계권 · 스폰서 · 입장 · 리그 상금 · 우승 보너스 수입과 주급 · 운영비(22%) 지출. 시즌 전환 때 잔고는 게임 속 돈을 이어가고
     예산은 `seasonBudgets` (AI · 사용자 같음). 매출 기준값 = 데이터 `finance.revenue`.
   - `rules.ts` 재정 규정 (샐러리 캡): 선수단 비용 = 연 주급 + 이적료 상각(이적료 ÷ 계약 연수). 리그 · 시대별 실제 규정 단순화 —
     UEFA (FFP 2011~, 선수단 비용 비율 90/80/70% 2023~), PL PSR 2013~ · 비율 85% 2026~, 챔피언십 P&S 2016~, 라리가 LCPD 2013~,
     이탈리아 70% 2025~, 독일 70% 2027~, 프랑스 DNCG(잔고 마이너스면 주급 증가 금지), 규정 없는 시대 기본 캡 70%.
     유럽 대회 구단은 리그 · UEFA 중 엄격한 쪽. `wageRoom` 에 규정을 합쳐 모든 화면 · AI 판정이 같은 기준. 재정 화면에 규정 · 사용률 표시.
   - `youth.ts` 유스: 데이터가 끝난 리그(다음 시즌 데이터 없음)에서 매 시즌 구단마다 2~4명, 16~18세. 숨은 잠재력 — 약 3% 86~94 · 약 10% 78~86,
     25세 무렵 잠재력 도달 (`growTowardPotential`). 이름은 같은 국적 선수의 이름 · 성 섞기 (한국어 이름도 같은 방식, `registerGeneratedNames`).
     10시즌 시험: 현역 약 3,700명 유지, 10시즌째 유스 출신 85+ 23명 · 최고 93.
   - 훈련비: 훈련할 때마다(매달 1일, 8~5월) 구단 돈을 쓴다 — 매출의 0.4 · 0.8 · 1.6% (강도 낮음 · 보통 · 높음, 연 4 · 8 · 16%). 운영비 22→14% (보통 강도면 합계 같음).
     잔고가 마이너스면 강도 낮음으로만. 재정 화면 지출에 '훈련비', 전술 화면 훈련 카드에 강도별 금액.
   - `training.ts` 훈련: 매달 1일(8~5월) 나이 · 프로의식 · 야망 · 출전 · 시설(명성) · 강도로 성장 → 육성 보정(growth, −6~+10).
     평균 선수는 거의 0 (실제 데이터가 성장을 담고 있으므로 차이만). 초점(균형 · 공격 · 수비 · 체력 · 기술), 강도(높음: 성장 ↑ · 회복 ↓ · 훈련 중 부상).
     전술 화면 '훈련' 카드, 선수 창에 훈련으로 바뀐 능력치 · 지난달 추세.
   - AI 재계약: 핵심 선수(구단 능력 18위 안 · 32세 이하) 85%, 나머지 40%.
   - AI 이적시장: 구단마다 하루 8% 확률로 영입 시도 (필요 포지션 · 25명 채우기는 '남은 주급 여유 ÷ 채울 자리' 안의 선수, 전력 보강은 25명 채울 여유를 남길 때만),
     26명 넘으면 같은 포지션 최약체 방출, 30명 넘으면 방출. 긴급 보강 25명까지 (자리당 주급, 20명 미만 · 골키퍼 없음이면 재정 규정 한도까지),
     그래도 못 데려오면 아카데미 선수를 최저 주급으로 승격 (골키퍼 우선). 주급 요구는 economy 규모 (`wageForAbility`: 능력 70 ≈ 2024년 주 €120K),
     자유계약 선수는 능력 기준. 강등되면 선수 주급 40% 삭감 (강등 조항). 다음 시즌 주급 예산 = 매출 기준 + 잔고의 8% (부자 구단은 더 쓴다).
     입장 수입은 홈 경기(리그 + 컵 · 유럽 평균 3)로 나누고 상대 배율 약 ±10%.
     10시즌 시험(2024-25~): 매 시즌 첫 경기일 · 시즌 끝 모든 구단 16명 이상 · 골키퍼 있음, 문제 0건. AI 구단 중간 인원 약 26명.
     남은 점: 부자 구단 잔고가 계속 쌓임 (규정 한도 때문에 선수단에 다 못 씀 — 현실과 비슷), 내 구단도 영입을 안 하면 쌓인다.
   - 데이터 정리 (에이전트, 2026-11-10): validate 오류 80 → 0. 동명이인 재연결 · 생일 통일 · 여자팀 선수 제거 · 골키퍼 보강 · 피사 · 바르셀로나 2019-20 추가 등.
     구단 나누기 (사용자 결정): 비첸차 Q8643 → `vicenza-1` (2000-01, 비첸차 칼초 1902) · Q56542463 → `vicenza-2`, 안코나 Q20706646 → `ancona-1` (2003-04) · Q289029 → `ancona-2`,
     지겐 Q97927375 → `sf-siegen-1` (2005-06) · Q609926 → `sf-siegen-2` (`club-aliases.json` Wikidata 번호 별칭 + `rename-club`).
   - 데이터 `economy` 단계 (`node tools/data_pipeline economy [--apply]`): 위키백과 Deloitte Football Money League 실제 매출(721개 구단 시즌) +
     추정 모델로 모든 리그 · 시즌 재정 · 명성 · 주급을 같은 기준으로. 저장 완료 (2026-11-10) · `publish` · `history` 다시 만듦 (공개 데이터에 ger2 포함).
0. **유럽 대회** (커밋됨) — 챔피언스리그 `ucl` · 유로파리그 `uel`, 게임 속 5개 나라 구단만으로 만든 16팀 축소판 (`europe.ts`)
   - 출전권: 지난 시즌 1부 게임 순위 (첫 시즌은 실제 지난 시즌 순위 `_league.json standings` → 없으면 명성 순).
     챔스 ENG 4 · ESP 4 · ITA 3 · GER 3 · FRA 2, 유로파는 그다음 ENG 3 · ESP 3 · ITA 4 · GER 3 · FRA 3. 국내 컵 우승팀은 유로파 마지막 자리.
     게임에 나라가 3개 미만이면 만들지 않음.
   - 조별리그 4개 조 (명성 순 포트, 같은 나라 같은 조 금지) → 8강 (조 1위 vs 다른 조 2위) · 준결승 2경기 합산 (동점이면 승부차기) → 결승 단판.
   - 일정: 챔스 화요일 · 유로파 목요일 (리그 앞뒤 하루 피함), 결승은 리그 끝난 뒤. 국내 컵은 유럽 대회 주간을 피한다.
   - 상금: 참가 · 조별 승무 · 8강 / 4강 / 결승 진출 · 우승 (2024 기준, 시대 보정 1.07^년). 우승 시 팬 +8% (유로파 +4%), 수상 경력 `euro`.
   - 기록은 국내 컵과 함께 `cupStats`. 우승 기록은 `w.cupHistory` (cup: 'ucl' · 'uel').
   - 화면: 순위 화면 두 번째 줄 '대회' 탭 (유럽 · 국내 컵), `EuroView` 조 순위표 + 녹아웃. 일정 '컨티넨탈 챔피언스 컵 · C조 1차전'.
   - 이름: 실명 데이터 'UEFA 챔피언스리그' 등, 공개 데이터 '컨티넨탈 챔피언스 컵' · '컨티넨탈 리그'. 테스트: `europe.test.ts`.
   - 함께 고침: 공개 데이터 `_league.json`의 `standings`에 실제 구단 ID가 남아 있던 문제 (publish가 변환하도록 수정, 25개 파일 수정).
   - 파이프라인: Wikidata 응답이 잘리면 재시도하고, 계속 잘리면 선수 묶음을 반씩 나눠 다시 조회 (`playerProfiles`).
0. **국내 컵 대회** (커밋됨)
   - `cup.ts`: 나라별 컵 (`eng-cup` 등, 이름은 `meta/leagues.json`의 `cups` · 공개 데이터는 가상 이름 `publish.js` `CUP_PARODY`).
     게임에서 경기하는 그 나라 1+2부 전 구단, 단판 녹아웃. 2의 거듭제곱이 아니면 하위 시드끼리 예비 라운드 · 상위 시드 부전승.
   - 일정: 9월 중순~5월 20일 수요일 중 리그 경기 앞뒤 하루를 피해 고르게. 다음 라운드는 앞 라운드가 끝나면 추첨 (`cupDay`).
     리그가 다르면 하위 리그 구단 홈, 비기면 바로 승부차기. 리그 · 컵 경기 목록은 `allFixtures(w)` 로 함께 다룬다.
   - 상금: 라운드 통과마다 (결승 우승 ENG €2.3M · GER €4.3M 등, 앞 라운드는 절반씩, 시대 보정). 장부 '상금 (리그 · 컵)'.
   - 컵 기록은 `cupStats` 로 리그 기록과 따로 (득점왕 · 평점 · 경고 누적은 리그만, 퇴장 징계는 공통).
   - 우승: 팬 +4%, 출전 선수 사기 · 충성도 · 수상 경력(`cup`), 내 구단이면 시즌 말 수상 연출. `w.cupHistory` 에 기록.
   - 화면: 순위 화면 컵 탭(라운드별 대진), 일정 '컵 · 16강', 받은편지함 통과 · 탈락 · 우승, 시즌 결산 컵 우승, 선수 창 컵 기록.
   - 테스트: `cup.test.ts`. 옛 세이브는 다음 시즌부터 컵이 생긴다.
1. **2부 리그 · 승강제 엔진** (커밋됨, 실제 2부 데이터 연결 전)
   - `pyramid.ts`: 나라 · 시대별 규칙. 잉글랜드 3강등/2승격+3~6위 PO, 스페인(2010~) · 이탈리아(2006~) 같은 방식,
     독일(2008~) 2+1부 16위 vs 2부 3위 승강 PO, 프랑스(2017~) 5위→4위→3위 사다리 PO 승자 vs 1부 16위.
   - 플레이오프 경기는 정규 시즌 뒤 자동 편성 (`Fixture.stage`, 순위표 제외), 동점이면 승부차기 (연장전 없음).
   - `startNextSeason`: 게임 순위 + PO 결과로 승강, 리그 크기는 실제 다음 시즌 데이터에 맞춤.
     2부에서 떨어진 구단은 `<리그>-lower` 대기(경기 없음). 2부 빈자리는 실제 3부 승격 구단 → 없으면 대기 구단 명성 순.
     3부가 없어 **2부 꼴찌의 내 구단만** 잔류 처리. 강등 시 명성 −5 · 예산 ×0.45, 승격 시 명성 +4 · 예산 ×2.
   - 순위표 구간 색 · 범례 · 플레이오프 패널, 경기 이름 (`roundLabel`), 시즌 결산에 내 구단 승강 표시.
   - 연 매출 기준을 주급 예산 범위로 제한 (강등 후 매출 하락). 시즌 종료 알림이 2번째 시즌부터 안 뜨던 버그 수정.
   - 테스트: `pyramid.test.ts` (다른 나라 1부 구단으로 만든 임시 2부로 검증).
2. 재계약 · 자동 재계약 · 재계약 요청 팝업, 시즌 말 이탈 소식, 떠난 선수 제안 정리 버그 수정 (`2997762`)
3. 수상 연출 · POM · 팬 · 이적 협상 개편 · 은퇴 소식 · 전체 검색 · 게임 계약 부여 (`0702815`)
4. 재정 · 호칭 시스템 (`631e9b8`), 이적 시스템 · 5개 리그 데이터 (이전 커밋들)
