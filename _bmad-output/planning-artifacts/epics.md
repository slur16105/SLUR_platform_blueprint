---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-SLUR_platform_blueprint-2026-07-14/prd.md
  - _bmad-output/planning-artifacts/prds/prd-SLUR_platform_blueprint-2026-07-14/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md
---

# SLUR 커머스 플랫폼 1호 - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for SLUR 커머스 플랫폼 1호, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: 이메일+비밀번호 회원가입·로그인 (Argon2id 해시)
FR-2: 카카오 로그인 (구매자 화면·판매자/관리자 화면 공통), FastAPI 자체 JWT 발급, 범용 OAuth 구조
FR-3: 단일 계정 다중 역할(구매자/판매자/관리자), FastAPI RBAC
FR-4: 이메일 가입 최소 수집(이메일·비밀번호·이름·선택 휴대폰), 이메일 인증 생략
FR-5: 입점 신청 폼 — 법정 필수(상호·대표자·사업자번호·통판신고번호·주소·연락처)+브랜드명·소개
FR-6: 신청 페이지 상시 존재, 초청 전용→공개 전환은 운영 정책 변경만으로
FR-7: 관리자 승인/반려(사유 입력), 승인 시 판매자 역할 부여·즉시 등록 가능, "심사 중" 표시
FR-8: 상품 등록(상품명·가격·설명·이미지·옵션), 검수 없음 — 즉시 노출
FR-9: 옵션 축 최대 2개 → 조합 행 자동 생성 → 행별 [옵션값|추가금액|재고|판매상태] 그리드 입력
FR-10: 조합별 수량 재고, 0=자동 품절+수동 토글, 품절 옵션은 "품절" 표기 비활성
FR-11: 재고 차감은 주문 생성 시점 원자적, 취소 시(자동·자유·관리자) 복원
FR-12: 상품 상태 판매중/품절/숨김 3단계, 판매자 전환
FR-13: 상품 이미지 대표 1장+추가(상한 10장), 상세는 텍스트+이미지
FR-14: 판매자 혼합 단일 장바구니 + 단일 주문서
FR-15: 주문 내부는 판매자별 하위 주문 분리, 배송 상태 독립 전이, 구매자에겐 주문 하나로 표시
FR-16: 주문서 — 배송지 입력(카카오 우편번호 검색), 요청사항, 금액 요약(상품+배송비+도서산간)
FR-17: 배송비 판매자 설정(무료/유료+제주·도서산간 추가비), 우편번호 자동 판정
FR-18: 주문 상태 전이 — 입금대기→결제완료→배송준비→배송중→배송완료, 3일 미입금 자동취소, 구매자 자유취소는 판매자 묶음 단위·배송준비 전
FR-19: 상태 전이 규칙 FastAPI 강제 — 미정의 전이는 어떤 클라이언트에서도 불가
FR-20: 구매확정 상태 값만 정의, v1 미사용
FR-21: 배송중 전이 시 택배사+송장번호 입력, 구매자 주문상세 표시 (추적 연동 없음)
FR-22: 주문내역 목록(최신순)·주문상세(판매자별 배송 상태, 배송지, 금액, 입금 계좌)
FR-23: 입금대기 주문에 입금 안내(금액·계좌·기한) 표시, 플랫폼 단일 계좌(설정값)
FR-24: 판매자 대시보드 — 신규 주문·배송준비 중 건수, 품절 임박(재고 5 이하) 상품
FR-25: 판매자 주문관리 — 자기 주문 조회, 배송준비→배송중(송장)→배송완료 처리
FR-26: 판매자 상품관리 — 목록·등록·수정·상태 전환
FR-27: 관리자 입점 관리 — 신청 목록·상세, 승인/반려
FR-28: 관리자 입금 확인 — 입금대기 목록에서 수동 확인→결제완료 전이
FR-29: 관리자 주문 관리 — 전체 조회·검색, 상태 강제 변경+메모
FR-30: 관리자 상품·회원·판매자 조회 (읽기 중심, 제재 없음)
FR-31: 푸터 — 사업자 정보 + 통신판매중개자 고지
FR-32: 상품상세·주문서에서 청약 전 중개자 지위·판매자 신원정보 노출
FR-33: 이용약관·개인정보처리방침 페이지 (오픈 게이트에서 법률 검토)
FR-34: 카테고리 — 운영자 관리 단일 계층, 관리자 생성·수정·순서 변경, 상품당 1개, 목록 필터 탭
FR-35: 장바구니 — 조합 단위 담기(재담기 수량 합산)·수량 변경·삭제, 구매 불가 항목 표시·제외, 주문 생성 시 재검증

### NonFunctional Requirements

NFR-1: 모든 권한·비즈니스 로직·상태 전이 FastAPI 단일 소유. Supabase Auth·RLS·Edge Functions 금지 (Postgres+Storage만)
NFR-2: JWT(FastAPI 발급) + Argon2id, access 단기 + refresh 서버 저장
NFR-3: 재고 차감·상태 전이 동시성 정합성 (DB 수준 원자성)
NFR-4: 성능 수치 목표 없음 (소규모 상식선)
NFR-5: 개인정보 최소 수집·보관, 결제·정산 정보는 PG 전 수집 금지
NFR-6: 배포 Railway (FastAPI+Next.js), CSS 슬러 시스템 — 구매자 화면은 모바일 퍼스트 확장, 톤 B·매거진, 브랜드 파랑 미사용
NFR-7: 구매자 화면은 PWA로 홈 화면 설치 가능 (v1 범위는 반응형 웹 + 최소 manifest까지)

