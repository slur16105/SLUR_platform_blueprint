# Deferred Work

리뷰·스토리 진행 중 이월된 항목의 로그. "지금은 안 하기로 결정"한 근거와 재개 조건을 남긴다.

> **[2026-07-21 정리 규약]** 구매자 표면이 Flutter 앱 → Next.js 반응형 웹으로 전환됐다 (`_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-21.md`, §5.6).
> `apps/mobile`은 **아직 저장소에 있으며**, Story 8.8에서 보존 태그(`flutter-app-final`) 생성 후 제거될 예정이다.
> 대상 코드가 앱에만 있던 부채는 **[소멸 2026-07-21]** 로 표시하고 사유를 남긴다 — 고쳐서 없어진 것이 아니라 **대상이 사라질 예정이라 추적을 멈추는 것**이므로 해소와 구분한다.
> 같은 문제가 웹에서 재발할 여지가 있으면 후속 지점(Epic 8)을 한 줄로 남긴다.

## Deferred from: code review of 4-1-cart (2026-07-19)

- **합산 후 총량 재고 초과 담기 policy 유지** — `apps/api/app/carts/service.py:25~46` `add_item`은 요청 수량만 술어 검증. 스토리 Completion Notes에서 policy로 확정. 4.4 주문 생성이 조건부 UPDATE로 최종 진실 보장 (`AD-4`). 담기 → 즉시 구매 불가 UX 단절은 감수
- **variants upsert flush 순서 임시 UNIQUE 위반 위험** — `apps/api/app/products/service.py:152~174`. 판매자가 조합 A ↔ B 옵션 값 스왑 시 auto-flush 임시 상태에서 UNIQUE 위반 가능. 현재 IntegrityError를 `duplicate_variant`로 잡아 낼 수 있음(원인 메시지는 실제와 다름). 완화 시 삭제 flush 선행 필요 → 4.1 범위 밖, 별도 스토리로 승격 후보
- **[소멸 2026-07-21]** ~~**Flutter cart_screen guard() finally 무조건 invalidate**~~ — `apps/mobile/lib/src/carts/cart_screen.dart:96~98`. 성공·실패 무관 refresh로 실패 스낵바 직후 화면 튐. 정합성 편에 서 유지하기로 했던 policy. 구매자 표면 반응형 웹 전환으로 대상 파일이 제거 예정(Story 8.8)이라 소멸 처리 — `sprint-change-proposal-2026-07-21.md` §5.6. **후속**: 웹 장바구니(Epic 8.4)에서 수량 변경·삭제 실패 시의 재조회가 오류 표시를 덮어쓰지 않게 할 것 — 같은 트레이드오프(정합성 vs 오류 가시성)가 그대로 재현되는 자리다
- **[해소 2026-07-20]** ~~**IntegrityError 원인 판정 문자열 매칭 취약**~~ — `products/service.py`에 `_constraint_name()` 헬퍼 추가. asyncpg(`exc.orig.__cause__.constraint_name`)·psycopg2(`exc.orig.diag.constraint_name`) 양쪽 경로를 시도하고 `UQ_VARIANT_COMBINATION` 상수와 대조. 이름을 못 얻으면 기존 문자열 매칭으로 안전 폴백. `test_variants.py::test_duplicate_combo_422`에 `code == "duplicate_variant"` 단언 추가로 봉인
- **[해소 2026-07-20]** ~~**담기 합산·캡의 race 테스트 부재**~~ — `test_carts.py::test_concurrent_add_is_atomic`(gather×10, 3개씩 → 1행·수량 30)·`test_concurrent_add_respects_cap`(gather×10, 200개씩 → 999 캡) 추가. 행 수는 API 응답이 아닌 DB 직접 조회로 검증. 기존 구현(ON CONFLICT DO UPDATE + LEAST) 그대로 통과
- **Alembic downgrade가 cart_items를 drop만 함** — `apps/api/alembic/versions/7fceea006abe_cart_items.py:41~46`. 프로덕션 롤백 시 카트 데이터 유실. 일반 alembic 관행이며 v1 완주엔 지장 없음
- **AD-13: `999` 리터럴 4곳 확산** — `carts/service.py:16`, `carts/models.py:22`, `carts/schemas.py:8,12` (앱 측 ~~`cart_screen.dart:140,144`·`product_detail_screen.dart:116`~~은 2026-07-21 전환으로 소멸 — 단 **같은 상한이 웹 장바구니·상품상세에 다시 놓이므로 확산 자체는 해소되지 않는다**). 스토리 스펙이 "1~999 서버·클라 양쪽 강제"로 고정했으므로 v1 지장 없음. 블루프린트 추출 시 `core/config`로 승격
- **[해소 2026-07-20]** ~~**RefreshIndicator future await 형식**~~ — `cart_screen.dart`·`screens/home_screen.dart`(앱 전체 grep으로 동일 안티패턴 1건 추가 발견) 두 곳을 `onRefresh: () => ref.refresh(...)` 형태로 교체 — Future를 그대로 반환해 RefreshIndicator가 직접 await한다. 블록 형식(`() async { await ... }`)은 `ref.refresh`의 `@useResult` 때문에 `unused_result` 경고가 나서 채택하지 않음. `flutter analyze` 0 (기존 order_history/order_detail의 블록 형식은 자체 메서드 호출이라 무관·유지)
- **[소멸 2026-07-21]** ~~**사용자 이탈 후 API 실패 시 스낵바 유실**~~ — `cart_screen.dart:92~95`. `context.mounted == false`면 오류 표시 없이 무음. 앱 제거 예정(Story 8.8)으로 소멸 — `sprint-change-proposal-2026-07-21.md` §5.6. **후속**: 웹 장바구니에서도 화면을 떠난 뒤의 실패가 무음이 되지 않도록, EXPERIENCE.md의 `네트워크 실패`(문장형 한국어 메시지 + 재시도 수단, HTTP 코드 미노출) 규칙을 Epic 8.4에서 적용
- **[해소 2026-07-20]** ~~**PATCH `quantity=1000` 방어 테스트 부재**~~ — `test_carts.py::test_patch_quantity_bounds` 추가. 1000·0·-1 → 422, 경계값 1·999 → 200으로 상한이 내려가지 않았음도 함께 봉인
- **variants upsert exact 매칭 — 대소문자·strip 이후 남는 공백만 다르면 SET NULL 조용한 소멸** — `apps/api/app/products/service.py:158`. UX 가이드(대소문자 표기 통일) + 판매자 저장 시 정규화 후속

