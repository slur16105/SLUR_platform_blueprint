---
title: 스프린트 변경 제안 — 구매자 표면을 반응형 웹(PWA)으로 전환
status: proposal (Slur 승인 대기)
created: 2026-07-21
workflow: bmad-correct-course
input: course-correction-buyer-web-2026-07-21.md (진단), Slur 결정 Q1·Q2·Q3
---

# 스프린트 변경 제안 — 구매자 표면을 반응형 웹(PWA)으로 전환

> **범위 제한 (이번 문서에서 하지 않는 것)**: Flutter 삭제, DB/ERD 변경, 배포, PRD 밖 구현.
> 이 문서는 **변경 계획과 영향 분석**까지다. 실제 편집은 승인 후 후속 워크플로우가 수행한다.
> **테스트 실행 없음** — 코드를 건드리지 않았으므로 직전 상태(API 153/153 통과, `20c6d45`) 그대로다.

---

## 1. 이슈 요약

### 문제 진술

구매자 표면이 Slur의 원래 의도(**모바일 퍼스트 반응형 웹 + 하이브리드 웹앱**)가 아니라
**Flutter 네이티브 앱**으로 구현되어 Epic 1~6 전체가 완료됐다.

### 이슈 유형

**원 요구사항의 오해(Misunderstanding of original requirements)** — 전략적 피벗도, 기술적 한계 발견도 아니다.
프로덕트 브리프(2026-07-14) `brief.md:38`의 `구매자 (Flutter, 모바일 퍼스트)`에서
"모바일 퍼스트"가 *반응형 웹*이 아닌 *네이티브 앱 우선*으로 해석되어 굳었고, 재확인 없이
PRD(`prd.md:14, 27, 37`) → 아키텍처 스파인 → Epic 1~6으로 전파됐다.

### 발견 경위와 증거

| 증거 | 확인 내용 |
|---|---|
| `apps/web/app/` 라우트 31개 | `admin`·`seller`·`login`·`apply`·`terms`·`privacy`·`no-role` — **구매자 화면 0개** |
| `apps/mobile/lib` dart 21개 | 구매자 표면 8화면 + 서비스정보가 전부 여기 |
| `epics.md:88` | "UX 설계 문서 없음 … Flutter는 표준 Material 기반" — **bmad-ux 미실행, UX 산출물 0건** |
| 슬러 디자인 시스템 | `apps/web/app/styles/slur/` 토큰 7 + 컴포넌트 7 — 판매자·관리자 화면에만 적용됨 |
| 배포 파이프라인 | Railway는 `apps/api`·`apps/web`만 배포. `apps/mobile` 참조 **0건** |

Slur가 요청했던 두 가지(반응형 웹 + 슬러 시각 시안)가 정확히 비어 있는 자리다.

### 확정된 결정 (2026-07-21, Slur)

- **Q1 → (C)** v1은 Next.js 반응형 웹 PWA로 완주. 스토어 출시가 실제로 필요해지는 시점에만 Capacitor WebView 래퍼를 덧씌운다.
- **Q2 → (A)** `apps/mobile`은 보존 태그를 만든 뒤 main에서 제거한다. (실행은 승인 후 별도 단계)
- **Q3 → (A)** 핵심 3화면(상품목록·상품상세·장바구니) × 3안. 시안은 **실제 HTML/브라우저 렌더 결과**로 준비 — 한국어 텍스트가 정확히 보이는 실물이어야 한다.
- **운영 레인**: solo main 단일 레인. 워크트리 분기 없음.

---

## 2. 체크리스트 실행 결과 (change-navigation-checklist)

### 섹션 1 — 트리거와 맥락

| ID | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1.1 | 트리거 스토리 식별 | [x] | 개별 스토리가 아님. Epic 1~6 완료 후 **Slur의 직접 확인**이 트리거 (`dda23c1` 진단) |
| 1.2 | 문제 정의·유형 분류 | [x] | 원 요구사항 오해 — §1 |
| 1.3 | 영향·증거 수집 | [x] | §1 증거표 |

### 섹션 2 — 에픽 영향 평가

