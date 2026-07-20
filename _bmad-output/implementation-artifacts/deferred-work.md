# Deferred Work

리뷰·스토리 진행 중 이월된 항목의 로그. "지금은 안 하기로 결정"한 근거와 재개 조건을 남긴다.

## Deferred from: code review of 4-1-cart (2026-07-19)

- **합산 후 총량 재고 초과 담기 policy 유지** — `apps/api/app/carts/service.py:25~46` `add_item`은 요청 수량만 술어 검증. 스토리 Completion Notes에서 policy로 확정. 4.4 주문 생성이 조건부 UPDATE로 최종 진실 보장 (`AD-4`). 담기 → 즉시 구매 불가 UX 단절은 감수
- **variants upsert flush 순서 임시 UNIQUE 위반 위험** — `apps/api/app/products/service.py:152~174`. 판매자가 조합 A ↔ B 옵션 값 스왑 시 auto-flush 임시 상태에서 UNIQUE 위반 가능. 현재 IntegrityError를 `duplicate_variant`로 잡아 낼 수 있음(원인 메시지는 실제와 다름). 완화 시 삭제 flush 선행 필요 → 4.1 범위 밖, 별도 스토리로 승격 후보
- **Flutter cart_screen guard() finally 무조건 invalidate** — `apps/mobile/lib/src/carts/cart_screen.dart:96~98`. 성공·실패 무관 refresh로 실패 스낵바 직후 화면 튐. 정합성 편에 서 유지. 성공 시에만 invalidate로 전환 시 오히려 서버 상태 반영 지연 리스크
- **IntegrityError 원인 판정 문자열 매칭 취약** — `apps/api/app/products/service.py:179` `replace_variants`가 `"variants" in str(exc.orig) and "unique" in ...`로 constraint를 판별. PG 오류 메시지 포맷 변경에 취약. `exc.orig.diag.constraint_name` 기반으로 승격 후보. 실용상 즉시 위험 없음
- **담기 합산·캡의 race 테스트 부재** — `apps/api/tests/test_carts.py:159~172`. 순차 담기만 검증. `asyncio.gather()`로 병행 담기 시 원자적 upsert·999 캡 안전성 회귀 봉인 테스트 후속
- **Alembic downgrade가 cart_items를 drop만 함** — `apps/api/alembic/versions/7fceea006abe_cart_items.py:41~46`. 프로덕션 롤백 시 카트 데이터 유실. 일반 alembic 관행이며 v1 완주엔 지장 없음
- **AD-13: `999` 리터럴 4곳 확산** — `carts/service.py:16`, `carts/models.py:22`, `carts/schemas.py:8,12`, `cart_screen.dart:140,144`, `product_detail_screen.dart:116`. 스토리 스펙이 "1~999 서버·클라 양쪽 강제"로 고정했으므로 v1 지장 없음. 블루프린트 추출 시 `core/config`로 승격
- **RefreshIndicator future await 형식** — `cart_screen.dart:27` `onRefresh: () async => ref.refresh(cartProvider.future)`가 arrow 함수라 반환된 Future를 자동 await하지 않아 스피너가 조기 dismiss 가능. `() async { await ref.refresh(cartProvider.future); }` 명시 형식으로 승격
- **사용자 이탈 후 API 실패 시 스낵바 유실** — `cart_screen.dart:92~95`. `context.mounted == false`면 오류 표시 없이 무음. 로깅·재시도 큐 후속
- **PATCH `quantity=1000` 방어 테스트 부재** — 스테퍼가 강제하므로 실용 영향 없으나 API 계약 회귀 봉인 후보
- **variants upsert exact 매칭 — 대소문자·strip 이후 남는 공백만 다르면 SET NULL 조용한 소멸** — `apps/api/app/products/service.py:158`. UX 가이드(대소문자 표기 통일) + 판매자 저장 시 정규화 후속

## Deferred from: code review of 4-2-order-model-shipping-calc (2026-07-20)

- **마이그레이션의 CSV 런타임 의존** — `alembic/versions/0275fa5bfee4`가 `app/orders/data/remote_area_zips.csv`를 실행 시점에 읽음. CSV 갱신 시 신규 환경 시드가 프로덕션과 달라질 수 있음(리비전 불변성). v1 단일 환경에선 무해, 검증 로직으로 완화됨. 블루프린트 추출 시 시드를 마이그레이션 밖 멱등 스크립트로 분리 검토
- **도서산간 시드 출처 격상** — 현재 택배사 공통 기준표의 서드파티 재게시본(campaignus/imweb, 오탈자 2건 교차 보정). 공식 우체국/CJ대한통운 목록과 표본 대조 후 기준일 갱신 후속
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

- **사업자 실정보 교체** — 웹 `app/config/company.ts`·앱 `lib/src/config/company.dart` placeholder → 실값 (상호·대표·사업자번호·통판신고·주소·연락처·이메일)
- **약관·개인정보처리방침 법률 검토** — 현재 초안 배너 명시 상태. 청약철회·환불 규정 확정 조항 포함
- **웹 커스텀 도메인 → 앱 WEB_BASE_URL 주입 갱신**
- (기존 게이트 항목: PG 연동·정산, 도서산간 목록 공식 대조, CONCURRENTLY 인덱스, 모니터링)
