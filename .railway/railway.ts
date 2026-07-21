import { defineRailway, github, preserve, project, service } from "railway/iac";

export default defineRailway(() => {
  const repo = github("slur16105/SLUR_platform_blueprint");

  const api = service("api", {
    source: repo,
    rootDirectory: "apps/api",
    healthcheckPath: "/api/v1/health",
    preDeployCommand: ["uv run --no-sync alembic upgrade head"],
    replicas: 1,
    env: {
      ENVIRONMENT: "production",
      // 시크릿 — 값은 Railway에만 존재 (railway variables로 설정). IaC는 존재만 선언
      DATABASE_URL: preserve(),
      JWT_SECRET: preserve(),
      KAKAO_REST_API_KEY: preserve(),
      KAKAO_CLIENT_SECRET: preserve(),
      KAKAO_APP_ID: preserve(),
      // 웹 카카오 콜백 절대 URL의 allowlist (콤마 구분). 미설정 시 config.py 기본값
      // ["http://localhost:3000/auth/kakao/callback"]만 허용되어 프로덕션 카카오가 401로 떨어진다.
      // 값: https://<web 공개 도메인>/api/auth/kakao/callback (+ 로컬 http://localhost:3000/api/auth/kakao/callback)
      KAKAO_REDIRECT_URIS: preserve(),
      SUPABASE_URL: preserve(),
      SUPABASE_SERVICE_KEY: preserve(),
    },
  });

  const web = service("web", {
    source: repo,
    rootDirectory: "apps/web",
    healthcheckPath: "/",
    replicas: 1,
    env: {
      NODE_ENV: "production",
      API_BASE_URL: "https://api-production-8bfb.up.railway.app",
      // 카카오 인가 URL 생성용 — NEXT_PUBLIC_ 접두어를 쓰지 않는다(클라이언트 번들에 넣을 이유가 없다).
      // KAKAO_REST_API_KEY는 api와 같은 값. KAKAO_REDIRECT_URI는 콜백 절대 URL이며
      // 카카오 콘솔 등록값·백엔드 KAKAO_REDIRECT_URIS와 글자 단위로 같아야 한다.
      KAKAO_REST_API_KEY: preserve(),
      KAKAO_REDIRECT_URI: preserve(),
    },
  });

  return project("slur-platform", {
    resources: [api, web],
  });
});