### Additional Requirements

- 스타터 템플릿 없음 — 커스텀 그린필드. 백엔드는 도메인 모듈러 모놀리스 (app/{core,auth,sellers,products,carts,orders,admin}, 각 도메인에 router/service/models/schemas 고정 명명)
- 스택 핀 (2026-07 웹 검증): Python 3.14, FastAPI 0.139, Pydantic 2.13, SQLAlchemy 2.0.51(async)+asyncpg 0.31, Alembic 1.18, uv, Next.js 16.2(App Router), React 19.2, Supabase PG17
- AD-2 도메인 의존 방향 그래프 준수 (service 경유만, 순환 금지)
- AD-3 주문 상태 기계 3층(결제/배송/취소) 전이표+단일 전이 함수, system 역할 포함, order_events 기록
- AD-4 재고 증감은 orders 전이 함수만, 조건부 UPDATE
- AD-5 카카오는 신원 확인만, JWT는 FastAPI, auth_providers 일반화, refresh_tokens 서버 저장
- AD-6 취소 상태는 order_items 라인, 구매자 취소 단위는 sub_order, 대표 상태는 파생
- AD-7 order_items 스냅샷 (상품명·옵션·단가), AD-11 배송비도 sub_orders에 스냅샷
- AD-8 UUIDv7 앱 레이어 생성(PG17 네이티브 없음), 금액 원 정수, UTC timestamptz, 상태 enum 영문 snake_case
- AD-9 ERD·마이그레이션은 Slur 승인 게이트 (18테이블 ERD 승인됨, 컬럼 상세는 마이그레이션 초안에서)
- AD-10 구매 가능 판정은 products의 단일 술어, 주문 성공 시 장바구니 정리는 orders
- AD-12 파생 값(대표 상태·합계·취소 가능)은 백엔드 계산 — 클라이언트 계산 금지
- AD-13 SLUR 고유 값 하드코딩 금지 (core/config 또는 settings 테이블)
- 에러 봉투 {code(문자열)·message(한국어)·details}, 422 포함 전역 변환, 클라이언트는 code로만 분기
- 이미지 업로드는 FastAPI 경유 사전서명 URL (클라이언트가 Storage 키 미보유)
- 로컬 개발 Docker Compose(PG17), 시크릿 Railway 환경변수+.env, 미입금 자동취소는 APScheduler(단일 인스턴스)
- Railway 서비스별 Dockerfile, Alembic은 pre-deploy 실행
- remote_area_zips 시드 데이터(우체국 공개 목록) 준비 필요
- 웹 토큰 보관 방식(httpOnly 쿠키 vs 메모리)은 auth 첫 스토리에서 확정 (Deferred)

### UX Design Requirements

구매자 화면은 bmad-ux 산출물(2026-07-21 실행)을 따른다 — 핵심 3화면(상품목록·상품상세·장바구니) 3안 중 Slur가 고른 **B·매거진**이 톤의 기준이며, 나머지 화면은 그 톤으로 전개한다. 전 화면에 슬러 시스템(slur-ux·slur-design)을 적용한다.

- 시각 계약(색·활자·간격·컴포넌트): `_bmad-output/planning-artifacts/ux-designs/ux-SLUR_platform_blueprint-2026-07-21/DESIGN.md`
- 동작 계약(IA·라우트·접근 권한·상태·문구): 같은 폴더 `EXPERIENCE.md`
- 확정 사항 요약: 하단 탭 내비 4탭(홈·장바구니·주문내역·내 정보) / 구매자 홈 = `/` / 비로그인은 상품목록·상품상세까지 공개, 장바구니부터 로그인 / 브랜드 파랑은 구매자 화면 미사용 / 구매자 화면 9개(내 정보 포함, PRD §4)
- **스파인이 목업과 충돌하면 스파인(DESIGN.md·EXPERIENCE.md)이 이긴다.**

### FR Coverage Map

FR-1: Epic 1 — 이메일 가입·로그인
FR-2: Epic 1 — 카카오 로그인
FR-3: Epic 1 — 단일 계정 다중 역할 RBAC
FR-4: Epic 1 — 가입 최소 수집
FR-5: Epic 2 — 입점 신청 폼
FR-6: Epic 2 — 신청 페이지 정책
FR-7: Epic 2 — 승인/반려·판매자 역할 부여
FR-8: Epic 3 — 상품 등록·즉시 노출
FR-9: Epic 3 — 옵션 조합 그리드
FR-10: Epic 3 — 조합별 재고·품절
FR-11: Epic 4 — 재고 원자적 차감·복원 (주문 트랜잭션)
FR-12: Epic 3 — 상품 상태 3단계
FR-13: Epic 3 — 상품 이미지
FR-14: Epic 4 — 혼합 단일 장바구니·주문서
FR-15: Epic 4 — 판매자별 하위 주문
FR-16: Epic 4 — 주문서 (배송지·금액 요약)
FR-17: Epic 4 — 배송비·도서산간
FR-18: Epic 4 — 주문 상태 전이·취소
FR-19: Epic 4 — 전이 규칙 강제
FR-20: Epic 4 — 구매확정 자리
FR-21: Epic 5 — 송장 입력·표시
FR-22: Epic 5 — 주문내역·상세
FR-23: Epic 5 — 입금 안내
FR-24: Epic 5 — 판매자 대시보드
FR-25: Epic 5 — 판매자 주문관리
FR-26: Epic 3 — 판매자 상품관리
FR-27: Epic 2 — 관리자 입점 관리
FR-28: Epic 5 — 관리자 입금 확인
FR-29: Epic 5 — 관리자 주문 관리
FR-30: Epic 5 — 관리자 조회
FR-31: Epic 6 — 푸터·사업자 정보
FR-32: Epic 6 — 중개자 지위·판매자 정보 노출
FR-33: Epic 6 — 약관·개인정보처리방침
FR-34: Epic 3 — 카테고리
FR-35: Epic 4 — 장바구니 동작

