# 적대적 리뷰 — ARCHITECTURE-SPINE (독립 빌더 드리프트 공격)

- 대상: `ARCHITECTURE-SPINE.md` (2026-07-15 draft)
- 방법: 한 단계 아래 유닛(auth/sellers/products/carts/orders/admin + Flutter/Next.js) 중 두 유닛을 골라, **각자 모든 AD를 문자 그대로 준수하면서도 서로 비호환으로 빌드되는** 시나리오를 구성. 실제 구현은 AI 에이전트 세션별 분담이므로 "독립 빌더" 가정은 가상이 아니라 기본 상황이다.
- 결론: **비호환 쌍 6건 발견.** 전부 기존 AD 위반 없이 성립한다 — 즉 스파인의 구멍이다. 각 건에 봉합용 AD 신설/강화안을 붙였다.

---

## 발견 1 — 재고 증감 코드의 소유자가 없다: orders와 admin이 각자 UPDATE를 쓴다 (이중 복원)

**공격 시나리오.**
AD-4는 재고 증감의 *형태*(조건부 UPDATE)만 규정하고 *소유자*를 규정하지 않는다. AD-2는 orders→products, admin→products를 모두 허용한다.

- **세션 A(orders 빌더):** AD-3의 단일 전이 함수 안에 "라인이 `canceled`로 전이 성공하면 조건부 UPDATE로 재고 복원"을 내장한다. 미입금 자동취소 배치·구매자 자유취소가 이 경로를 탄다. AD-3 준수(단일 통로), AD-4 준수(조건부 UPDATE).
- **세션 B(admin 빌더):** FR-29 "배송준비 이후 취소·환불 수동 처리"를 구현하며, 전이 함수 호출(AD-3 준수) **후에** admin service에서 별도의 조건부 UPDATE로 재고를 복원한다. AD-4가 요구하는 형태 그대로다.

결과: 관리자 강제 취소 1건에 재고가 **두 번 복원**된다. 반대 조합(둘 다 "상대가 하겠지"라고 가정)이면 **복원 누락**. 어느 세션도 AD를 어기지 않았다.

부속 모호점: AD-4의 "취소 확정 시"가 라인 `canceled` 전이 시점인지, `cancellations.환불 완료 시각` 기록 시점인지 정의가 없다 — 두 세션이 복원 *시점*을 다르게 잡아도 각자 합법이다. 또한 배송완료 후 환불(귀책: 판매자)처럼 **복원하면 안 되는 취소**의 구분도 없다.

**봉합 — AD-4 강화:**
> 재고 증감(차감·복원)을 수행하는 코드는 `products/service.py`의 함수 한 쌍(`deduct_stock`, `restore_stock`)뿐이다. 다른 도메인은 SQL을 직접 쓰지 않고 이 함수만 호출한다. 복원의 유일한 트리거는 AD-3 전이 함수가 라인을 `canceled`로 전이 성공시킨 직후이며(같은 트랜잭션), 그 외 어떤 코드 경로도 복원을 호출하지 않는다. 복원 없는 취소(예: 배송완료 후 환불)는 전이표의 전이 속성(`restock: bool`)으로 선언한다.

---

## 발견 2 — 상태 기계는 하나가 아니라 셋인데 AD-3은 표가 하나인 것처럼 말한다

**공격 시나리오.**
ERD상 상태는 세 곳에 있다: `orders`(결제: pending_payment→paid), `sub_orders`(배송: preparing→shipping→delivered), `order_items`(취소). FR-18의 체인 "입금대기→결제완료→배송준비→배송중→배송완료"는 **두 테이블에 걸친 가상 체인**이다.

- **세션 A(orders 빌더):** 전이표를 (엔티티, from, to, role) 3개 기계로 나눠 선언하고, `paid` 진입 시 sub_orders를 `preparing`으로 시드하는 연결 로직을 전이 함수 바깥에 둔다.
- **세션 B(admin 빌더):** FR-29 "상태 강제 변경"을 FR-18의 단일 체인으로 이해하고, 주문 하나의 "대표 상태"를 목표로 전이표를 조회한다 — 그런데 AD-6에 따라 대표 상태는 저장되지 않는 파생값이다. B는 파생값을 from으로 놓고 전이표를 검사하는, A와 구조적으로 다른 기계를 만든다.

