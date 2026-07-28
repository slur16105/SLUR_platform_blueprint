# 스크린샷

루트 [README.md](../../README.md)의 **기능 안내** 섹션이 참조하는 화면 캡처를 이 폴더에 둡니다.

로컬 스택을 띄우고(`docker compose up -d --build --wait` + `docker compose --profile tools run --build --rm seed`) 각 화면을 캡처해 아래 파일명으로 저장하면 README에 자동으로 표시됩니다. 권장 폭 ~1280px.

| 파일명 | 화면 | 경로 | 계정 |
| --- | --- | --- | --- |
| `buyer-home.png` | 편성 홈 | `/` | 비로그인 |
| `buyer-product-detail.png` | 상품 상세 | `/products/{id}` | 비로그인 |
| `buyer-cart.png` | 장바구니 | `/cart` | 구매자 |
| `buyer-checkout.png` | 주문서 | `/checkout` | 구매자 |
| `buyer-orders.png` | 주문 내역 | `/orders` | 구매자 |
| `buyer-me.png` | 내 정보 | `/me` | 구매자 |
| `buyer-login.png` | 로그인(약관 모달) | `/login` | 비로그인 |
| `seller-products.png` | 판매자 상품 관리 | `/seller` | `local-seller@example.com` |
| `seller-orders.png` | 판매자 주문 관리 | `/seller` | `local-seller@example.com` |
| `admin-approvals.png` | 입점 승인 | `/admin` | `local-admin@example.com` |
| `admin-home-curation.png` | 홈 편성 관리 | `/admin/home` | `local-admin@example.com` |
| `admin-deposits.png` | 입금 확인 | `/admin/deposits` | `local-admin@example.com` |

계정 비밀번호: 관리자 `local-admin@example.com` / `local-admin-password-2026`, 판매자 `local-seller@example.com` / `local-seller-password-2026`.

구매자 화면의 모바일 뷰는 같은 이름에 `-mobile.png` 접미사로 저장합니다(예: `buyer-home-mobile.png`). 뷰포트 390px, 하단 탭바 포함.

참고: `apps/web/public/submission-assets/screenshots/`의 기존 캡처 2장은 홈 편성(Epic 9) 반영 전 화면이라 최신이 아닙니다 — 새로 촬영을 권장합니다.