## Deferred from: code review of 4-2-order-model-shipping-calc (2026-07-20)

- **마이그레이션의 CSV 런타임 의존** — `alembic/versions/0275fa5bfee4`가 `app/orders/data/remote_area_zips.csv`를 실행 시점에 읽음. CSV 갱신 시 신규 환경 시드가 프로덕션과 달라질 수 있음(리비전 불변성). v1 단일 환경에선 무해, 검증 로직으로 완화됨. 블루프린트 추출 시 시드를 마이그레이션 밖 멱등 스크립트로 분리 검토
- **[부분 해소 2026-07-20] 도서산간 시드 출처 격상** — **공식 단일 출처는 존재하지 않음이 확인됨**: CJ대한통운·우체국 모두 도서산간 우편번호 목록을 공개 배포하지 않으며(우체국은 우편번호 DB만 제공, 도서산간 플래그 없음), 각 택배사·플랫폼이 자체 기준표를 운영. → **독립 출처 교차 대조로 대체 검증 수행**(도매꾹 배송비 지역표, 2026-07-20): 표본 12개 중 11개 일치, 유일한 차이는 **15654(안산 대부도 — 연륙교 연결)** 미포함으로 우리 시드의 "연륙교 지역 제외(과청구 방지)" 원칙과 일치. 결론: 현 시드 신뢰 가능. **잔여**: 택배사 계약 확정 시 해당 사의 실제 기준표로 최종 정렬 (오픈 게이트)
- **remote_area_zips 갱신 운영 절차 부재** — 신규 우편번호 배정·택배사 목록 개정 시 자동으로 일반 판정 → 판매자 과소청구를 감지할 주기 점검 절차 없음. 실서비스 오픈 게이트 점검 항목
- **`deposit_account` placeholder 가드 없음** — 시드 값 "은행/계좌번호/예금주 미설정"이 그대로 노출될 수 있음. **4.4 주문 완료 화면 전 실계좌 DB 갱신 확인을 4.4 Task에 명시할 것.** 관리자 수정 화면은 Story 5.7로 승격됨 (2026-07-20 Slur 승인)
- **우편번호 실존 검증 없음** — `^\d{5}$` 형식만 통과하면 미배정 번호도 일반 지역 계산. 4.4 카카오 우편번호 검색 위젯 도입으로 해소 예정 — 4.4 스토리에 명시 이월
- **장바구니 행 수 상한 없음** — `get_purchasable_entries` IN 절·미리보기 응답 크기 무상한 (수량 999 캡만 존재). 읽기 전용이라 실해 낮음, 실사용 피드백 후

