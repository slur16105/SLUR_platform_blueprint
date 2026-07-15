# 주문 취소·상태 표시 선례 벤치마킹 (2026-07-15, 웹 리서치)

## 1. 네이버 스마트스토어 — 취소의 단위는 "상품주문"
주문(order) 아래 상품별로 "상품주문번호(productOrderId)"가 발급되고, 취소·반품·교환 클레임은 모두 이 상품주문 단위로 처리됨. 부분 취소는 별도 개념이 아니라 "특정 상품주문에 대한 취소 클레임"으로 자연스럽게 구현됨. 2024년 이후 수량 단위 부분 클레임도 추가(`quantityClaimCompatibility`). 흐름: 발주확인 전 구매자 취소는 즉시 환불(자동), 발주확인 후에는 "취소요청 → 판매자 승인/거부" 2단계. ([커머스API GitHub](https://github.com/commerce-api-naver/commerce-api/discussions/1773), [네이버페이센터 취소/반품 가이드 PDF](https://campaign-cdn.pstatic.net/filemanager/static/naverpay_guide/pdf/10_%EC%A3%BC%EB%AC%B8%ED%98%95_%EC%B7%A8%EC%86%8C%EB%B0%98%ED%92%88%EA%B5%90%ED%99%98%EA%B4%80%EB%A6%AC_713.pdf))

## 2. 쿠팡·무신사·29CM
- 쿠팡: 주문 내 상품 단위 부분 취소 지원. 출고 전까지 취소 가능, 출고 후엔 반품으로 전환. ([취소/반품 안내](https://www.coupang.com/np/etc/returnPolicy), [Open API 부분취소 FAQ](https://developers.coupangcorp.com/hc/ko/articles/360023109293))
- 무신사: "상품준비중" 진입 즉시 고객 직접 취소 차단 — 타 오픈마켓보다 엄격해 소비자 불만 기사 다수. 부분 취소 시 남은 상품 금액 기준으로 할인 재계산. ([소비자가만드는신문](https://www.consumernews.co.kr/news/articleView.html?idxno=616275), [무신사 FAQ](https://www.musinsa.com/cs/faq?mainCategory=004))
- 29CM: 브랜드(파트너)별 출고 구조, 취소는 "취소신청→취소승인→환불" 단계이며 상품준비 단계부터 파트너 승인 필요. ([29CM FAQ](https://www.29cm.co.kr/mypage/cscenter/faq-cs/faq-list))

## 3. 판매자 귀책(품절) 취소
네이버: 판매자 품절 취소 건당 페널티 2점, 최근 90일 10점 누적 시 노출 제한~판매 정지. 환불은 취소 처리와 동시에 자동. 쿠팡도 품절 취소를 주문이행률에 반영, 직권 환불 금액은 정산에서 차감. ([스토어아트](https://www.storeartmagazine.com/news/articleView.html?idxno=670), [쿠팡 판매자 관리 정책](https://marketplace.coupang.com/blogs/blog-news8))

## 4. 주문 목록의 대표 상태 표시
네이버·무신사 모두 "주문 1건 = 1카드"로 묶되, 카드 내부에 배송 묶음별 상태 뱃지를 각각 표시 — 주문 레벨 대표 상태를 억지로 하나 만들지 않음. 요약 화면에서는 "배송중 2건" 식 카운트 표기. (앱 실물 UX 관찰 기반)

## 5. 오픈소스 데이터 모델
- Saleor: 주문 레벨 status에 CANCELED(전체 취소), 라인 레벨엔 cancel 상태 없이 수량 필드로 관리, fulfillment 객체가 자체 CANCELED 보유. PARTIALLY_FULFILLED 등 주문 상태는 라인에서 파생 계산. ([Order Status](https://docs.saleor.io/developer/checkout/order-status))
- Medusa: order.status에 canceled(전체), fulfillment 단위 cancel 워크플로 별도. ([cancelOrderWorkflow](https://docs.medusajs.com/resources/references/medusa-workflows/cancelOrderWorkflow))

## 소규모 v1(무통장·수동 환불) 시사점
업계 공통 패턴: **취소 상태는 라인(상품주문) 레벨, 주문 레벨 상태는 파생.**
1. order_item에 status(CANCEL_REQUESTED/CANCELED 포함) — 부분 취소 자동 해결
2. 취소 사유·귀책·"취소 승인"과 "환불 완료" 분리 타임스탬프는 별도 클레임 테이블 — 수동 환불이므로 필수
3. 취소 가능 시점은 "발주확인(배송준비) 전 = 즉시, 후 = 요청/승인" 단일 분기점
4. 주문 대표 상태는 저장하지 않고 라인 상태 집계로 표시 (Saleor 방식)
5. 수량 단위 부분취소는 v1 제외, 라인 단위 전량 취소만