## Epic List

### Epic 1: 기반과 계정
프로젝트 뼈대(모노리포·Docker·배포·초기 마이그레이션)를 세우고, 누구나 이메일·카카오로 가입해 두 클라이언트에 로그인할 수 있다.
**FRs covered:** FR-1, FR-2, FR-3, FR-4

### Epic 2: 입점
초청받은 브랜드가 신청서를 내고, 관리자 승인으로 판매자가 된다.
**FRs covered:** FR-5, FR-6, FR-7, FR-27

### Epic 3: 상품 — 등록과 진열
판매자가 옵션 조합 표로 상품을 올리고, 구매자가 목록·상세에서 본다 (카테고리 포함).
**FRs covered:** FR-8, FR-9, FR-10, FR-12, FR-13, FR-26, FR-34

### Epic 4: 구매 — 장바구니부터 주문·취소까지
구매자가 여러 판매자 상품을 한 번에 주문하고 취소할 수 있다 (상태 전이 엔진, 재고 차감, 배송비 계산, 자동취소 배치).
**FRs covered:** FR-11, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-35

### Epic 5: 주문 운영 — 세 역할의 주문 화면
구매자는 내역을 보고, 판매자는 배송을 처리하고, 관리자는 입금 확인·개입을 한다.
**FRs covered:** FR-21, FR-22, FR-23, FR-24, FR-25, FR-28, FR-29, FR-30

### Epic 6: 법적 고지와 오픈 준비
약관·개인정보·중개자 고지·판매자 정보 노출이 갖춰져 내부 테스트 가능 상태가 된다.
**FRs covered:** FR-31, FR-32, FR-33


## Epic 1: 기반과 계정

프로젝트 뼈대(모노리포·Docker·배포·초기 마이그레이션)를 세우고, 누구나 이메일·카카오로 가입해 두 클라이언트에 로그인할 수 있다.

### Story 1.1: 걷는 뼈대 (프로젝트 골격과 배포)

As a 운영자,
I want 빈 서비스가 로컬과 Railway에서 돌아가는 것,
So that 이후 모든 스토리가 올라탈 기반이 생긴다.

**Acceptance Criteria:**

**Given** 모노리포(apps/api·apps/web·apps/mobile)와 도메인 모듈 골격(app/core + auth/sellers/products/carts/orders/admin)
**When** `docker compose up` 후 헬스체크 엔드포인트 호출
**Then** FastAPI가 로컬 Postgres 17에 연결된 상태로 200을 응답한다
**And** 에러 봉투 전역 핸들러가 동작한다 (존재하지 않는 경로·422 검증 실패도 `{code, message, details}` 형식)
**And** 클라이언트 코드(web·mobile)에 Supabase SDK·직접 연결이 존재하지 않는다 (NFR-1)

**Given** main 브랜치 푸시
**When** Railway 배포
**Then** API·웹 서비스가 각각 Dockerfile로 빌드되어 공개 URL에서 응답하고, API는 Supabase Postgres 17에 연결된다
**And** Alembic 마이그레이션이 pre-deploy 단계에서 실행된다 (테이블 0개 상태)
**And** 시크릿은 Railway 환경변수/로컬 .env로만 주입된다 (코드에 리터럴 없음)

### Story 1.2: 이메일 가입·로그인 API

As a 구매자,
I want 이메일과 비밀번호로 가입하고 로그인하는 것,
So that 계정으로 서비스를 이용할 수 있다.

**Acceptance Criteria:**

**Given** 미가입 이메일
**When** 가입 요청(이메일·비밀번호·이름, 선택 휴대폰)
**Then** 비밀번호가 Argon2id 해시로 저장되고 access+refresh 토큰이 발급된다 (`users`·`refresh_tokens` 마이그레이션은 AD-9 승인 절차 경유)

**Given** 이미 가입된 이메일
**When** 가입 요청
**Then** 에러 봉투의 `code`로 중복을 알린다

**Given** 잘못된 비밀번호
**When** 로그인
**Then** 에러 봉투로 실패한다
**And** refresh 토큰 갱신·로그아웃(서버 저장 토큰 폐기)이 동작한다

### Story 1.3: 카카오 로그인

As a 구매자,
I want 카카오로 빠르게 가입·로그인하는 것,
So that 비밀번호 없이 바로 쇼핑을 시작할 수 있다.