## Deferred from: code review of 4-3-order-state-engine (2026-07-20)

- **seller의 라인 취소 전이 없음 (의도된 결정)** — 판매자 품절 취소는 5.5 관리자 개입(귀책 seller)으로 처리. 운영 부하가 확인되면 전이표에 행 추가 (코드 데이터, AD-9 불요)
- **가드 실패·미정의 전이가 같은 `invalid_transition` 코드** — 후속 화면 스토리에서 클라이언트 분기 필요 확인 시 코드 분리
- **paid 주문의 전-취소 묶음은 shipping_status NULL 잔류** — **5.1 대표 상태 파생 계약: (order paid + sub NULL) = 취소된 묶음으로 해석해야 함. 5.1 스토리 작성 시 Dev Notes에 명시할 것**
- **order_events.actor_user_id·cancellations.created_by 인덱스 부재** — 회원 탈퇴(users DELETE) 시 풀스캔. v1 탈퇴 기능 없음, 블루프린트 추출 시 추가
- **테스트 헬퍼 3모듈 결합** — `_shop`·`_buyer`·`_auth`를 conftest 공용 픽스처로 승격 후보

## Deferred from: code review of 4-4-order-creation (2026-07-20)

- **커밋 직후 응답 유실 시 주문 확인 경로 부재** — 타임아웃이면 주문은 생성됐는데 클라이언트는 실패 안내. **5.1 주문 내역 조회가 해소 경로 — 5.1 스토리에 명시 이월** (재시도는 cart 소실로 404라 중복 생성은 없음)
- **주문 생성 잠금 구간 추가 최적화** — 차감 후 INSERT·flush 왕복이 variants 행 잠금 구간에 포함. v1 트래픽 무관, 블루프린트 추출 시 검토
- **테스트 헬퍼 결합·제2 판매자 시나리오 인라인 중복** — conftest 공용 픽스처 승격 후보 (4.3 defer 누적)

## Deferred from: code review of 4-5-auto-cancel (2026-07-20)

- **orders `(payment_status)` partial index 부재** — 자동취소 배치(10분 주기)·5.2 입금대기 목록이 같은 조회 패턴. v1 규모 무해. **5.2 스토리에서 AD-9 초안과 함께 검토** (스키마 변경 게이트)
- **배치 rollback 실패(DB 다운) 시 처리 건수 로그 유실** — 데이터는 개별 commit으로 안전, 로그 관측성만 저하. 모니터링 정비(오픈 게이트)에서

## Deferred from: code review of 4-6-buyer-cancel (2026-07-20)

- **잠금 직전 극소 윈도의 선취소 라인 → generic invalid_transition message** — 데이터 안전(전체 rollback·재시도 성공), UX 계약만 저하. invalid_transition 코드 분리(4.3 defer)와 묶어 후속

## Deferred from: code review of 5-1-buyer-order-history (2026-07-20)

- **브랜드명 라이브 조회 (스냅샷 아님)** — 의도된 결정: 판매자 프로필은 살아있는 정보, AD-7 스냅샷 대상은 상품명·옵션·금액. 리브랜딩 소급 표시 수용. 스냅샷 승격은 운영 피드백 후
- **order_no(UUID 8자리) 충돌 대응 미정** — **5.2 관리자 입금 확인 설계에서 결정** (입금자 대조 흐름에 전체 UUID/주문일 병기 여부)
- **offset 페이지네이션 커서 전환** — v1 규모 무해(클라 dedupe로 완화). 블루프린트 추출 시

