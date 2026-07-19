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