**Acceptance Criteria:**

**Given** 유효한 카카오 인가 코드
**When** 소셜 로그인 요청
**Then** 카카오는 신원 확인에만 쓰이고 FastAPI 자체 JWT가 발급된다 (`auth_providers`는 provider 컬럼 기반 범용 구조 — 제공자 추가 시 스키마 변경 불필요)

**Given** 같은 카카오 계정의 재로그인
**When** 소셜 로그인 요청
**Then** 기존 계정으로 로그인된다 (중복 계정 미생성)

### Story 1.4: 역할과 권한 분기 (RBAC)

As a 시스템 관리자,
I want 모든 API의 역할 판정이 FastAPI 한 곳에서 강제되는 것,
So that 클라이언트를 우회한 권한 상승이 불가능하다.

**Acceptance Criteria:**

**Given** 가입 직후 계정
**When** 역할 조회
**Then** 구매자 역할을 가진다 (`user_roles`)
**And** 판매자·관리자 전용 엔드포인트 호출 시 403 에러 봉투를 받는다

**Given** 최초 배포 환경 (관리자 없음)
**When** 관리자 부트스트랩 실행 (시드 스크립트 또는 CLI 명령)
**Then** 지정 계정에 관리자 역할이 부여된다 — 이것이 최초 관리자를 만드는 유일한 경로다

**Given** 관리자 역할이 부여된 계정
**When** 관리자 전용 엔드포인트 호출
**Then** 통과한다
**And** 역할 검사는 core의 공통 의존성 하나로만 구현된다 (엔드포인트별 자체 검사 금지)

### Story 1.5: Flutter 로그인 화면

> **[2026-07-21 대체됨]** Flutter 로그인 화면은 반응형 웹 전환으로 폐기. 후속은 Story 8.2(구매자 가입·로그인 웹 — 카카오 웹 인가코드 플로우, httpOnly 쿠키 + BFF). 구현 기록은 태그 `flutter-app-final`에 보존. **완료 상태는 되돌리지 않는다** — 당시 실제로 완료됐던 사실이다.

As a 구매자,
I want 앱에서 이메일 또는 카카오로 가입·로그인하는 것,
So that 앱에서 쇼핑을 시작할 수 있다.

**Acceptance Criteria:**

**Given** Flutter 앱(Android)
**When** 이메일 가입/로그인 또는 카카오 로그인
**Then** 토큰이 플랫폼 보안 저장소(Android Keystore 기반 secure storage)에 저장되고 홈(빈 화면)에 진입한다
**And** access 만료(401) 시 refresh로 자동 갱신되고, 갱신 실패 시 로그인 화면으로 이동한다

### Story 1.6: 웹 로그인과 Role 분기

As a 판매자·관리자,
I want PC 웹에서 로그인해 내 역할의 화면으로 들어가는 것,
So that 판매·운영 업무를 시작할 수 있다.

**Acceptance Criteria:**

**Given** Next.js 웹
**When** 로그인
**Then** Role에 따라 판매자/관리자 랜딩(빈 화면)으로 분기한다
**And** 웹 토큰 보관 방식(httpOnly 쿠키 vs 메모리)이 이 스토리에서 확정·기록된다 (스파인 Deferred 해소)
**And** 역할 없는 계정(구매자만)이 웹에 로그인하면 안내 화면이 표시된다

## Epic 2: 입점

초청받은 브랜드가 신청서를 내고, 관리자 승인으로 판매자가 된다.

### Story 2.1: 입점 신청

As a 초청받은 브랜드,
I want 입점 신청서를 제출하는 것,
So that 심사 후 판매를 시작할 수 있다.

**Acceptance Criteria:**

**Given** 로그인한 계정 (구매자 역할)
**When** 입점 신청 폼 제출 — 법정 필수(상호·대표자명·사업자등록번호·통신판매업 신고번호·사업장 주소·연락처) + 브랜드명·브랜드 소개
**Then** 신청이 저장되고(`seller_applications`) 신청자에게 "심사 중" 상태가 표시된다

**Given** 신청 페이지 URL
**When** 로그인한 누구나 접근
**Then** 상시 접근 가능하다 — 초청 전용/공개 전환은 링크 노출 정책일 뿐, 코드 변경 없이 운영된다 (FR-6)

**Given** 필수 항목 누락
**When** 제출
**Then** 에러 봉투 `details`에 필드별 오류가 담긴다

**Given** 이미 심사 중인 신청이 있는 계정
**When** 재신청
**Then** 중복 신청이 거부된다

### Story 2.2: 관리자 입점 승인·반려

As a 관리자,
I want 신청 목록을 보고 승인/반려하는 것,
So that 플랫폼의 결을 유지하며 판매자를 받아들인다.

**Acceptance Criteria:**

**Given** 심사 중인 신청
**When** 관리자가 승인
**Then** 판매자 프로필(`sellers`)이 생성되고 같은 계정에 판매자 역할이 부여되며, 신청자는 즉시 판매자 화면에 접근할 수 있다

**Given** 심사 중인 신청
**When** 관리자가 반려 (사유 입력 필수)
**Then** 신청자에게 반려 상태와 사유가 표시된다

### Story 2.3: 판매자 배송비 설정

