# Hub맥 자동 배포 (GitHub Actions 셀프호스트 러너)

`main`에 push되면 Hub맥이 **즉시** 최신 코드로 재빌드한다. 이벤트 기반이라 주기적 확인(폴링)이 없다.

```
git push origin main
        │  (GitHub가 push 이벤트를 Hub맥 러너에 전달)
        ▼
Hub맥 러너: git reset --hard origin/main → docker compose up -d --build --wait
        │  (compose: migrate=Alembic head → api → web)
        ▼
Cloudflare 터널 주소로 새 버전 서비스
```

워크플로 정의: `.github/workflows/deploy-hubmac.yml`. **실제 배포·러너 실행은 Hub맥에서** 이뤄진다(이 리포 파일만으로는 동작하지 않음 — 아래 1회 설치 필요).

---

## 1회 설치 (Hub맥에서)

### ① 셀프호스트 러너 등록
GitHub → 리포 **Settings → Actions → Runners → New self-hosted runner → macOS(arm64)** 를 열면 다운로드·설정 명령이 **일회용 토큰과 함께** 표시된다. 그 명령으로 내려받은 뒤, `config.sh`에는 아래처럼 **라벨 `hub-mac`** 을 붙인다(워크플로가 이 라벨로 잡을 이 머신에 보낸다):

```bash
# (GitHub가 준 curl/tar 명령으로 actions-runner를 받은 폴더에서)
./config.sh \
  --url https://github.com/slur16105/SLUR_Market \
  --token <GITHUB가_준_토큰> \
  --labels hub-mac \
  --name hub-mac
```

### ② 서비스로 등록 (재부팅에도 자동 실행)
```bash
./svc.sh install
./svc.sh start      # 상태: ./svc.sh status
```
macOS에서는 launchd 서비스로 올라가 Hub맥이 켜져 있으면 러너가 항상 대기한다.

### ③ 배포 디렉토리 알려주기 (리포 변수)
GitHub → **Settings → Secrets and variables → Actions → Variables → New repository variable**
- 이름: `HUBMAC_DEPLOY_DIR`
- 값: Hub맥에서 **이 리포를 클론해 두고 `.env`가 있는 경로** (예: `/Users/슬러/SLUR_Market`)

> 워크플로는 러너의 임시 폴더가 아니라 이 경로에서 `git reset --hard` + `docker compose`를 실행한다. `.env`(gitignore)는 이 경로에만 있으므로 반드시 그 클론을 가리켜야 한다.

### ④ 러너가 docker를 찾을 수 있게 (중요)
launchd 서비스는 PATH가 최소라 `docker`가 안 잡힐 수 있다. Docker Desktop(또는 colima)이 **켜져 있어야** 하고, 필요하면 러너 폴더의 `.path` 파일에 docker 경로를 추가하거나 `.env`(러너용)로 PATH를 보강한다. 설치 후 첫 배포 로그에서 `docker: command not found`가 나오면 이 항목을 점검한다.

---

## 설치 후 사용

- **자동**: `main`에 push → 자동 배포. GitHub **Actions** 탭에서 로그·성공/실패 확인.
- **수동 실행**: Actions → *Deploy to Hub맥* → **Run workflow**. `seed` 체크 시 배포 후 데모 카탈로그/편성 seed(idempotent)까지 실행.
- **롤백**: 문제가 있으면 되돌릴 커밋을 `git revert` 후 push하면 자동 재배포된다. 급하면 Hub맥에서 직접 `git reset --hard <이전커밋> && docker compose up -d --build --wait`.

## 알아둘 점

- **검증 없이 라이브로 간다** — `main`에 올라간 코드가 그대로 배포된다(마이그레이션도 자동 실행). 리뷰·테스트를 통과한 뒤 push하는 흐름을 유지한다.
- **마이그레이션 자동** — compose의 `migrate` 서비스가 매 배포마다 Alembic을 head까지 올린다. 되돌릴 수 없는 스키마 변경은 push 전에 확인한다.
- **터널과 무관** — 이 자동 배포는 코드 갱신만 한다. 외부 노출(Cloudflare 터널)은 별개이며 Hub맥에서 cloudflared가 떠 있어야 공개 주소가 살아 있다.
- **러너 없을 때** — 러너 설치 전에는 push 시 잡이 대기(pending) 상태로 남는다. 설치하면 그때부터 잡힌다.

관련 문서: 로컬 실행·명령은 `LOCAL_DOCKER.md`.