추가 균열 두 개:
1. **교차 엔티티 가드.** FR-18 "구매자 자유취소는 배송준비 진입 전까지" — order_items의 취소 전이 허용 여부가 **sub_orders의 배송 상태**에 달려 있다. AD-3의 전이표 스키마는 (현재, 목표, 역할)뿐이라 이 가드를 표현할 자리가 없다. 세션마다 가드를 전이 함수 안/밖 임의 위치에 넣게 되고, admin 경로가 가드를 우회해도 AD 위반이 아니다.
2. **역할 `system`.** 미입금 자동취소 배치의 수행 주체는 구매자도 관리자도 아니다. 역할 열에 `system`이 없으면 배치 빌더는 역할 검사를 건너뛰는 자체 통로를 만들거나(단일 통로 붕괴) 관리자 역할을 사칭한다.
3. **order_events 범위.** AD-3은 "전이 성공 시 order_events 기록"이라 하지만 order_events는 orders에만 걸려 있다. sub_order·라인 전이가 기록 대상인지 세션마다 해석이 갈린다.

**봉합 — AD-3 강화:**
> 상태 기계는 정확히 3개다: `orders.payment_status`, `sub_orders.shipping_status`, `order_items.cancel_status`. 전이표 스키마는 (기계, from, to, 허용 역할[system 포함], 가드 이름, restock 여부)이며, 가드(예: `sub_order_not_yet_preparing`)는 전이 함수 내부에서만 평가된다. 세 기계 모두 단일 전이 함수를 공유하고, 모든 전이는 엔티티 무관하게 `order_events`(order_id + 대상 엔티티/ID 컬럼)에 기록한다. 기계 간 연쇄(paid→sub_orders 시드)도 전이 함수의 후처리로만 선언한다.

---

## 발견 3 — "구매 불가" 판정 술어를 carts와 orders가 각자 구현한다

**공격 시나리오.**
FR-35는 판정을 두 번 요구한다: 장바구니 표시 시(carts)와 주문 생성 시(orders). AD-2상 carts→products, orders→products 둘 다 합법이므로 두 세션이 **같은 질문에 대한 술어를 각자 작성**할 수 있다.

- **세션 A(carts):** 구매 불가 = 상품 숨김 ∨ 상품 삭제 ∨ variant 판매상태 품절. (재고 수량은 "주문 시 검증하겠지"라며 제외 — FR-10이 재고 0=자동 품절이라 했으니 판매상태만 보면 된다고 해석.)
- **세션 B(orders):** 구매 불가 = 위 조건 ∨ 재고 < 요청 수량 ∨ **판매자 계정 비활성**. (수동 품절 토글과 재고 0 자동 품절이 별개 플래그라면 A의 해석과 실제로 어긋난다.)

결과: 장바구니는 "구매 가능"으로 보여주는데 주문서는 거부하는 항목(신뢰 손상), 또는 그 반대로 장바구니가 과잉 차단하는 항목이 상시 발생한다. FR-10의 "재고 0 자동 품절"이 트리거로 구현되는지(차감 시 판매상태 갱신) 조회 시 계산되는지도 세션마다 갈린다 — 이것도 소유자 미지정.

부수 구멍: 주문 성공 후 장바구니 항목 제거는 누가 하나? AD-2상 orders→carts는 합법이지만 의무가 아니다. orders가 안 지우고 carts도 모르면 항목이 남는다.

**봉합 — 신규 AD:**
> "구매 가능" 판정은 products가 소유한다: `products.service.validate_purchasable(items: [(variant_id, qty)]) -> 항목별 사유` 단일 함수. carts(표시용)와 orders(주문 생성 시 재검증용)는 이 함수만 호출하고 자체 판정 로직을 두지 않는다. 재고 0 ↔ 자동 품절의 동기화도 products의 deduct/restore(발견 1의 함수) 내부에서만 처리한다. 주문 생성 성공 트랜잭션의 마지막 단계에서 orders가 `carts.service.remove_ordered_items()`를 호출한다.

---

## 발견 4 — 배송비·도서산간 계산은 소유 도메인이 없고, AD-2 그래프상 orders는 sellers에 도달할 수 없다