As a 판매자,
I want 내 배송 정책(무료/유료, 제주·도서산간 추가비)을 설정하는 것,
So that 주문 시 배송비가 자동 계산된다.

**Acceptance Criteria:**

**Given** 판매자 역할 계정
**When** 배송비 설정 저장 (기본 배송비 0원=무료 또는 금액, 제주 추가비, 도서산간 추가비)
**Then** 설정이 판매자 프로필에 저장되고 다시 조회하면 그대로 표시된다 (주문 배송비 계산에서의 사용은 Epic 4에서 검증)
**And** 금액은 원 단위 정수만 허용된다

## Epic 3: 상품 — 등록과 진열

판매자가 옵션 조합 표로 상품을 올리고, 구매자가 목록·상세에서 본다 (카테고리 포함).

### Story 3.1: 카테고리 관리

As a 운영자,
I want 카테고리를 만들고 고치고 순서를 바꾸는 것,
So that 카테고리 이름 자체가 큐레이션이 된다.

**Acceptance Criteria:**

**Given** 관리자 화면
**When** 카테고리 생성·이름 수정·순서 변경
**Then** 변경이 카테고리 목록 API 응답(순서 포함)에 반영된다 (`categories` — 단일 계층, 하드코딩 금지)

**Given** 상품이 속한 카테고리
**When** 삭제 시도
**Then** 소속 상품이 있으면 거부하고 사유를 알린다

### Story 3.2: 상품 등록 — 기본 정보와 이미지

As a 판매자,
I want 상품명·가격·설명·이미지·카테고리로 상품을 올리는 것,
So that 구매자에게 즉시 노출된다.

**Acceptance Criteria:**

**Given** 판매자 역할 계정
**When** 상품 등록 (상품명·기본 가격·설명(텍스트+본문 이미지)·카테고리 1개·대표 이미지 1장+추가 최대 10장)
**Then** 검수 없이 즉시 노출 상태가 된다 (`products`·`product_images`)
**And** 모든 이미지 업로드(대표·추가·본문)는 FastAPI가 발급한 사전서명 URL 경유로만 이루어진다 (클라이언트에 Storage 키 없음)

### Story 3.3: 옵션 조합 그리드와 재고

As a 판매자,
I want 옵션 축을 정의하면 조합 표가 생겨 행마다 추가금액·재고를 입력하는 것,
So that 스마트스토어처럼 익숙하게 옵션 상품을 관리한다.

**Acceptance Criteria:**

**Given** 옵션 축 최대 2개와 각 축의 값들 (예: 색상 2 × 사이즈 3)
**When** 조합 생성
**Then** 6개 행이 자동 생성되고 행마다 [옵션값|추가금액|재고수량|판매상태]를 입력한다 (`variants`)

**Given** 옵션 없는 상품
**When** 등록
**Then** 내부적으로 조합 1개로 저장된다

**Given** 어떤 조합의 재고가 0이 됨
**When** 구매자가 옵션 선택 목록을 봄
**Then** 해당 조합은 "품절" 표기로 비활성화된다 (숨기지 않음)
**And** 판매자는 재고와 무관하게 수동 품절 토글을 켤 수 있다

### Story 3.4: 판매자 상품 관리

As a 판매자,
I want 내 상품 목록을 보고 수정·상태 전환하는 것,
So that 상품을 최신 상태로 유지한다.

**Acceptance Criteria:**

**Given** 판매자의 상품 목록
**When** 상품 정보·옵션·재고 수정, 상태 전환(판매중/품절/숨김)
**Then** 수정 내용이 상품 조회 API에 반영되고, 숨김 전환 시 구매자 목록·상세에서 노출되지 않는다
**And** 다른 판매자의 상품은 조회·수정할 수 없다 (403)

### Story 3.5: 구매자 상품 목록·상세

> **[2026-07-21 대체됨]** 아래 Flutter 화면 서술(`Flutter 앱 홈`, `앱에서 상품을 둘러보고`)은 반응형 웹 전환으로 폐기. 후속은 Epic 8 초안의 8.3(상품목록·상품상세 웹 — `/`·`/products/[id]`, 비로그인 열람 가능). **백엔드 판정(AD-10 단일 술어·AD-12 파생 값)은 그대로 유효**하다. 구현 기록은 태그 `flutter-app-final`에 보존.

As a 구매자,
I want 앱에서 상품을 둘러보고 상세를 보는 것,
So that 살 물건을 고를 수 있다.

**Acceptance Criteria:**

**Given** Flutter 앱 홈
**When** 상품 목록 조회
**Then** 카테고리 필터 탭(전체|카테고리…)으로 상품이 표시된다 (숨김 상품 제외)

**Given** 상품 상세
**When** 옵션 선택
**Then** 조합별 추가금액이 반영된 가격이 표시되고, 품절 조합은 선택 불가다
**And** "지금 이 조합을 n개 살 수 있는가" 판정은 products 도메인의 단일 술어 함수로 구현된다 (AD-10 — 이후 장바구니·주문이 같은 함수를 재사용)
**And** 화면의 가격·구매 가능 여부는 백엔드 응답 값만 표시한다 (클라이언트 계산 금지, AD-12)

## Epic 4: 구매 — 장바구니부터 주문·취소까지