## Deferred from: code review of 5-2-admin-payment-confirm (2026-07-20)

- **ix_orders_pending이 목록 ORDER BY(created_at) 미커버 + non-CONCURRENTLY 생성** — v1 무해(pending 행 소수). 실서비스 규모 재적용 시 CONCURRENTLY·정렬 포함 재설계 (오픈 게이트)
- **웹 lint 베이스라인 (react-hooks/set-state-in-effect 등 6건)** — 전 목록 페이지 공통 load-on-mount 패턴. 일괄 리팩터 스토리 후보 (블루프린트 추출 전)

## Deferred from: code review of 5-3-seller-order-shipping (2026-07-20)

- **자기 소유 NULL(미결제) sub_order ship 422의 존재 누설** — 실해 미미(자기 주문). invalid_transition 코드 분리와 묶어 후속
- **웹 모달 풀 포커스 트랩 부재 (5.2·5.3 공통)** — ESC·초기 포커스·submitting 가드는 구현됨. 공통 모달 컴포넌트 승격 시 일괄 (블루프린트 추출)

## Deferred from: code review of 5-4-seller-dashboard (2026-07-20)

- **threshold=0 운영 시 "품절 임박" 카드 의미 붕괴 + 품절(0)/임박(1~n) 미구분 표기** — v1 시드 5 고정이라 무해. 5.7 설정 화면 또는 운영 피드백 시 정책 결정

## Deferred from: code review of 5-6-admin-lookup (2026-07-20)

- **검색 선해결(user/seller) LIMIT 200 절단 무신호** — v1 규모 무해. 대량화 시 절단 시 안내 응답 추가 (블루프린트)

## Deferred from: Epic 6 (2026-07-20) — 실서비스 오픈 게이트 항목

- **사업자 실정보 교체 (오픈 게이트 — 유지)** — 웹 `app/config/company.ts` placeholder → 실값 (상호·대표·사업자번호·통판신고·주소·연락처·이메일). 앱 ~~`lib/src/config/company.dart`~~ 부분은 2026-07-21 전환으로 소멸(앱 제거 예정, `sprint-change-proposal-2026-07-21.md` §5.6). **웹 항목은 그대로 오픈 게이트다** — 구매자 웹의 상품상세·주문서·내 정보에도 같은 값이 노출되므로 노출 면이 오히려 넓어진다 (EXPERIENCE.md 법적 고지 배치 규칙: 현재 화면에 `임시 정보` 태그 표기)
- **약관·개인정보처리방침 법률 검토** — 현재 초안 배너 명시 상태. 청약철회·환불 규정 확정 조항 포함
- **[소멸 2026-07-21]** ~~**웹 커스텀 도메인 → 앱 WEB_BASE_URL 주입 갱신**~~ — 앱이 약관·개인정보처리방침 등 웹 페이지를 열기 위해 필요했던 주입이다. 구매자 표면이 웹으로 단일화되어(AD-14) 앱→웹 링크 주입 대상 자체가 없어지므로 소멸 — `sprint-change-proposal-2026-07-21.md` §5.6. (커스텀 도메인 연결 자체는 이 항목의 범위가 아니었다)
- (기존 게이트 항목: PG 연동·정산, 도서산간 목록 공식 대조, CONCURRENTLY 인덱스, 모니터링)

## Deferred from: lint 베이스라인 정리 (2026-07-20, A-E456-5)

- **[해소 2026-07-20]** ~~**`window.location.href` 리다이렉트 잔여 2파일**~~ — `seller/products/new/page.tsx`·`apply/page.tsx` 4곳 전부 `router.replace()`(next/navigation)로 전환. 리다이렉트 목적지·조건 동일. apply의 useEffect 의존성에 `router` 추가(다른 화면 관례와 동일). `npm run lint`·`tsc --noEmit` 0. 앱 전체 `window.location` grep 잔여 0건

## Deferred from: Epic 8 구매자 반응형 웹 (2026-07-22)

