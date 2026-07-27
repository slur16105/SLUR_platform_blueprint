# Hub맥 Docker 로컬 실행

Railway를 바로 종료하기 전, 이 구성이 API·웹·Postgres와 Alembic 마이그레이션을 Hub맥에서 함께 실행하는 기본 테스트 경로다. Railway/Supabase의 기존 데이터와 환경변수는 이 구성에서 변경하지 않는다.

## 최초 실행

```bash
cp .env.example .env
# .env의 POSTGRES_PASSWORD와 JWT_SECRET을 랜덤값으로 교체한다.
docker compose up -d --build --wait
```

브라우저: <http://localhost:3000>
API 상태: <http://localhost:8000/api/v1/health>

### 메인맥에서 Hub맥으로 접속

Hub맥과 메인맥이 같은 Wi‑Fi에 연결된 경우, 메인맥 브라우저에서 `http://<Hub맥-LAN-IP>:3000`을 연다.

```bash
# Hub맥에서 현재 LAN IP 확인
ipconfig getifaddr en0
```

현재 Hub맥 주소가 `192.168.0.192`라면 메인맥 접속 주소는 <http://192.168.0.192:3000>이다. DHCP 환경에서는 IP가 바뀔 수 있으므로 재확인한다.

`migrate` 서비스는 Railway의 `preDeployCommand`를 대체한다. Alembic을 현재 head까지 적용하고 정상 종료하는 것이 정상 동작이다.

## 일상 명령

```bash
# 상태와 로그
docker compose ps
docker compose logs -f api web

# 중지 — 로컬 DB 볼륨은 보존
docker compose down

# 재기동
docker compose up -d --wait

# Supabase와 분리된 로컬 데모 카탈로그 생성 (카테고리 2개, 상품 6개)
# ENVIRONMENT=local + Docker Postgres에서만 실행되며 여러 번 실행해도 no-op
docker compose --profile tools run --rm seed

# 로컬 테스트 DB까지 완전히 폐기 (되돌릴 수 없음)
docker compose down -v
```

## 환경변수

- `.env`는 Git에서 제외된다. 실제 비밀값·Supabase 키·카카오 키는 이 파일에만 둔다.
- `.env.example`은 값 없는 공유용 예시다.
- `KAKAO_REDIRECT_URIS`는 Pydantic 리스트 설정이므로 JSON 배열이어야 한다.
  - 예: `["http://localhost:3000/api/auth/kakao/callback"]`
- 카카오 로그인 실제 왕복을 시험할 때는 카카오 콘솔 등록값, `KAKAO_REDIRECT_URI`, `KAKAO_REDIRECT_URIS`가 글자 단위로 같아야 한다.

## 데이터 경계

이 Compose의 Postgres 볼륨은 빈 로컬 테스트 DB로 시작한다. Railway가 쓰던 서비스 데이터는 Supabase에 남아 있으며 자동 복사하지 않는다. 실제 데이터 복제는 백업·복원 절차와 개인정보 처리 범위를 별도로 확정한 뒤 수행한다.

Supabase Storage를 연결하지 않은 로컬 환경에서 `docker compose --profile tools run --rm seed`로 만든 데모 상품은 Web 정적 자산 `/local-product-images/local-demo.jpg`를 공통 썸네일로 사용한다. 이는 Hub맥 UI 검증용 fallback이며, 운영 환경에서는 Supabase Storage의 실제 상품 이미지를 사용한다.