구매자가 여러 판매자 상품을 한 번에 주문하고 취소할 수 있다.

### Story 4.1: 장바구니

> **[2026-07-21 대체됨]** AC는 클라이언트 중립이지만 구매자 **화면**은 Flutter로 구현됐다. 그 화면은 반응형 웹 전환으로 폐기되고 후속은 Epic 8 초안의 8.4(장바구니 웹 — `/cart`, 로그인 필요). `cart_items` API·구매 가능 판정(AD-10)은 그대로 유효. 구현 기록은 태그 `flutter-app-final`에 보존.

As a 구매자,
I want 여러 판매자의 상품을 한 장바구니에 담는 것,
So that 한 번에 주문할 수 있다.

**Acceptance Criteria:**

**Given** 상품 상세에서 조합·수량 선택
**When** 담기
**Then** 조합 단위로 저장되고(`cart_items`), 같은 조합 재담기는 수량이 합산된다

**Given** 장바구니에 담긴 항목이 이후 품절·숨김·삭제됨
**When** 장바구니 조회
**Then** 해당 항목이 "구매 불가"로 표시되고 주문서 진입 대상에서 제외된다 (판정은 3.5의 단일 술어 함수 재사용, AD-10)

**Given** 담긴 항목
**When** 수량 변경·삭제
**Then** 즉시 반영된다 (담기 시점 재고 차감 없음)

### Story 4.2: 주문 데이터 모델과 배송비 계산 (주문서 미리보기)

> **[2026-07-21 대체됨]** 마지막 AC의 "주문서 화면"은 Flutter 화면을 가리켰다. 그 화면은 반응형 웹 전환으로 폐기되고 후속은 Epic 8 초안의 8.5(주문서 웹 — `/checkout`). **데이터 모델·배송비 계산 함수·시드는 전량 유효**하며 변경 대상이 아니다 (ERD 변경 0건).

As a 구매자,
I want 주문 전에 상품 합계·배송비·도서산간 추가비가 정확히 계산된 금액을 보는 것,
So that 얼마를 입금해야 하는지 미리 안다.

**Acceptance Criteria:**

**Given** 주문 도메인 데이터 모델 (`orders`·`sub_orders`·`order_items`·`remote_area_zips`·`settings` 마이그레이션 — AD-9 승인 절차 경유)
**When** 마이그레이션 실행
**Then** `remote_area_zips`는 우체국 공개 목록으로, `settings`는 입금 계좌·미입금 기한(3일)·품절 임박 기준(5)으로 시드된다 (v1 값 변경은 시드/DB로 — 관리자 설정 화면은 v1 제외)

**Given** 구매 가능 항목이 담긴 장바구니와 배송지 우편번호
**When** 주문서 미리보기 API 호출
**Then** 판매자별 배송비(판매자 설정 + 도서산간 판정)와 상품 합계·총액이 계산되어 반환된다 — 계산은 orders 도메인의 함수 하나가 소유한다 (AD-11)
**And** 주문서 화면에 상품 합계 + 배송비 + 도서산간 추가비 요약이 청약 전에 표시된다 (FR-16)

### Story 4.3: 주문 상태 전이 엔진

As a 운영자,
I want 주문 상태가 정의된 규칙으로만 바뀌는 것,
So that 어떤 화면·코드 경로에서도 무결성이 깨지지 않는다.

**Acceptance Criteria:**

**Given** 3층 전이표(orders 결제 / sub_orders 배송 / order_items 취소, 역할 포함)가 orders 도메인에 데이터로 선언됨 — `pending_payment`→`paid`→(sub_orders) `preparing`→`shipping`→`delivered`, `confirmed`(구매확정)는 값만 정의·v1 미사용 (FR-20), 취소 전이 포함
**When** API를 통해 미정의 전이 시도
**Then** 에러 봉투로 거부된다
**And** 상태 컬럼을 직접 UPDATE하는 코드가 전이 함수 밖에 존재하지 않는다 (코드 검사로 확인)
**And** 모든 전이 성공이 `order_events`에 기록된다 (누가·언제·무엇을) — `order_events`·`cancellations` 마이그레이션 포함

### Story 4.4: 주문 생성

> **[2026-07-21 대체됨]** AC의 `Flutter 주문서에서 배송지(카카오 우편번호 검색)…` 서술은 반응형 웹 전환으로 폐기. 후속은 Epic 8 초안의 8.5(주문서·주문 생성 웹 — 웹 우편번호 검색 오버레이, `[ASSUMPTION]` 제공자 미정). **주문 생성 트랜잭션·재고 원자 차감(AD-4)·에러 봉투는 그대로 유효**하다. 구현 기록은 태그 `flutter-app-final`에 보존.

As a 구매자,
I want 장바구니 상품을 배송지 입력과 함께 주문하는 것,
So that 입금만 하면 물건을 받을 수 있다.

**Acceptance Criteria:**

**Given** 구매 가능 항목이 담긴 장바구니
**When** Flutter 주문서에서 배송지(카카오 우편번호 검색)·요청사항 입력 후 주문
**Then** 주문이 생성된다 — `orders`(pending_payment, 전이 함수 경유) + 판매자별 `sub_orders` + `order_items` 스냅샷(상품명·옵션·단가·추가금액), 배송비는 4.2의 계산 함수 결과가 `sub_orders`에 스냅샷된다
**And** 같은 트랜잭션에서 조합 재고가 조건부 UPDATE로 원자 차감되고(소유: orders 도메인, AD-4), 주문된 장바구니 항목이 삭제된다
**And** 주문 완료 화면에 입금 안내(금액·계좌·기한 — settings 값)가 표시된다

