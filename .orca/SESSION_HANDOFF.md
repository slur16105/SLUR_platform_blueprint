---
state: in-progress
owner: Claude + Dan
updated_at: 2026-07-22
active_workflow: bmad-dev-story (Epic 8 연속 실행)
blocked_on: "없음 — 논스톱 진행 중. Dan 확인 대기 항목은 아래 참조(진행을 막지는 않는다)"
---

# SLUR Platform Blueprint — 세션 핸드오프

## 지금 하고 있는 것

Epic 8(구매자 반응형 웹 전환)을 **논스톱으로 실행 중**이다. Dan의 지시: 중요한 의사결정이 필요 없으면 멈추지 말고, 병행 가능한 작업은 같이 돌린다.

| 스토리 | 상태 |
|---|---|
| 8.1 구매자 웹 셸·반응형 기반 | **구현 완료 · 프로덕션 검증 통과.** 남은 검증 2건은 사람 필요 |
| 8.2 구매자 가입·로그인 | 스토리 완료 · **구현 중** |
| 8.3 상품목록·상품상세 | 스토리 완료 · 구현 대기 |
| 8.4 장바구니 | **스토리 작성 중** |
| 8.5~8.8 | 대기 |

## 완료된 것 (Epic 8 이전 단계)

코스 코렉션 → PRD·브리프·에픽 갱신 → 아키텍처 스파인 개정(AD-14 신설) → UX 최초 실행(시안 3안 → 톤 B 확정 → 전 9화면 → DESIGN.md·EXPERIENCE.md 스파인) → Epic 8 정의(스토리 8개·UX-DR 16개) → 반응형 규칙 확정·렌더 검증. 전부 커밋·푸시됨.

## 8.1 검증 결과

- `tsc` 0 · `lint` 0 · `next build` 성공(35 라우트) · URL 변경 0건
- `apps/api`·`apps/mobile`·`styles/slur` 변경 **0건**
- **프로덕션 검증 통과** (`https://web-production-abfe1.up.railway.app`, 2026-07-22):
  `/` 200(구매자 홈 공개) · `/products/abc` 404(리다이렉트 아님 = 미들웨어 미실행) ·
  `/cart`·`/orders`·`/me` → 307 `/login?next=…` · `/seller`·`/admin`·`/apply` → 307 `/login`(next 없음, 기존 동작 그대로) ·
  `Location`이 전부 공개 호스트 → **회고 R3 완료 조건 충족**
- 포커스 링 computed 값 대조로 전역 토큰 무변경 증명

**8.1에 남은 검증 2건 — 사람 필요**
- Task 9: 관리자·판매자 **실제 계정 로그인** 후 8개 화면 색·레이아웃 육안 확인, 양 표면 Tab 키 이동
- Task 10: 창 폭 드래그 시 상태 유지 실측 (구조적으로는 `matchMedia`·`resize` 0건으로 보장)

## Dan의 확인이 필요한 사항 (진행을 막지는 않는다)

1. 🚨 **`KAKAO_REDIRECT_URIS`가 Railway에 미선언** — 백엔드가 localhost 기본값만 allowlist로 쓴다. **이 상태로는 프로덕션 카카오 로그인이 100% 실패.** 카카오 개발자 콘솔에 로컬·프로덕션 두 URI 등록 + Railway 변수 추가(R1대로 `--set` 후 즉시 확인, `railway.ts`에도 동시 선언)
2. **[오픈 게이트] 약관 동의 이력이 서버에 남지 않는다** — `SignupRequest`·`users`에 동의 필드가 없다. 8.2가 화면에서 강제하지만 기록이 없다. ERD 변경이라 Epic 8 경계 밖 → 법률 검토에 "보관이 법적으로 요구되는가"를 함께 올림
3. **[오픈 게이트] 중개자 고지 문구** — 스파인의 축약형을 프로덕션 가동 문구(`BROKER_NOTICE`)에 맞춰 정정하고 정본을 코드 상수로 못 박았다. 문구 자체의 법적 적정성은 미검토
4. 스파인 2종(`DESIGN.md`·`EXPERIENCE.md`) `status: draft` — 검토 후 `final` 전환 가능

## 등재된 부채 (deferred-work.md, Epic 8 절)

위 1~3 + `바로 구매`의 목적지가 백엔드에 없음(주문이 `cart_item_ids` 기반 — 8.4·8.5가 알고 설계) + `middleware.ts` deprecated(Epic 8 완료 후 `proxy.ts` rename) + `/terms`·`/privacy`가 구매자 톤이 아님

## 환경 제약 (반복 확인됨)

- `apps/web`에 **테스트 프레임워크 없음** — 단위 테스트 도입은 의존성 추가라 스토리 범위 밖. 검증은 `tsc`·`lint`·`next build`·실제 렌더·프로덕션 curl
- 이 머신에 **`uv`·`docker` 없음** → `apps/api` pytest 실행 불가, 로컬 백엔드도 못 띄운다. 백엔드 무변경 증거는 `git diff --stat`의 `apps/api` 0건. **통과했다고 쓰지 않는다**
- `railway` CLI 없음
- Chrome 헤드리스가 최소 500px 뷰포트를 강제 — 390px은 미디어쿼리 값으로 대조

## Git / 원격 상태

`main`, `origin/main`과 동기. 푸시는 HTTP/2에서 500이 나서 `http.version HTTP/1.1`을 로컬 설정에 박아뒀다(`git push`로 그냥 됨).

## 다음 액션

8.2 구현 완료 → 검증·커밋 → 8.3 구현 → 8.4 구현 → 8.5~8.7 스토리·구현 → 8.8(Flutter 보관·제거, **태그 원격 푸시 확인 후에만**) → Epic 8 회고.

## 세션 종료 시 반드시 갱신할 항목

- `state`: `ready` / `blocked` / `in-progress`
- 완료한 작업과 검증 결과
- Git commit / push 상태
- 다음 BMAD 스킬과 구체적 다음 액션
- Dan의 결정이 필요한 사항