| ID | 항목 | 상태 | 결과 |
|---|---|---|---|
| 2.1 | 현재 에픽 완료 가능성 | [x] | Epic 1~6은 이미 `done`. **되돌리지 않는다** — 백엔드·판매자·관리자는 전량 유효 |
| 2.2 | 에픽 수준 변경 | [!] | **신규 Epic 8 추가** (구매자 반응형 웹). 기존 에픽은 상태 유지 + 이력 주석 |
| 2.3 | 잔여 에픽 영향 | [!] | **Epic 7(PG 초안) 영향** — 스토리 `7.4 Flutter 결제 플로우`가 무효. 웹 결제 플로우로 재작성 필요 |
| 2.4 | 무효화/신규 필요 | [x] | 무효화되는 에픽 없음. 신규 1건(Epic 8) |
| 2.5 | 순서·우선순위 | [!] | **Epic 8이 Epic 7보다 선행**해야 한다 (근거 §3.5) |

### 섹션 3 — 아티팩트 충돌 분석

| ID | 대상 | 상태 | 충돌 지점 |
|---|---|---|---|
| 3.1 | PRD | [!] | `prd.md:14, 27, 31, 37` 플랫폼 기술 4곳. **FR-1~35 요구사항 본문은 클라이언트 중립 — 변경 불필요** |
| 3.1 | 브리프 | [!] | `brief.md:14, 26, 38, 56, 60` 5곳 |
| 3.2 | 아키텍처 스파인 | [!] | `ARCHITECTURE-SPINE.md:7, 43, 130, 148, 168, 180, 250, 260, 261` 9곳. **AD-1~AD-13 불변식은 전부 그대로 성립** — 클라이언트 종류에 의존하지 않는 설계였다 |
| 3.3 | UX 사양 | [!] | **산출물 자체가 없음**. Epic 8 착수 전 `bmad-ux` 최초 실행이 선행 조건 |
| 3.4 | 부차 아티팩트 | [x] | 배포·CI·마이그레이션·테스트 전략 **영향 없음** (Railway는 api·web만 배포, `apps/mobile` 참조 0건) |

### 섹션 4 — 경로 평가

| 옵션 | 판정 | 근거 |
|---|---|---|
| 1. Direct Adjustment | **[일부 채택]** | 기존 에픽 구조를 유지한 채 신규 Epic 8로 구매자 표면을 재구축. 노력 **High** / 리스크 **Low** |
| 2. Rollback | **[일부 채택]** | 되돌릴 대상은 **`apps/mobile` 하나뿐**. 백엔드·웹은 롤백 근거 없음. 노력 **Low** / 리스크 **Low** (태그 보존 시) |
| 3. MVP 재검토 | **[불채택]** | MVP 범위(구매자 8화면)는 변하지 않는다. 바뀌는 것은 **표면 기술뿐**. 화면 목록·FR 목록 모두 유지 |

**선택: 하이브리드 (1 + 2)** — 신규 Epic 8로 구매자 표면 재구축 + `apps/mobile` 한정 롤백.

**정당화**
- FastAPI가 모든 로직을 소유(NFR-1/AD-1)한 덕분에 **재작업이 표현 계층에 갇힌다**. 도메인 로직·DB·API 계약은 한 줄도 건드리지 않는다.
- 구매자 웹은 이미 존재하는 BFF 패턴(`apps/web/lib/auth.ts`의 `proxyWithRefresh`, httpOnly 쿠키 + refresh 회전)을 그대로 재사용한다 — 인증 설계를 새로 하지 않는다.
- Flutter를 병존시키면 두 클라이언트 유지 비용이 "완주" 목표를 직접 갉아먹는다 (판정 기준: "완주에 기여하는가" → 병존은 기여하지 않음).
- 반대로 즉시 삭제는 구매자 8화면의 검증된 플로우·에러 처리·문구를 버리는 것이다. **보존 태그**가 그 손실을 0으로 만든다.

### 섹션 5·6 — 제안 구성과 핸드오프

| ID | 항목 | 상태 |
|---|---|---|
| 5.1~5.5 | 이슈 요약·영향·경로·MVP 영향·핸드오프 | [x] 본 문서 §1~§6 |
| 6.1~6.3 | 검토·정확성·승인 | [!] **Slur 승인 대기** |
| 6.4 | `sprint-status.yaml` 갱신 | [!] 델타 §5.5에 명시. **승인 후 적용** |
| 6.5 | 다음 단계 확정 | [x] §6 |

---

## 3. 영향 분석

### 3.1 유지 — 변경 없음