**Given** 주문 직전 어떤 항목의 재고 부족
**When** 주문 요청
**Then** 주문 전체가 생성되지 않고 문제 항목이 에러 봉투 `details`로 특정된다

**Given** 동시에 재고 1개를 두 구매자가 주문
**When** 두 요청 처리
**Then** 한 명만 성공하고 재고는 음수가 되지 않는다

### Story 4.5: 미입금 자동취소

As a 운영자,
I want 기한 내 미입금 주문이 자동으로 취소되는 것,
So that 재고가 유령 주문에 잠기지 않는다.

**Acceptance Criteria:**

**Given** pending_payment 상태로 기한(settings, 기본 3일) 경과한 주문
**When** APScheduler 주기 작업 실행
**Then** `system` 역할로 전이 함수를 통해 자동취소되고, 전 라인 취소·재고 복원·`cancellations` 기록이 한 트랜잭션에서 일어난다

**Given** 기한 이내의 주문
**When** 같은 작업 실행
**Then** 아무 변화가 없다

### Story 4.6: 구매자 취소

As a 구매자,
I want 배송 시작 전 주문을 취소하는 것,
So that 마음이 바뀌어도 안심하고 주문할 수 있다.

**Acceptance Criteria:**

**Given** preparing 진입 전인 판매자 묶음(sub_order)
**When** 구매자가 그 묶음 취소 (주문 전체 취소 = 모든 묶음 취소)
**Then** 묶음의 전 라인이 취소되고 재고가 복원되며 `cancellations`에 귀책(구매자)·사유가 기록된다

**Given** preparing에 진입한 묶음 (테스트 시 전이 함수 직접 호출로 상태 조성)
**When** 구매자가 취소 시도
**Then** 거부되며 관리자 문의 안내가 표시된다

## Epic 5: 주문 운영 — 세 역할의 주문 화면

구매자는 내역을 보고, 관리자는 입금을 확인하고, 판매자는 배송을 처리한다.

### Story 5.1: 구매자 주문내역·상세

> **[2026-07-21 대체됨]** AC는 클라이언트 중립이지만 구매자 **화면**은 Flutter로 구현됐다. 그 화면은 반응형 웹 전환으로 폐기되고 후속은 Epic 8 초안의 8.6(주문내역·주문상세 웹 — `/orders`·`/orders/[id]`). 조회 API·파생 값 계산(AD-12)은 그대로 유효. 구현 기록은 태그 `flutter-app-final`에 보존.

As a 구매자,
I want 내 주문들의 진행 상황을 보는 것,
So that 내 물건이 어디쯤인지 안다.

**Acceptance Criteria:**

**Given** 주문한 계정
**When** 주문내역 조회
**Then** 최신순 목록이 표시되고, 주문 카드에 판매자 묶음별 상태가 각각 표시된다 (대표 상태는 백엔드 파생 값, AD-12)

**Given** 주문상세
**When** 조회
**Then** 판매자별 배송 상태·배송지·금액 내역(스냅샷)·pending_payment 시 입금 안내가 표시된다

### Story 5.2: 관리자 입금 확인

As a 관리자,
I want 입금대기 주문을 보고 입금을 확인 처리하는 것,
So that 판매자가 배송을 시작할 수 있다.

**Acceptance Criteria:**

**Given** pending_payment 주문 목록 (주문번호·금액·주문자·경과 시간)
**When** 관리자가 입금 확인
**Then** paid로 전이되고(전이 함수 경유) 판매자 주문관리 대상이 된다

### Story 5.3: 판매자 주문관리와 배송 처리

As a 판매자,
I want 들어온 주문을 확인하고 배송 단계를 처리하는 것,
So that 주문을 이행할 수 있다.

**Acceptance Criteria:**

**Given** paid 상태인 자기 sub_order
**When** preparing → shipping(택배사+송장번호 입력 필수) → delivered 처리
**Then** 각 전이가 전이 함수를 통해 반영되고 송장번호가 구매자 주문상세에 표시된다

**Given** 다른 판매자의 주문
**When** 조회·처리 시도
**Then** 403으로 거부된다

### Story 5.4: 판매자 대시보드

As a 판매자,
I want 로그인하면 처리할 일이 바로 보이는 것,
So that 놓치는 주문이 없다.

**Acceptance Criteria:**

**Given** 판매자 랜딩
**When** 대시보드 조회
**Then** 신규 주문(paid) 건수 · preparing 건수 · 품절 임박(재고 ≤ settings 기준, 기본 5) 상품 목록이 표시된다 (전부 백엔드 계산 값)

> 구현 구체화 (2026-07-20, 5.4 스토리): 판매자 관점에서 "신규 주문(paid)"와 "preparing"은 동일 값(paid 연쇄 = preparing 진입)이라 "신규 주문(배송준비 대기)" 카드로 병합, 배송중 카드 추가. 전-취소 묶음은 카운트 제외.