**공격 시나리오.**
FR-16/17: 주문 금액 = 상품 합계 + 판매자별 배송비 + 도서산간 추가비(우편번호 판정). 배송비 설정은 sellers 소유(스파인 패키지 주석), 주문서 합산은 orders, 주문 전 미리보기는 carts 화면의 일이다. 그런데 **AD-2 그래프에 orders→sellers 간선이 없다.**

- **세션 A(orders):** 간선이 없으니 orders→products→sellers로 우회한다 — products에 `get_shipping_fee(seller_id)` 같은 **상품과 무관한 통과 함수**가 생긴다(그래프 준수, 경계 오염). 그리고 배송비를 주문 시점에 계산해 sub_orders에 스냅샷한다.
- **세션 B(Next.js/Flutter + carts):** 주문서 미리보기 금액을 위해 carts가 같은 계산을 **또 하나** 구현하거나, 클라이언트가 판매자 설정을 받아 직접 합산한다 — 후자는 "비즈니스 로직은 FastAPI만"(AD-1)의 회색지대다(계산은 로직인가 표시인가?). 도서산간 우편번호 목록도 소유자가 없어 core/sellers/orders 어디든 갈 수 있고, 두 계산기의 판정 데이터가 어긋날 수 있다.

스냅샷 구멍: AD-7은 order_items(상품)만 스냅샷을 강제한다. 배송비를 스냅샷 안 하는 빌더(조회 시 재계산)는 AD 위반이 아니고, 판매자가 배송비를 바꾸면 **과거 주문 총액이 바뀐다** — AD-7이 막으려던 바로 그 사고의 배송비 판이다.

**봉합 — 신규 AD + AD-2/AD-7 수정:**
> 배송비·도서산간 계산은 sellers가 소유한다: `sellers.service.quote_shipping(seller_id, postal_code) -> 원 단위 정수`. 도서산간 우편번호 데이터도 sellers 소유. AD-2 그래프에 `orders --> sellers`, `carts --> sellers` 간선을 추가한다(합산 지점이 직접 호출). 주문 생성 시 sub_orders에 배송비·도서산간비를 스냅샷하고(AD-7 확장: "금액을 구성하는 모든 값은 주문 시점 스냅샷"), 주문 조회는 스냅샷만 읽는다. 클라이언트는 금액을 계산하지 않는다 — 미리보기 금액도 API(quote 엔드포인트)가 내려준다.

---

## 발견 5 — 에러 봉투 `{code, message, details}`는 두 클라이언트가 다르게 해석하기에 충분히 비어 있다

**공격 시나리오.**
Consistency 표는 봉투의 키 이름만 정한다. 갈라질 축이 최소 넷:

1. **code의 타입·체계.** Flutter 세션은 `code`를 정수(HTTP status 복제)로 파싱하는 모델을 만들고, Next.js 세션은 `"stock_insufficient"` 같은 문자열 도메인 코드를 기대한다. 백엔드 세션이 어느 쪽을 내보내든 한 클라이언트는 깨진다. 코드 레지스트리(전체 코드 목록의 단일 출처)가 없다.
2. **FastAPI 기본 422.** Pydantic 검증 실패의 기본 응답은 `{"detail": [...]}` — 봉투가 아니다. "core 전역 핸들러가 변환한다"는 규칙이 `RequestValidationError`까지 포괄하는지 명시가 없어, 백엔드 세션이 422를 기본형으로 방치하면 봉투만 파싱하는 Flutter는 검증 오류에서 크래시/무한 스피너가 된다. 401 refresh 플로우도 동일 — 두 클라이언트가 "토큰 만료"를 code로 식별할지 HTTP 401 자체로 식별할지 갈린다.
3. **details의 형태.** FR-35 "어떤 항목이 문제인지 알려준다"의 페이로드가 details에 실릴 텐데 스키마가 없다. 백엔드가 `[{variant_id, reason}]` 배열을 주고 Flutter가 `{variant_id: reason}` 맵을 기대하는 드리프트가 전형적이다.
4. **message의 언어.** AD-8은 "한국어 표시는 클라이언트 표현 계층의 일"이라 한다. 이를 문자 그대로 읽은 백엔드 세션은 message를 영어 디버그 문자열로 넣고, Flutter 세션은 message를 그대로 토스트에 띄운다(반대로 Next.js는 code→한국어 매핑 테이블을 만든다). 같은 오류가 앱에선 영어, 웹에선 한국어로 보인다.