| 영역 | 근거 |
|---|---|
| FastAPI 백엔드 전량 (인증·RBAC·상태 전이·재고·주문) | 클라이언트 중립. AD-1/NFR-1이 이미 이를 보장 |
| DB 스키마·마이그레이션 (18테이블 ERD) | **ERD 변경 0건** — 표면 기술은 스키마에 닿지 않는다 |
| 구매자 API 12개 엔드포인트 | `products` 3 · `carts` 4 · `orders` 5 — 전부 그대로 소비 가능 |
| 판매자·관리자 Next.js 화면 | 영향 없음 (단 §3.4의 role 쿠키 회귀 위험 1건 주의) |
| API 테스트 153건 | 전량 유효. Epic 8은 여기에 테스트를 추가하지 않는다 (프론트 전용) |
| 배포 파이프라인 | Railway = api + web. mobile 참조 0건이라 제거해도 무변화 |

### 3.2 재작업 — 구매자 표면 9화면

Flutter → Next.js 재구현 대상 (기능 동등, 표현 재설계):

| Flutter 파일 | 대응 웹 라우트(제안) | FR |
|---|---|---|
| `screens/login_screen.dart` | `/login` (구매자 분기 추가) | FR-1, FR-2 |
| `screens/signup_screen.dart` | `/signup` (**웹에 없음, 신규**) | FR-1, FR-4 |
| `screens/home_screen.dart` | `/` 또는 `/shop` (상품목록·카테고리 탭) | FR-34, FR-8 |
| `products/product_detail_screen.dart` | `/products/[id]` | FR-9, FR-10, FR-32 |
| `carts/cart_screen.dart` | `/cart` | FR-35, FR-14 |
| `orders/order_preview_screen.dart` | `/checkout` | FR-16, FR-17 |
| `orders/order_complete_screen.dart` | `/orders/complete` | FR-18, FR-23 |
| `orders/order_history_screen.dart` | `/orders` | FR-22 |
| `orders/order_detail_screen.dart` | `/orders/[id]` | FR-22, FR-21, FR-18(취소) |
| `screens/service_info_screen.dart` | 기존 웹 푸터·`/terms`·`/privacy`로 흡수 | FR-31, FR-33 |

지원 파일(재구현 아닌 이식): `api/client.dart`(→ BFF 라우트), `auth/auth_*.dart`(→ 기존 `lib/auth.ts`),
`format.dart`·`orders/order_display.dart`(→ 표시 로직 유틸), `config/company.dart`·`policy_texts.dart`(→ 웹에 이미 존재).

### 3.3 기술 전환 매핑 (교체가 필요한 의존성)

| Flutter 수단 | 웹 대체 | 난이도 |
|---|---|---|
| `flutter_secure_storage` (Android Keystore) | **httpOnly 쿠키 + BFF** — 이미 구현됨 (`lib/auth.ts`) | 없음 (재사용) |
| `dio` 클라이언트 | Next.js Route Handler 프록시 (`proxyWithRefresh`) | 낮음 (패턴 존재) |
| `kakao_flutter_sdk_user` (네이티브 로그인) | **카카오 인가코드 리다이렉트** → 기존 `POST /api/v1/auth/kakao` | 중 (웹 리다이렉트 플로우 신규, 단 API는 이미 존재) |
| `kpostal` (우편번호 검색) | Daum 우편번호 서비스 JS | 낮음 (웹이 원산지) |
| `flutter_riverpod` | React 상태(서버 컴포넌트 + 클라이언트 훅) | 낮음 |
| Material 위젯 | 슬러 시스템 CSS (토큰·컴포넌트 기존) + **모바일 퍼스트 확장 필요** | 중 |

**주목**: `POST /api/v1/auth/kakao`(인가코드 방식)가 이미 API에 존재한다 — 웹 리다이렉트 플로우용으로 설계돼 있었으나
지금까지 웹에서 미사용이었다(웹은 `auth/kakao/native`가 아닌 이 경로를 쓴다). 백엔드 신규 작업 없음.

### 3.4 회귀 위험 — 판매자·관리자 웹에 닿는 지점 1건

`apps/web/app/api/auth/login/route.ts:44`는 역할 힌트 쿠키를 `admin | seller | none` 3값으로 계산하고,
`middleware.ts`는 `none`을 `/no-role`로 보낸다. **즉 현재 구매자가 웹에 로그인하면 `/no-role`로 튕긴다.**

