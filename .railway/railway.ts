import { defineRailway, github, project, service } from "railway/iac";

export default defineRailway(() => {
  const repo = github("slur16105/SLUR_platform_blueprint");

  const api = service("api", {
    source: repo,
    rootDirectory: "apps/api",
    healthcheckPath: "/api/v1/health",
    preDeployCommand: ["uv run alembic upgrade head"],
    replicas: 1,
    env: {
      ENVIRONMENT: "production",
    },
  });

  const web = service("web", {
    source: repo,
    rootDirectory: "apps/web",
    replicas: 1,
    env: {
      NODE_ENV: "production",
    },
  });

  return project("slur-platform", {
    resources: [api, web],
  });
});
