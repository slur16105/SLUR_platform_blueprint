# 스크린샷

루트 [README.md](../../README.md)의 **기능 안내** 섹션이 참조하는 화면 캡처입니다.

## 다시 찍기

```bash
docker compose up -d --build --wait
docker compose --profile tools run --build --rm seed
docker compose exec -T api uv run python -m app.local_seed_bulk      # 데모 주문·판매자 (선택)
docker compose exec -T api uv run python -m app.local_seed_history   # 과거 30일치 (선택)

npx playwright install chromium
node docs/shoot.mjs docs/screenshots
```

`docs/shoot.mjs`가 역할별로 로그인해 28개 화면을 찍습니다. 파일명이 README의 이미지 경로와
1:1로 맞춰져 있어 다시 찍으면 문서가 자동 갱신됩니다.

## 파일

| 접두사 | 역할 | 계정 |
| --- | --- | --- |
| `buyer-*` | 구매자 | `local-buyer@example.com` / `local-buyer-password-2026` |
| `seller-*` | 판매자 | `local-seller@example.com` / `local-seller-password-2026` |
| `admin-*` | 관리자 | `local-admin@example.com` / `local-admin-password-2026` |

`*-mobile.png`와 `admin-approvals.png`·`admin-home-curation.png`는 2026-07-28에 찍은 것으로,
보고서(`docs/report-2026-08-01.html`)의 "이전" 자료로도 쓰입니다.

---

## 촬영 절차 (원문)

로컬 스택을 띄우고 데모 데이터를 넣은 뒤, 캡처 스크립트를 실행하면 `docs/screenshots/`가 갱신됩니다.

```bash
# 1) 스택 + 기본 시드
docker compose up -d --build --wait
docker compose --profile tools run --build --rm seed

# 2) 화면이 비어 보이지 않도록 데모 데이터 채우기(선택)
docker compose exec -T api uv run python -m app.local_seed_bulk      # 판매자·상품·주문 34건
docker compose exec -T api uv run python -m app.local_seed_history   # 과거 30일치 주문(기간 탭 확인용)

# 3) 캡처 (playwright 필요)
npx playwright install chromium
node docs/shoot.mjs docs/screenshots
```

`docs/shoot.mjs`가 역할별로 로그인해 28개 화면을 찍습니다. 파일명은 README의 이미지 경로와 1:1로 맞춰져 있어, 다시 찍으면 문서가 자동으로 갱신됩니다.
