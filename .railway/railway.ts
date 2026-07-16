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
    },
  });

  return project("slur-platform", {
    resources: [api, web],
  });
});
