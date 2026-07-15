# 상품 옵션·재고 표준 모델 벤치마킹 (2026-07-15, 웹 리서치 서브에이전트)

## 1. 네이버 스마트스토어
- 옵션 유형: **선택형(단독형/조합형)·직접입력형·표준형(일부 카테고리 한정 간편옵션)**. 옵션값별 재고·추가금액 관리가 되는 것은 **조합형**(과 표준형)뿐 — 실무 표준은 조합형.
- 조합형: 옵션명(축) **최대 3개**, 조합(행) 생성 후 행마다 **추가금액·재고수량·판매상태**를 표(그리드)에서 입력. API상 `optionCombinationGroupNames`(축 이름) + `optionCombinations[]`(조합별 stockQuantity, price 등) 구조.
- 단독형(선택형 단독): 옵션명 최대 5개·옵션명당 100개(총 500개), 재고/추가금액 미관리. 직접입력형은 구매자가 텍스트 입력(각인 등).
- 추가금액 제한: 판매가 2천원 미만 0~+100%, 2천~1만원 -50%~+100%, 1만원 이상 **-50%~+50%**.
- 재고 0 → 자동 품절 전환(노출 불리).
- 출처: [커머스API Discussion #605](https://github.com/commerce-api-naver/commerce-api/discussions/605), [#1894](https://github.com/commerce-api-naver/commerce-api/discussions/1894), [옵션 제한 기준 공지](https://fanfanseller.kr/front/customer/viewMallNotice.do?atclNo=366), [추가금액 제한 정리](https://delivery-agency.windly.cc/0dd28584-c187-423b-b583-2702b550fe6d), [옵션 설정 해설](https://talk.cashnote.kr/article/CONTENT/39500)

## 2. 카페24 / 아임웹
- **카페24**: 옵션을 **품목생성형**(옵션 조합 = "품목" 생성, 품목별 재고 관리, 상품당 최대 1,000품목; 조합 일체선택형/분리선택형) vs **상품연동형**(품목 무제한이나 재고는 상품 단위만) 으로 구분. 품절기능 사용 설정 시 재고 0 → 구매 차단, "품절 품목 노출 여부"를 별도 옵션으로 제공(노출안함 가능). 출처: [옵션방식별 차이](https://support.cafe24.com/hc/ko/articles/17470510862105), [재고·품절 FAQ](https://support.cafe24.com/hc/ko/articles/17457549008793), [옵션/재고 설정 가이드](https://serviceguide.cafe24.com/supply/ko_KR/PR.PE.RE.TT.html)
- **아임웹**: 옵션 2개 이상이면 **조합형/비조합형** 선택. 조합에 따라 가격·재고가 달라지면 조합형. "재고관리 사용" 토글 활성화 시 옵션 행별 재고 입력, 옵션 상태는 **판매중/품절/숨김** 3단계(상품 단위도 동일 3단계). 출처: [옵션 타입 종류](https://imweb.me/faq?mode=view&category=29&category2=40&idx=71521), [옵션 수정](https://imweb.me/faq?mode=view&category=29&category2=40&idx=71522), [상품 상태](https://imweb.me/faq?mode=view&category=29&category2=40&idx=71541)

## 3. Shopify Product-Variant 모델
- 구조: **Product → Options(축, 최대 3개) → Variants(옵션값 조합 = 구매 단위 SKU)**. variant별로 가격·SKU·바코드·재고를 개별 관리. 재고는 variant에 직접 붙지 않고 **InventoryItem → InventoryLevel(위치별 수량)** 로 분리.
- 2024년 GraphQL 신모델 도입 후 **2025-10-15부로 전 머천트 variant 한도 100 → 2,048개** 확대(옵션 축 3개 제한은 유지).
- 출처: [Shopify dev changelog](https://shopify.dev/changelog/the-product-variant-limit-is-now-2048-for-all-merchants), [Product model components](https://shopify.dev/docs/apps/build/graphql/migrate/new-product-model/product-model-components), [Help: Adding variants](https://help.shopify.com/en/manual/products/variants/add-variants)

## 4. 재고 관리 표준 관행
- **수량 재고가 표준, 품절 토글은 보조**: 주요 플랫폼 모두 SKU별 수량 관리 + "재고 0 = 자동 품절"이 기본이고, 수동 품절/숨김 토글을 병행 제공(아임웹·카페24).
- **차감 타이밍**: 장바구니 담기 시점 차감은 비표준(재고 잠김 문제). 표준은 ① 주문/결제 시점 차감, 또는 ② 체크아웃 진입 시 **soft reservation(5~15분 만료 타이머)** → 결제 완료 시 hard reservation 전환. 소규모에서는 "결제 완료 시 원자적 차감 + 결제 직전 재고 재검증"이면 충분.
- **오버셀 방지**: 단일 중앙 재고 + DB 원자적 차감(조건부 UPDATE/락), 주문 제출·결제 양 시점 검증. 재고 0 노출은 "품절 표시 유지"(구매버튼 비활성) 또는 "옵션 숨김" 중 정책 선택.
- 출처: [Stoa: Inventory Reservation Patterns](https://stoalogistics.com/blog/inventory-reservation-patterns), [Shopify Engineering: inventory reservations](https://shopify.engineering/scaling-inventory-reservations), [Queue-it: Overselling](https://queue-it.com/blog/overselling/), [Adobe Commerce reservations](https://experienceleague.adobe.com/en/docs/commerce-admin/inventory/basics/selection-reservations)

## 5. 오픈소스 데이터 모델 참고
- **Medusa**: Product → ProductVariant(`manage_inventory`, `allow_backorder` 플래그) → InventoryItem → InventoryLevel(위치별). 재고 모듈이 상품 모듈과 분리. [Variant Inventory 문서](https://docs.medusajs.com/resources/commerce-modules/product/variant-inventory), [Inventory in Flows](https://docs.medusajs.com/resources/commerce-modules/inventory/inventory-in-flows)
- **Saleor**: Product → ProductVariant(속성 조합) → Stock(창고별 수량 + `quantity_allocated` 예약분) 구조 — 주문 시 allocation, 출고 시 차감하는 2단계가 문서화된 좋은 레퍼런스. [docs.saleor.io](https://docs.saleor.io/)

## 시사점 — 소규모 v1 최소 모델
판매자 5~10팀·디자인 소품 도메인이면 Shopify 축소판이 정답에 가깝다: **상품 → 옵션 축 최대 2개(예: 색상×사이즈) → 조합 행(variant)별 [옵션값, 추가금액, 재고수량, 판매상태] 4열 표** 하나로 등록 UX와 데이터 모델을 통일한다(옵션 없는 상품은 variant 1개로 내부 처리 — 모든 플랫폼 공통 패턴). 조합 수 상한은 50~100이면 충분하고, 단독형/직접입력형·다중 창고·soft reservation은 v1에서 제외. 재고는 수량 기반 + 수동 품절 토글 병행, 차감은 **결제 완료 시점에 조건부 UPDATE로 원자적 차감**(음수 방지), 재고 0 옵션은 선택 목록에서 "품절" 표기로 비활성화가 최소 안전선이다. 추가금액 범위 제한(스마트스토어식 ±50%)은 v1에선 정책 문서로만 두고 시스템 강제는 생략 가능하다.