**봉합 — 신규 AD:**
> 에러 계약: `code`는 영어 소문자 snake_case 문자열이며, 전체 코드와 각 code별 `details` JSON 스키마는 core의 단일 파일(에러 레지스트리)에 선언한다 — 새 에러는 레지스트리에 추가해야만 던질 수 있다. core 전역 핸들러는 `RequestValidationError`·`HTTPException` 포함 모든 예외를 봉투로 변환한다(봉투 아닌 응답은 계약 위반). `message`는 사용자에게 보여도 되는 한국어 기본 문구이고, 클라이언트는 code 기준 분기·code 매핑이 없으면 message를 그대로 표시한다. 토큰 만료는 code `token_expired`로 식별한다(HTTP 401 단독 판정 금지).

---

## 발견 6 — "대표 상태 파생"의 공식이 없어서 백엔드·Flutter·Next.js가 세 가지 답을 낸다

**공격 시나리오.**
AD-6은 대표 상태를 "파생 계산"하라고만 하고 **공식과 계산 위치**를 정하지 않는다. 파생은 자명하지 않다: 라인 2개 중 1개 취소 + sub_order A는 shipping, B는 preparing인 주문의 대표 상태는? 전 라인 취소면 sub_order 배송 상태와 무관하게 canceled인가?

- **세션 A(orders API):** 목록 API에 파생 상태를 포함해 내려준다 — 공식: "하나라도 shipping이면 shipping".
- **세션 B(Flutter):** API에 그 필드가 있는 줄 모르고(또는 없다고 보고) sub_orders 배열에서 직접 파생한다 — 공식: "가장 뒤처진 상태" (min). 같은 주문이 앱과 웹에서 다른 상태로 보인다. 두 세션 모두 AD-6("컬럼으로 저장 안 함")을 완벽히 준수했다.

이건 AD-1("비즈니스 로직은 FastAPI만")의 정신 위반이지만 문자로는 안 걸린다 — 파생 계산을 "표현"으로 우기면 클라이언트 구현이 합법이 되기 때문.

**봉합 — AD-6 강화:**
> 대표 상태의 파생 공식은 `orders/service.py`의 단일 함수로 구현하고, 주문 목록·상세 API 응답에 `display_status` 필드로 항상 포함한다. 클라이언트는 이 필드를 표시만 하고 재계산하지 않는다(sub_order·라인 상태로부터의 자체 파생 금지). 공식 자체(우선순위: canceled < pending_payment < paid < preparing < shipping < delivered 중 어떤 집계인지)는 전이표 옆에 데이터로 선언한다.

---

## 요약 표

| # | 비호환 쌍 | 갈라지는 지점 | 봉합 |
| --- | --- | --- | --- |
| 1 | orders ↔ admin | 재고 복원의 소유·트리거·시점 (이중 복원/누락) | AD-4 강화: products 단일 함수 + 전이표 `restock` 속성 |
| 2 | orders ↔ admin(+배치) | 상태 기계 1개 vs 3개, 교차 가드, system 역할, order_events 범위 | AD-3 강화: 3-기계 명시 + 가드/역할/이벤트 스키마 |
| 3 | carts ↔ orders | "구매 불가" 술어 이중 구현, 주문 후 장바구니 정리 | 신규 AD: products 소유 `validate_purchasable` 단일 술어 |
| 4 | orders ↔ carts/클라이언트 (+sellers) | 배송비·도서산간 계산 소유 부재, orders→sellers 간선 부재, 배송비 미스냅샷 | 신규 AD: sellers 소유 quote 함수 + AD-2 간선 추가 + AD-7 확장 |
| 5 | Flutter ↔ Next.js (↔ 백엔드) | code 타입, 422 기본형, details 스키마, message 언어 | 신규 AD: core 에러 레지스트리 + 전 예외 봉투 강제 |
| 6 | 백엔드 ↔ Flutter ↔ Next.js | 대표 상태 파생 공식·계산 위치 미정 | AD-6 강화: 서버 단일 파생 + `display_status` 응답 필드 |

주: 신규/강화 AD가 ERD·컬럼에 닿는 부분(전이표 속성, sub_orders 배송비 컬럼, order_events 대상 엔티티 컬럼)은 AD-9 게이트 대상 — 반영 전 Slur 승인 필요.