Epic 8은 여기에 `buyer`를 도입하고 로그인 후 라우팅을 분기해야 한다 —
**기존 판매자·관리자 라우팅을 건드리는 유일한 지점이므로, 이 변경만은 실기 회귀 확인이 필요하다.**

### 3.5 Epic 7(PG)과의 순서 — 선행 관계 역전

`epic-7-pg-draft-2026-07-20.md:49`의 스토리 `7.4 Flutter 결제 플로우 (주문서 → 결제 → 완료)`는
전환과 함께 **무효**가 된다. 나아가 PG 결제창 연동은 클라이언트 표면에 강하게 종속되므로:

> **Epic 8(구매자 웹)을 Epic 7(PG)보다 먼저 완료해야 한다.**
> 웹 결제 플로우가 없는 상태에서 PG를 붙이면, 붙이는 대상이 곧 삭제될 Flutter가 된다.

Epic 7은 현재 견적 대기(A-E456-3)로 실행 대기 상태이므로, 이 순서 변경에 **일정 손실이 없다**.
오히려 PG 벤더의 웹 SDK/리다이렉트 방식이 앱 방식보다 단순해 Epic 7 자체가 가벼워진다.

### 3.6 MVP 영향

**MVP 범위는 변하지 않는다.** 구매자 8화면, FR-1~35, v1 제외 목록 모두 유지.
바뀌는 것은 §4의 플랫폼 기술 서술뿐이다. 오픈 게이트 항목(PG·법률 검토·사업자 신고·판매자 확보)도 그대로다.

단, **오픈 게이트에 1건 추가**를 제안한다:
- `iOS 출시`가 v1 제외 목록에 있으나, 반응형 웹은 **iOS 사파리에서 즉시 동작**한다.
  즉 이 전환은 iOS 커버리지를 부작용으로 획득한다. v1 제외 목록에서 `iOS 출시`의 의미를
  "**네이티브 iOS 앱 스토어 출시** 제외"로 좁혀 기술해야 오해가 없다.

---

## 4. 신규 Epic 8 제안 — 구매자 반응형 웹 (PWA)

> 상세 스토리 문서는 승인 후 `bmad-create-epics-and-stories`가 생성한다. 아래는 분해 초안이다.

**선행 조건**: `bmad-ux` 최초 실행 완료 + Slur의 시안 선택 (§6 1단계)

| # | 스토리 | 핵심 내용 | 위험 |
|---|---|---|---|
| 8.1 | 구매자 웹 셸·반응형 기반 | 모바일 퍼스트 레이아웃(헤더·하단 내비), 슬러 토큰 모바일 확장, 뷰포트, 구매자 BFF 프록시 골격 | 낮음 |
| 8.2 | 구매자 가입·로그인 | `/signup` 신규, 카카오 웹 인가코드 플로우, **role 쿠키 `buyer` 도입 + 로그인 후 분기** | **중 — §3.4 회귀** |
| 8.3 | 상품목록·상품상세 | 카테고리 필터 탭, 옵션 조합 선택·품절 표기, 판매자 신원정보 노출(FR-32) | 낮음 |
| 8.4 | 장바구니 | 조합 단위 담기·수량·삭제, 구매 불가 항목 표시·제외(FR-35) | 낮음 |
| 8.5 | 주문서·주문 생성 | Daum 우편번호, 배송비 미리보기 재조회, 도서산간 판정, 주문완료·입금 안내 | 중 (미리보기 경합 재현) |
| 8.6 | 주문내역·주문상세·취소 | 판매자별 배송 상태, 송장 표시, 묶음 단위 자유취소 | 낮음 |
| 8.7 | PWA 셸 | `manifest.json`, 아이콘, service worker(최소 캐시), 설치 유도 | 낮음 |
| 8.8 | Flutter 정리 | 보존 태그 생성 → main에서 `apps/mobile` 제거 → 문서·`deferred-work` 정리 | 낮음 |

**8.8의 실행 규약 (승인 후에만)**
```
git tag flutter-app-final -m "구매자 Flutter 앱 최종 상태 (반응형 웹 전환 전 보존)"
git push origin flutter-app-final     # 태그 푸시 확인 후에만 제거
git rm -r apps/mobile
```
태그는 **원격 푸시 확인 후** 제거를 진행한다. 로컬 태그만으로 삭제하지 않는다.