- **[오픈 게이트] 약관 동의 이력이 서버에 남지 않는다** — `SignupRequest`·`users` 어디에도 동의 필드가 없다. Story 8.2가 회원가입 화면에서 필수 동의를 강제하지만 **기록은 남지 않는다.** ERD 변경이 필요해 Epic 8(프론트 전용) 경계 밖이다. PRD §8의 오픈 게이트 항목 "약관·개인정보처리방침 법률 검토(FR-33)"에 **"동의 이력 보관이 법적으로 요구되는지"** 를 함께 올려 판단한다. 요구되면 스키마 변경(AD-9 승인 게이트) + 백엔드 스토리가 따로 필요하다
- **`KAKAO_REDIRECT_URIS`가 Railway에 선언돼 있지 않다** — `.railway/railway.ts`의 web 서비스에 `KAKAO_REST_API_KEY`·`KAKAO_CLIENT_SECRET`·`KAKAO_APP_ID`는 `preserve()`로 있으나 리다이렉트 URI allowlist가 없어 백엔드가 기본값(`http://localhost:3000/...`)만 쓴다. **이 상태로는 프로덕션 카카오 로그인이 100% 실패한다.** Story 8.2의 선행 작업이며 카카오 개발자 콘솔 등록(로컬·프로덕션 두 값)과 Railway 변수 추가가 함께 필요하다 — 회고 R1대로 `railway ... --set`으로 넣고 즉시 확인, `railway.ts`에도 동시 선언
- **`middleware.ts`는 Next 16에서 deprecated** — `proxy.ts`로의 rename이 예고돼 있고 빌드 출력도 `ƒ Proxy (Middleware)`로 나온다. Story 8.1·8.2가 "기존 코드 문자 그대로 보존"을 회귀 증거로 쓰기 때문에 의도적으로 옮기지 않았다. **Epic 8 완료 후** 별도로 rename한다 — 그때는 diff가 순수 이동이라 검증이 쉽다
- **`/terms`·`/privacy`가 구매자 톤이 아니다** — 슬러 파랑 문서인데 구매자 회원가입 화면의 약관 `보기`가 이것을 연다. 알고 남기는 어긋남이며, 필요가 확인되면 구매자 톤 사본이 아니라 **양쪽에서 읽히는 중립 톤**으로 다듬는 쪽을 검토한다
- **[오픈 게이트] 중개자 고지 문구의 최종 확정** — 프로덕션 가동 중인 `BROKER_NOTICE`(`상품, 상품정보, 거래에 관한 의무와 책임은 판매자에게 있습니다`)와 UX 스파인이 적어둔 축약형(`상품 정보와 거래에 관한 책임은…`)이 달랐다. 2026-07-22에 **스파인을 코드에 맞춰 정정**하고 정본을 `apps/web/app/config/company.ts`의 상수로 못 박았다(화면은 문자열을 복사하지 않고 임포트한다). 다만 **문구 자체가 법적으로 적정한지는 검토되지 않았다** — PRD §8 오픈 게이트의 약관 법률 검토에 실사업자 정보 교체와 한 묶음으로 올린다
- **`바로 구매`의 목적지가 백엔드에 없다** — 주문 생성은 `cart_item_ids` 기반이고 미리보기(`POST /orders/preview`)도 장바구니를 전제한다. 상품상세의 `바로 구매`는 결국 담기를 거쳐야 한다. Story 8.3이 버튼 자리만 잡고, **8.4·8.5가 이 제약을 알고 설계해야 한다**(즉시 담기 후 `/checkout` 이동 등). 백엔드에 단품 주문 경로를 추가하는 것은 Epic 8 경계 밖
- **`sellers.brand_name`에 UNIQUE 제약이 없다** — Story 8.4가 장바구니 묶음을 `brand_name`으로 묶는다(`GET /carts` 응답에 `seller_id`가 없기 때문). **동명 브랜드가 두 팀 승인되면 두 판매자의 항목이 한 묶음으로 합쳐지고 배송비 2건이 1건처럼 보인다.** 입점 승인 시 중복을 막는 운영 규칙도 없다. 근본 해법은 `GET /carts` 응답에 `seller_id`를 싣는 것(백엔드 변경 — Epic 8 경계 밖)이며, 그 전까지는 **초청제라 운영자가 중복 브랜드명을 승인하지 않는 것**이 유일한 방어다. 판매자 5~10팀 규모에서는 실질 위험이 낮으나, 공개 전환 시 반드시 해소해야 한다
- **`purchasable` 판정에 수량이 섞여 있다** (`stock >= qty`) — 재고 3개인데 4개를 담으면 구매 불가로 뜨지만, 재고 수량이 응답에 없어 **화면이 "왜 안 되는지"를 설명할 수단이 없다.** 8.4는 일반 문구로 처리하고, 수량을 줄이면 다시 가능해진다는 사실을 사용자가 시도로 발견하게 된다. 재고 노출 여부는 v1 범위 밖 판단
- **[오픈 게이트] 입금 계좌가 문자열 하나다** — `settings`의 `deposit_account`가 단일 문자열이라 DESIGN.md·목업이 요구하는 `입금 계좌 / 예금주` **두 줄을 만들 수 없다**(현재 시드값 `은행/계좌번호/예금주 미설정`). 운영자가 한 문자열에 은행·계좌번호·예금주를 다 넣는 것 외에 방법이 없다. 구매자가 입금할 때 가장 많이 읽는 정보이므로 **실계좌 등록 시점(오픈 게이트)에 표기 형식을 함께 정해야 한다.** 필드 분리는 스키마 변경(AD-9 게이트)이라 Epic 8 경계 밖
- **`POST /orders` 201 응답에 `order_no`가 없다** — 주문완료 화면이 주문번호를 보여주려면 `GET /orders/{id}` 재조회가 **구조적으로 필수**다. Story 8.5가 그렇게 설계했고(D3) 새로고침·뒤로가기에도 견딘다. 응답에 `order_no`를 실으면 왕복 1회가 줄지만 백엔드 변경이라 Epic 8 밖
- **주문번호 표기가 목업과 실제가 다르다** — 목업은 `20260721-0037`(날짜+일련), 실제는 UUID 뒤 8자리 대문자. 목업 쪽이 사람이 읽고 부르기 쉬우나 일련번호 생성은 백엔드 변경이다. v1은 실제 값을 쓰고, 표기 형식 변경이 필요하면 PG 연동(Epic 7) 때 함께 판단한다
- **`3일`(미입금 자동취소 기한)이 화면에 하드코딩된다** — `unpaid_cancel_days`가 구매자 API로 내려오지 않아 문구에 숫자를 박게 된다. AD-13(SLUR 고유 값 하드코딩 금지)과 긴장 관계다. 백엔드가 이 값을 내려주거나, 화면이 기한 자체를 서버가 준 `expires_at`으로만 말하도록 바꾸는 것이 근본 해법
- **앱에 CSP가 없다** — Story 8.5가 다음(카카오) 우편번호 스크립트를 `t1.daumcdn.net`에서 동적 로드한다. 지금은 CSP가 없어 통과하지만, **CSP를 도입하는 시점에 이 호스트를 allowlist에 넣지 않으면 주문서가 조용히 깨진다.** 8.5는 스크립트 로드 실패 시 직접 입력 폴백을 필수로 두어 완주 자체는 막히지 않게 했다
- **[오픈 게이트] 제3자 스크립트 고지** — 다음 우편번호 스크립트가 청약 경로에 들어오므로 개인정보처리방침에 제3자 스크립트 사용 고지가 필요한지 법률 검토에 포함한다
- **구매자의 실제 취소 창은 `입금대기` 동안뿐이다** — 스파인은 "결제완료에서도 취소 계속 가능"으로 적어 두었으나, 관리자가 입금을 확인하면 백엔드가 활성 묶음을 **즉시 `배송준비`로 옮긴다**(Story 4.3의 연쇄). 배송준비는 취소 경계 밖이므로 결제완료 상태에서 취소할 수 있는 시간이 존재하지 않는다. 화면은 서버가 주는 `cancellable` 필드만 보므로 **동작은 정확하지만 문서의 기대가 틀렸다** — 2026-07-22에 스파인을 사실에 맞게 정정했다. 입금 확인 후에도 구매자 자유취소 시간을 주고 싶다면 **백엔드 전이 규칙을 바꾸는 판단**이 필요하다(FR-18 재해석, Epic 8 경계 밖)
- **주문 상세 응답에 상품 이미지가 없다** — `OrderCard`·`OrderLineView` 어디에도 `image_url`이 없고, 주문 성공 시 장바구니가 비워져 8.5식 합성도 불가하다. 목업은 주문내역·주문상세 모두 사진을 그리지만 **v1은 사진 없이 그린다**. 스냅샷(AD-7)에 이미지 URL을 추가하는 것이 근본 해법이며 백엔드 변경이다
- **취소된 묶음의 `shipping_fee`가 원래 값으로 내려온다**(합계에서는 제외됨) — 화면이 취소선 없이 그대로 그리면 숫자가 맞지 않아 보인다. Story 8.6이 취소선으로 처리한다
- **`GET /auth/me` 응답에 가입 경로(provider)가 없다** — 목업의 `가입 방식 이메일` 줄을 만들 수 없다. 카카오 가입자도 검증된 이메일을 저장하므로 `email` 유무로 추론하면 한쪽 방향만 참이다. Story 8.7은 **줄 자체를 만들지 않기로** 했다. 필요하면 `MeResponse`에 provider를 싣는 백엔드 변경이 필요하다
- **로그아웃 후 장바구니 배지가 남는다** — 8.4의 `CartCountProvider`가 `(buyer)/layout.tsx`에 있어 로그아웃 내비게이션으로 remount되지 않고, `router.refresh()`도 Context 값을 비우지 않는다. Story 8.7이 로그아웃 시 카운트를 명시적으로 비우는 것으로 처리한다. 같은 성질의 문제가 **다른 세션 만료 경로에서도 재발할 수 있다** — 401을 받은 화면이 배지를 비우는 규칙이 필요한지 Epic 8 회고에서 판단
- **아이콘·manifest는 라우트 그룹으로 가를 수 없다** — Next의 파일 컨벤션(`app/icon.png`·`app/manifest.ts`)이 앱 전체에 걸리므로, Epic 8이 지켜온 "콘솔 문서는 한 픽셀도 안 바뀐다"가 8.7부터는 문자 그대로 참이 아니다. 갈리는 것은 `theme-color`·`appleWebApp`뿐이며 이는 `(buyer)/layout.tsx`에만 선언해 콘솔 `<head>`를 건드리지 않는다. 파비콘은 앱 공통으로 바뀐다
- 🚨 **로컬 태그 `archive/open-gate-review-2026-07-21`이 원격에 없다** — `git ls-remote --tags origin` 출력이 **비어 있다(원격 태그 0개)**. 이 태그가 가리키는 커밋 `c484141`("코스 코렉션 Q1·Q2·Q3 확정")은 `origin/main`의 조상이 **아니어서** 이 머신에만 존재한다. **머신이 죽으면 그 커밋은 사라진다.** Story 8.8이 `flutter-app-final`에 대해 경고하는 사고가 이미 다른 태그에서 벌어져 있는 상태다. `git push origin archive/open-gate-review-2026-07-21`로 올릴지 Slur 판단 필요(새 객체를 발행하므로 자동으로 하지 않았다)
- **`POST /api/v1/auth/kakao/native` 계열이 클라이언트 0인 백엔드 잔재가 된다** — Flutter 앱이 유일한 사용처였다. 라우터·서비스·`kakao_app_id` 설정·`KAKAO_APP_ID` 환경변수·**테스트 4건**이 딸려 있어 지우면 153 → 149가 되고 Epic 8 전체가 근거로 삼은 "테스트 153건 무변경"이 깨진다. Epic 8 완료 후 별도로 정리한다. **`railway.ts`의 `KAKAO_APP_ID` 선언만 먼저 빼면 회고 R1식 사고가 재현되므로** 백엔드 코드와 반드시 함께 정리한다
- **`CLAUDE.md`의 `# 전체 테스트 (149)` 주석이 실제 153과 어긋나 있다** — A-E456-2·A-E456-6에서 테스트가 늘었는데 명령어 주석이 따라가지 않았다. Story 8.8이 같은 파일을 손대므로 그때 함께 고치는 것이 자연스럽다