### Story 5.5: 관리자 주문 개입

As a 관리자,
I want 모든 주문을 검색하고 강제 개입하는 것,
So that 배송 후 취소·환불 같은 예외를 처리할 수 있다.

**Acceptance Criteria:**

**Given** 전체 주문 검색(주문번호·구매자·판매자·상태)
**When** 상태 강제 변경 + 관리자 메모
**Then** 전이 함수를 통해 반영되고 메모가 `order_events`에 남는다

**Given** 특정 라인만 취소해야 하는 상황 (판매자 품절 등)
**When** 관리자가 라인 단위 취소 (귀책·사유 입력)
**Then** 해당 라인만 취소되고 재고 복원·`cancellations` 기록(취소 시각과 환불 완료 시각 분리)이 일어난다

### Story 5.6: 관리자 조회 (회원·판매자·상품)

As a 관리자,
I want 회원·판매자·상품을 검색·조회하는 것,
So that 운영 문의에 답할 수 있다.

**Acceptance Criteria:**

**Given** 관리자 화면
**When** 회원 목록·검색(이메일·이름) 조회
**Then** 이메일·이름·역할·가입일이 표시되고 상세에서 주문 이력 링크를 제공한다

**Given** 관리자 화면
**When** 판매자 목록·검색(브랜드명·상호) 조회
**Then** 브랜드명·법정 신원정보·배송비 설정·상품 수가 표시된다

**Given** 관리자 화면
**When** 상품 목록·검색(상품명·판매자·카테고리·상태) 조회
**Then** 상품명·판매자·가격·상태·재고 합계가 표시된다 (수정·제재 기능 없음 — v1 범위)

### Story 5.7: 관리자 설정 (입금 계좌)

> 2026-07-20 Slur 승인으로 추가 — 4.2 리뷰에서 "입금 계좌는 구매자 노출 값인데 DB 직접 수정은 오타 시 실입금 사고 위험" 지적. "관리자 설정 화면 v1 제외" 결정을 입금 계좌에 한해 완화한다.

As a 관리자,
I want 무통장입금 계좌를 관리자 화면에서 확인·수정하는 것,
So that 계좌 변경 시 DB를 직접 만지지 않아도 되고 오타 사고를 막을 수 있다.

**Acceptance Criteria:**

**Given** 관리자 설정 화면
**When** settings 조회
**Then** `deposit_account`는 수정 가능한 폼으로, `unpaid_cancel_days`·`low_stock_threshold`는 읽기 전용으로 표시된다 (수치 정책 변경은 여전히 DB — 범위 최소화)

**Given** 입금 계좌 수정
**When** 저장 (은행·계좌번호·예금주 — 빈 값 불가)
**Then** `settings` 테이블에 반영되고, 이후 주문 완료 화면·입금 안내(4.4)가 새 값을 표시한다. 수정은 admin 역할만 가능하다

> 구현 구체화 (2026-07-20, 5.7 스토리): 계좌는 자유 텍스트 단일 값(1~200자, 은행마다 형식 상이 — 3필드 구조화는 과설계 기각). 변경은 기존 입금대기 주문의 안내에도 즉시 적용(소급 — 폐쇄 계좌 입금 방지 의도).

## Epic 6: 법적 고지와 오픈 준비

약관·개인정보·중개자 고지·판매자 정보 노출이 갖춰져 내부 테스트 가능 상태가 된다.

### Story 6.1: 약관·개인정보처리방침과 푸터

> **[2026-07-21 대체됨]** 마지막 AC의 `Flutter 앱에는 설정/정보 화면에…`는 반응형 웹 전환으로 폐기. 그 자리를 구매자 웹의 **`내 정보` 화면(`/me`)** 이 대신한다 — 모바일에는 PC 웹 같은 상시 푸터가 없으므로 FR-31·FR-33이 여기에 놓인다 (PRD §4, `EXPERIENCE.md`). 웹 푸터·약관·개인정보처리방침 페이지는 그대로 유효. 후속은 Epic 8의 구매자 웹 화면 스토리.

As a 운영자,
I want 필수 정책 페이지와 사업자 정보 고지가 갖춰지는 것,
So that 법적 기본 요건을 충족한다.

**Acceptance Criteria:**

**Given** 웹과 앱
**When** 약관·개인정보처리방침 페이지 접근
**Then** 표준 템플릿 기반 초안이 표시된다 (오픈 게이트 법률 검토 전 문구 명시)
**And** 웹 푸터에 사업자 정보 + "통신판매중개자이며 거래 당사자가 아님" 고지가 표시된다
**And** Flutter 앱에는 설정/정보 화면에 동일한 사업자 정보·고지·정책 링크가 노출된다

### Story 6.2: 중개자 지위·판매자 신원정보 노출

As a 구매자,
I want 사기 전에 누가 파는지 아는 것,
So that 안심하고 거래한다 (전자상거래법 의무).

**Acceptance Criteria:**

**Given** 상품상세
**When** 조회
**Then** "판매자 정보" 접이식 영역에 판매자 신원정보(상호·대표자·사업자등록번호·통신판매업 신고번호·주소·연락처)가 표시된다

**Given** 주문서
**When** 청약 전 화면 표시
**Then** 중개자 지위 고지 문구가 주문 버튼 위에 노출된다