**Capacitor 래퍼 (Q1-C의 후반부)** — v1 범위 **밖**. 스토어 출시 필요가 실제로 발생하면
Epic 8 완료 이후 별도 에픽으로 다룬다. 웹 코드가 동일해 그 시점 전환 손실은 0이다.

---

## 5. 상세 변경 제안 (before → after)

> 모두 **승인 후 후속 워크플로우가 적용**한다. 이 문서 단계에서는 편집하지 않는다.

### 5.1 PRD — `prds/prd-.../prd.md` (4곳)

**① `prd.md:14` (§1 개요)**
```
OLD: … 구매자는 Flutter 모바일 앱(**Android 먼저 출시, iOS는 이후**)을, 판매자·관리자는
     Next.js PC 웹(단일 앱, Role 분기)을 쓴다.
NEW: … 구매자는 Next.js 모바일 퍼스트 반응형 웹(PWA — 설치 가능, 스토어 심사 없음)을,
     판매자·관리자는 같은 Next.js 앱의 PC 웹 화면(Role 분기)을 쓴다.
```
근거: 2026-07-21 Slur 결정 Q1-C.

**② `prd.md:27` (§3 사용자 표)**
```
OLD: | 구매자 | 여성 비중 높음 | Flutter 앱 (Android 먼저) |
NEW: | 구매자 | 여성 비중 높음 | 반응형 웹 (모바일 퍼스트, PWA 설치 가능) |
```

**③ `prd.md:31` (계정 모델)**
```
OLD: … Flutter 앱과 PC 웹에 동일 자격증명으로 로그인한다.
NEW: … 구매자 화면과 판매자·관리자 화면에 동일 자격증명으로 로그인한다.
```

**④ `prd.md:37` (§4 v1 기준선)**
```
OLD: - **구매자 (Flutter)**: 로그인 · 회원가입 · 상품목록 · …
NEW: - **구매자 (Next.js 반응형 웹)**: 로그인 · 회원가입 · 상품목록 · …
```
화면 목록 자체는 **불변**.

**⑤ `prd.md:48` (v1 제외) — 문구 명확화**
```
OLD: … 정산 · iOS 출시 · 네이버/구글 로그인 …
NEW: … 정산 · 네이티브 앱 스토어 출시(iOS·Android) · 네이버/구글 로그인 …
```
근거: §3.6 — 반응형 웹은 iOS 사파리를 자동 커버하므로 "iOS 제외"는 오해를 부른다.

**⑥ `prd.md:130` (NFR-1)**
```
OLD: … Flutter·Next.js는 FastAPI API만 호출하고 …
NEW: … 모든 클라이언트(Next.js 웹, 향후 WebView 래퍼)는 FastAPI API만 호출하고 …
```

**⑦ §11 ASSUMPTION 색인 — 행 추가**
```
| 전환 | 구매자 표면 = 반응형 웹 PWA (2026-07-21 코스 코렉션). Capacitor 래퍼는 스토어 필요 시 | Slur 확정 |
```

### 5.2 프로덕트 브리프 — `briefs/brief-.../brief.md` (5곳)

브리프는 **final 상태의 역사 문서**다. 본문을 덮어쓰기보다 **정오표 블록 추가 + 해당 줄에 각주 표시**를 제안한다.
분기의 원인이 브리프 문구였으므로, 그 문구를 지우면 왜 어긋났는지가 사라진다.

```
NEW (브리프 상단 status 블록 아래 삽입):
> **[2026-07-21 정정]** 본 브리프의 "구매자 (Flutter, 모바일 퍼스트)"는 Slur의 원 의도
> (모바일 퍼스트 **반응형 웹**)와 다르게 굳은 표현이다. 구매자 표면은 Next.js 반응형 웹 PWA로
> 확정 전환됐다 — `sprint-change-proposal-2026-07-21.md` 참조. 아래 본문의 Flutter 서술
> (14·26·38·56·60행)은 **당시 기록으로 보존**하며 현행 아님.
```

### 5.3 아키텍처 스파인 — `ARCHITECTURE-SPINE.md` (9곳)

**불변식(AD-1~AD-13)은 전부 유지된다.** 변경은 서술·다이어그램·스택 핀에 한정.

| 행 | OLD → NEW |
|---|---|
| 7 (scope) | `Flutter 구매자 앱, Next.js 판매자·관리자 웹` → `Next.js 단일 웹(구매자 반응형 + 판매자·관리자 PC)` |
| 43 (AD-1 Rule) | `Flutter·Next.js는` → `모든 클라이언트는` |
| 130 (Prevents) | `Flutter와 Next.js가 같은 주문의…` → `여러 화면이 같은 주문의…` |
| 148 (프론트) | `Flutter 상태관리는 Riverpod 3` 삭제, `구매자 화면은 모바일 퍼스트 반응형 + PWA` 추가 |
| 168 (버전표) | `Flutter / Dart 3.44 / 3.12` 행 제거 |
| 180 (다이어그램) | `FL[Flutter 앱<br/>Android 먼저]` → `WB[반응형 웹 PWA<br/>구매자]` |
| 250 (F8 매핑) | `Next.js·Flutter 정적` → `Next.js 정적` |
| 260 (Deferred) | `iOS 빌드·Apple 로그인` → `네이티브 스토어 출시(Capacitor 래퍼)·Apple 로그인` |
| 261 (Deferred) | `프론트 상세 폴더 구조 (Next.js/Flutter)` → `(Next.js)`. **웹 토큰 보관 방식은 이미 확정(httpOnly 쿠키)** 이므로 해당 문장 해소 표기 |

**신규 AD 1건 제안 — AD-14 (클라이언트 표면 단일화)**
```
- Rule: 구매자·판매자·관리자는 하나의 Next.js 앱에서 Role로 갈린다. 구매자 라우트는
  모바일 퍼스트 반응형, 판매자·관리자 라우트는 PC 폭 기준. 인증은 세 역할 모두
  동일한 BFF(httpOnly 쿠키 + refresh 회전) 경로를 쓴다.
- Prevents: 역할별로 인증·API 호출 방식이 갈라져 토큰 보관이 두 벌이 되는 것.
```
※ 스파인 개정은 Slur 승인 게이트 대상이다 (Epic 7 AD-2 개정과 동일 규약, A-E456-7).

### 5.4 에픽 — `epics.md`

**① `epics.md:67` 스택 핀**
```
OLD: … Next.js 16.2(App Router), React 19.2, Flutter 3.44/Dart 3.12+Riverpod 3, Supabase PG17
NEW: … Next.js 16.2(App Router), React 19.2, Supabase PG17
```

**② `epics.md:88` UX 요구사항 — 전면 교체**
```
OLD: UX 설계 문서 없음 — Next.js 화면은 슬러 시스템 스킬(slur-ux·slur-design)을 구현 시 적용.
     Flutter는 표준 Material 기반. (별도 UX-DR 없음)
NEW: 구매자 화면은 bmad-ux 산출물(2026-07 실행)을 따른다 — 핵심 3화면(상품목록·상품상세·장바구니)
     3안 중 Slur 선택안이 톤의 기준이며, 나머지 화면은 그 톤으로 전개한다.
     전 화면에 슬러 시스템(slur-ux·slur-design)을 적용한다.
```

**③ Story 1.5 (`epics.md:238~248`) — 이력 주석**
```
NEW (제목 아래 삽입):
> **[2026-07-21 대체됨]** Flutter 로그인 화면은 반응형 웹 전환으로 폐기. 후속은 Story 8.2.
> 구현 기록은 태그 `flutter-app-final`에 보존.
```
Story 3.5·4.1·4.2·5.1의 Flutter 서술 행(392·397·471·646·650)에도 동일 형식의 대체 주석.
**완료 상태(`done`)는 되돌리지 않는다** — 당시 실제로 완료됐던 사실이다.

**④ Epic 8 신설** — §4 표를 정식 스토리 형식으로 전개 (`bmad-create-epics-and-stories` 담당)

### 5.5 스프린트 상태 — `implementation-artifacts/sprint-status.yaml`

```yaml
# 추가 (development_status 하단)
  # Epic 8: 구매자 반응형 웹 전환 (2026-07-21 코스 코렉션 승인)
  epic-8: backlog
  8-1-buyer-web-shell: backlog
  8-2-buyer-auth-web: backlog
  8-3-buyer-product-browse-web: backlog
  8-4-cart-web: backlog
  8-5-checkout-web: backlog
  8-6-order-history-web: backlog
  8-7-pwa-shell: backlog
  8-8-flutter-removal: backlog

# 액션 아이템 추가
  - { id: A-CC1, epic: 8, status: open, owner: "Claude+Slur", action: "bmad-ux 최초 실행 — 핵심 3화면×3안 HTML 시안, Slur 선택" }
  - { id: A-CC2, epic: 8, status: open, owner: "Claude", action: "PRD·브리프·스파인·epics 문서 갱신 (본 제안 §5.1~5.4)" }
  - { id: A-CC3, epic: 7, status: open, owner: "Claude", action: "Epic 7 초안의 7.4 Flutter 결제 플로우 → 웹 결제 플로우로 재작성. Epic 8 이후 착수" }

# A-E456-1 갱신
  - { id: A-E456-1, …, action: "실기 검증 일괄 세션 — 판매자·관리자 전 플로우 (구매자 앱 플로우는 Epic 8로 대체되어 제외)" }
```

### 5.6 부채 문서 — `deferred-work.md`

- `deferred-work.md:9` Flutter cart_screen 항목 → **소멸 처리** (Epic 8.8과 함께)
- `deferred-work.md:77` 사업자 실정보 교체 → `앱 lib/src/config/company.dart` 부분 제거, 웹 `app/config/company.ts`만 유지
- `deferred-work.md:79` 앱 `WEB_BASE_URL` 주입 → **소멸** (웹 단일 표면이므로 불필요)

---

## 6. 구현 핸드오프

### 변경 규모 분류: **Major (근본 재계획)**

에픽 신설 + PRD·브리프·아키텍처 스파인 개정 + 에픽 순서 변경이 동시에 걸린다.
단, **위험은 Low** — 도메인 로직·DB·API 계약이 무손상이기 때문이다.
"큰 변경, 낮은 위험"은 AD-1(FastAPI 단일 소유)의 배당금이다.

### 실행 순서 (각 단계는 새 컨텍스트 창 권장, solo main 단일 레인)

| # | 단계 | 워크플로우 | 산출물 | Slur 게이트 |
|---|---|---|---|---|
| 0 | **본 제안 승인** | — | — | **← 지금 여기** |
| 1 | UX 시안 | `bmad-ux` (+ `slur-ux`·`slur-design`) | 상품목록·상품상세·장바구니 × 3안, **브라우저 렌더 HTML** | **시안 선택 필수** |
| 2 | 문서 갱신 | `bmad-prd` (update) + 스파인 개정 | §5.1~5.3 적용 | 스파인 개정 승인 |
| 3 | 에픽·스토리 | `bmad-create-epics-and-stories` | Epic 8 스토리 8건 + `sprint-status.yaml` | 검토 |
| 4 | 구현 | `bmad-create-story` → `bmad-dev-story` ×8 | 구매자 웹 | 8.2 실기 회귀 확인 |
| 5 | Flutter 제거 | Story 8.8 | 태그 `flutter-app-final` + `apps/mobile` 제거 | **태그 원격 푸시 확인** |
| 6 | PG | Epic 7 재작성 후 착수 | — | 견적(A-E456-3) |

### 성공 기준

1. 구매자 8화면이 모바일 브라우저에서 Flutter 앱과 **기능 동등**하게 동작한다 (주문 생성까지 실기 1회 완주).
2. 슬러 디자인 시스템이 구매자 화면 전체에 적용되고, Slur가 고른 시안의 톤과 일치한다.
3. 판매자·관리자 화면에 **회귀가 없다** (§3.4 role 쿠키 변경 후 실기 확인).
4. API 테스트 153건이 그대로 통과한다 (백엔드 무변경의 증거).
5. `apps/mobile` 제거 후에도 `flutter-app-final` 태그에서 전체 앱을 복원할 수 있다.

### 미결 사항 (이번 단계에서 결정하지 않음)

- 구매자 홈 라우트를 `/`로 둘지 `/shop`으로 둘지 — 현재 `/`는 로그인 유도 랜딩이다. **UX 단계(1)에서 결정.**
- 하단 탭 내비게이션 채택 여부 — **시안에서 3안이 갈릴 지점.**
- PWA service worker의 캐시 범위 — 8.7에서 결정, v1은 최소(셸 캐시)로 제안.

---

## 7. 승인 요청

이 제안을 승인하면 **1단계(UX 시안)** 부터 시작한다.
승인 전까지 PRD·브리프·스파인·에픽·코드는 **한 글자도 바뀌지 않는다.**

- [ ] 승인 — 1단계(bmad-ux) 진행
- [ ] 수정 요청 — 항목 지정
- [ ] 보류
