---
baseline_commit: a12606bfe395ba4ab1ac6c65555188cacf12ac21
---

# Story 8.8: Flutter 앱 보관과 제거

Status: done

## Story

As a 운영자,
I want Flutter 구매자 앱을 되살릴 수 있는 형태로 보관한 뒤 저장소에서 걷어내는 것,
So that 두 클라이언트를 유지하는 비용 없이 완주에 집중할 수 있다.

> **이 스토리는 코드를 쓰지 않는다.** 태그를 만들고, 원격에 있는지 눈으로 확인하고, 그 뒤에만 지운다.
> 그리고 **현행을 기술하는 문서**만 고친다. 이력을 기술하는 문서는 한 글자도 건드리지 않는다.
> 이 스토리의 위험은 전부 **순서**와 **분별**에 있다 — 순서를 어기면 코드가 영구히 사라지고,
> 분별을 놓치면 "왜 그렇게 됐는지"가 사라진다.

## Acceptance Criteria

1. **Given** Epic 8의 착수 게이트 **When** 8.8을 시작 **Then** Story 8.1~8.7이 **전부 `done`** 이고 코스 코렉션 §6 성공 기준 1~4(구매자 실기 1회 완주 · 시안 톤 일치 · 판매자·관리자 회귀 없음 · API 테스트 153건 통과)가 확인된 상태다
   - **And** 하나라도 `review`·`in-progress`이면 **이 스토리는 시작하지 않는다** — 리뷰 지적이 "Flutter판은 어떻게 했나"를 되묻는 순간 앱 소스가 로컬에 있는 편이 압도적으로 싸다
   - **And** 게이트 확인 결과(각 스토리의 Status)를 Completion Notes에 그대로 적는다

2. **Given** 제거 전 HEAD(=`apps/mobile` 47파일이 온전한 커밋) **When** 보관 태그를 만든다 **Then** `git tag -a flutter-app-final -m "구매자 Flutter 앱 최종 상태 (반응형 웹 전환 전 보존)"`가 생성된다
   - **And** **annotated 태그**다 — lightweight 태그는 작성자·날짜·메시지를 갖지 않아 "왜 남겼는지"가 태그 자체에 남지 않는다
   - **And** 태그가 가리키는 커밋이 `git show flutter-app-final:apps/mobile/pubspec.yaml`로 열리는지 확인한다 (태그 대상이 앱이 있는 커밋임의 직접 증거)
   - **And** 태그 이름은 `flutter-app-final` **그대로**다 (제안서 §4 규약. 기존 `archive/…` 접두 관례를 따르지 않는 이유는 D1)

3. **Given** 로컬 태그 **When** 원격에 푸시 **Then** `git push origin flutter-app-final`이 성공하고, **`git ls-remote --tags origin`의 출력에 `refs/tags/flutter-app-final`이 실제로 보인다**
   - **And** 그 출력에 실린 SHA가 로컬 `git rev-parse flutter-app-final^{}`와 **같다**
   - 🚨 **And** 이 확인이 끝나기 전에는 `apps/mobile`의 **어떤 파일도 지우지 않는다.** 로컬 태그만으로 삭제하지 않는다
   - **And** `ls-remote` 출력(SHA 포함)을 Completion Notes에 붙여 넣는다 — "확인했다"는 문장이 아니라 출력이 증거다

4. **Given** 원격 태그 확인 완료 **When** 복원 가능성을 실제로 시험 **Then** 저장소 밖 위치에 태그를 체크아웃해 `apps/mobile` 전체가 복원되고, **추적 파일 47개 · dart 22개(`lib` 21 + `integration_test` 1)** 가 대조된다
   - **And** 시험은 워킹트리를 오염시키지 않는 방법으로 한다 (`git worktree add <임시경로> flutter-app-final` 또는 임시 클론). 현재 브랜치에서 `git checkout <태그>`를 하지 않는다
   - **And** 시험이 끝나면 임시 worktree·클론을 제거한다

5. **Given** 복원 확인 완료 **When** 제거 **Then** `git rm -r apps/mobile`이 실행되고 `git status`에 `apps/mobile` 관련 잔여가 **0건**이다
   - **And** `ls -a apps/mobile`이 존재하지 않음을 확인한다 — `git rm`은 **추적 파일만** 지우므로 ignored 산출물(`.dart_tool/`·`android/build/`·`.DS_Store`)이 있는 머신에서는 빈 디렉터리가 남는다. 남으면 수동으로 지운다
   - **And** `git ls-files apps/mobile`이 **0줄**이다

6. **Given** **현행을 기술하는** 문서 **When** 정리 **Then** 아래가 사실에 맞게 고쳐진다 (D2의 "고칠 것" 표)
   - **And** `CLAUDE.md` 명령어 절의 `# 앱 (apps/mobile)` · `cd apps/mobile && flutter analyze && flutter run` **두 줄 제거**
   - **And** `CLAUDE.md` 아키텍처 절의 "Flutter·Next.js는 FastAPI API만 호출한다" · "구매자: Flutter 모바일 앱 (Android 먼저, iOS는 이후)" 두 문장이 **단일 Next.js 표면(AD-14)** 서술로 바뀐다
   - **And** `deferred-work.md` 상단 정리 규약의 "`apps/mobile`은 **아직 저장소에 있으며** … 제거될 예정이다" 문장이 **완료 사실**(제거일 · 태그명)로 바뀐다 — 그 아래 `[소멸 2026-07-21]` 항목 **본문·취소선은 손대지 않는다**
   - **And** 고친 문서에 근거 한 줄(전환으로 대상 자체가 사라졌음 + 태그 `flutter-app-final`)이 남는다

7. **Given** **이력을 기술하는** 문서 **When** 이 스토리가 끝난다 **Then** D2의 "남길 것" 목록에 있는 경로가 **`git diff --stat`에 한 건도 나타나지 않는다**
   - **And** 특히 `epics.md`의 `[2026-07-21 대체됨]` 주석 7건 · Epic 1~6 스토리의 `done` 상태 · 완료 스토리 파일 · `brief.md` 정오표 · 코스 코렉션 두 문서 · `deferred-work.md`의 `[소멸]` 항목이 그대로다
   - **And** `apps/web`의 구매자 코드 주석 중 "Flutter판 부채를 갚는다"류 3곳도 그대로다 — 앱이 사라져도 **그 코드가 왜 그렇게 짜였는지**는 여전히 유효한 설계 근거다

8. **Given** 제거 후 **When** 검증 **Then** `cd apps/web && npx tsc --noEmit` 0 · `npm run lint` 0 errors/0 warnings · `npx next build` 성공이 **제거 전과 동일**하다
   - **And** `git diff --stat`에 **`apps/api` 0건**이다 — API 테스트 153건은 이 스토리가 건드릴 수 없다 (이 머신에서 pytest 미실행 시 "미실행 + 사유"를 적고 통과했다고 쓰지 않는다)
   - **And** `.railway/railway.ts`에 `apps/mobile` 참조가 **0건**임을 재확인한다 (api·web 두 서비스의 `rootDirectory`가 `apps/api`·`apps/web`뿐)
   - **And** main push 후 Railway 배포가 정상 완료되고 `/`(web)·`/api/v1/health`(api)가 200이다

9. **Given** 제거로 드러난 잔재 **When** 판단 **Then** `POST /api/v1/auth/kakao/native` 경로(라우터·서비스·`kakao_app_id`·`KAKAO_APP_ID`·테스트 4건)가 **클라이언트 0인 백엔드 잔재**가 되었음이 `deferred-work.md`에 신규 항목으로 등록된다
   - **And** **이 스토리에서 지우지 않는다** — 백엔드 변경은 Epic 8 경계 밖이고, 테스트 4건이 사라지면 Epic 8 전체가 무변경 증거로 써온 "153건"이 깨진다 (D3)

10. **Given** 앱 관련 백엔드 설정 **When** 확인 **Then** `apps/api/app/core/config.py`의 `cors_origins`에 **앱 전용 항목이 없음**이 확인되고 **CORS는 변경하지 않는다** (D3 — 근거는 확인 결과이지 생략이 아니다)

## 설계 판단 (이 스토리에서 확정 — 근거를 남긴다)

### D1 — 순서가 곧 안전장치다: 태그 → 푸시 → **원격 확인** → 그 뒤에만 제거

**결정.** 세 단계를 각각 별도 Task로 쪼개고, 3번(원격 확인)의 **출력을 스토리에 붙이는 것**을 4번의 착수 조건으로 삼는다.

```bash
git tag -a flutter-app-final -m "구매자 Flutter 앱 최종 상태 (반응형 웹 전환 전 보존)"
git push origin flutter-app-final
git ls-remote --tags origin | grep flutter-app-final     # ← 이 출력이 나오기 전에는 아무것도 지우지 않는다
git rm -r apps/mobile
```

**근거 — 이 저장소에서 이미 일어난 일이다.**

```
$ git tag -l
archive/open-gate-review-2026-07-21

$ git ls-remote --tags origin
(출력 없음 — exit 0)
```

로컬에 태그가 하나 있는데 **원격에는 태그가 0개다.** `git push`는 태그를 자동으로 보내지 않으므로 이것이 정상 동작이지만, 동시에 **"태그를 만들었다"와 "태그가 원격에 있다"가 이 저장소에서 실제로 어긋나 있다**는 증거이기도 하다. 로컬 태그만 믿고 `git rm -r apps/mobile`을 커밋·푸시하면, 그 머신의 `.git`이 사라지는 순간 2,811줄의 dart 코드가 **어디에도 없다.** 이 스토리에서 유일하게 되돌릴 수 없는 사고가 이것이다.

**annotated 태그를 쓰는 이유.** lightweight 태그는 커밋을 가리키는 이름표일 뿐 작성자·날짜·메시지를 갖지 않는다. 1년 뒤 `flutter-app-final`을 만난 사람이 `git show`로 "구매자 Flutter 앱 최종 상태 (반응형 웹 전환 전 보존)"를 읽을 수 있어야 보관이 완성된다.

**`archive/` 접두를 붙이지 않는 이유.** 이 저장소의 기존 관례는 `archive/open-gate-review-2026-07-21`이지만, 제안서 §4와 에픽 8.8 AC가 **`flutter-app-final`을 문자 그대로** 적어 두었고 `deferred-work.md`·`epics.md`·8.1~8.7 스토리가 전부 그 이름을 인용한다. 이름을 바꾸면 이미 쓰인 문서 10여 곳이 거짓이 된다. **문서에 이미 박힌 이름이 이긴다.**

**태그를 다는 커밋.** 제거 **전** HEAD다. 제거 커밋의 부모가 되며, `apps/mobile` 47파일이 온전하다. 태그를 만든 뒤 제거 전에 다른 커밋이 끼어들면 태그가 그만큼 뒤처지지만 `apps/mobile` 내용은 같으므로 무해하다 — 다만 혼란을 줄이기 위해 **태그 생성부터 제거 커밋까지를 한 세션에서** 끝낸다.

**태그 불변 규약.** 이 태그는 **삭제하지도, 다른 커밋으로 옮기지도(`-f`) 않는다.** 태그가 곧 백업이고, 백업을 force push할 수 있게 두면 백업이 아니다.

### D2 — 문서 정리의 기준: **"지금의 사실"로 읽히면 고치고, "당시의 사실"로 읽히면 남긴다**

**결정.** 판별 질문은 하나다 — **이 문서를 처음 읽는 사람이 그 문장을 현재 상태로 받아들이는가?**
- 받아들인다 → **거짓말이 되므로 고친다**
- 날짜·상태·대체 주석이 붙어 "그때는 그랬다"로 읽힌다 → **남긴다.** 지우면 왜 그렇게 됐는지가 사라진다

이 스토리의 실질적 판단은 전부 이 표에 있다.

#### 고칠 것 (현행을 기술하는 문서)

| 경로 | 무엇이 거짓이 되는가 | 어떻게 |
|---|---|---|
| `CLAUDE.md:19-20` | 명령어 절의 `# 앱 (apps/mobile)` / `cd apps/mobile && flutter analyze && flutter run` — **존재하지 않는 디렉터리에서 없는 CLI를 돌리라는 지시** | 두 줄 제거 |
| `CLAUDE.md:37` | "Flutter·Next.js는 FastAPI API만 호출한다" | "Next.js는 FastAPI API만 호출한다" |
| `CLAUDE.md:39` | "구매자: Flutter 모바일 앱 (Android 먼저, iOS는 이후). 판매자·관리자: Next.js PC 웹 단일 앱에서 Role 분기." | AD-14 서술로 — 세 역할이 하나의 Next.js 앱에서 Role로 갈리고, 구매자 라우트는 모바일 퍼스트 반응형+PWA, 판매자·관리자 라우트는 PC 폭 |
| `CLAUDE.md:9` | "구현 상태 (2026-07-20): v1 전 스토리(Epic 1~6) 완주" — Epic 8이 그 뒤에 통째로 들어왔다 | Epic 8 완료 사실 한 줄 추가. **`[ASSUMPTION]`** 에픽 AC가 지시한 항목은 아니지만 같은 절이 같은 이유로 낡았다 — 명령어만 고치고 세 줄 위를 두면 반쪽이다 |
| `deferred-work.md:6` (정리 규약) | "`apps/mobile`은 **아직 저장소에 있으며**, Story 8.8에서 보존 태그 생성 후 제거될 예정이다" | 완료 사실로 — 제거일·태그명·커밋. **`[소멸]` 항목 본문은 불변** |
| `research-stack-versions.md` §4 · 권장 핀 요약 | "Flutter 3.44 + Dart 3.12 + Riverpod 3"이 **현행 스택 핀**으로 읽힌다 | **지우지 않고 한 줄 주석**으로 정정 — 2026-07-15 리서치 시점 기록이며 구매자 Flutter는 2026-07-21 전환으로 폐기. 리서치 결과를 지우면 "그때 무엇을 조사했나"가 사라진다 (경계 사례 — D2 판정을 그대로 적용한 결과) |
| `sprint-status.yaml` | `8-8-flutter-archive-remove: backlog` | 워크플로우 관례대로 진행 상태 갱신 |

#### 남길 것 (이력을 기술하는 문서 — `git diff`에 나타나면 잘못된 것)

| 경로 | 왜 남기는가 |
|---|---|
| `epics.md`의 `[2026-07-21 대체됨]` 주석 7건 (Story 1.5·3.5·4.1·4.2·4.4·5.1·6.1) | 에픽 8.8 Dev Notes가 명시적으로 지시한다. 주석 자체가 "무엇이 무엇으로 대체됐는지"의 지도다 |
| `epics.md`의 Epic 1~6 Flutter 서술 원문(377·387·540·620·803행) | 대체 주석이 이미 감싸고 있다. 원문을 지우면 주석이 무엇을 정정하는지 알 수 없어진다 |
| `epics.md:306` Story 1.1 AC의 "모노리포(apps/api·apps/web·apps/mobile)" | **완료된 스토리의 AC 원문.** 당시 그 셋을 만든 것이 사실이다 |
| `1-5-flutter-login.md` 등 완료 스토리 파일 전부 | 구현 기록. Epic 1~6의 `done`은 되돌리지 않는다(제안서 §5.3) |
| `brief.md:12` 정오표 + 본문 Flutter 서술(14·26·38·56·60행) | 정오표가 이미 "**당시 기록으로 보존**하며 현행 아님"을 선언했다. 본문을 고치면 정오표가 무의미해진다 |
| `prd.md:16` 코스 코렉션 주석 · `:43` `내 정보` 유래 | 전환의 근거이며 날짜가 붙어 있다 |
| `sprint-change-proposal-2026-07-21.md` · `course-correction-buyer-web-2026-07-21.md` | **결정 문서.** 이 스토리 자체의 근거다 |
| `ARCHITECTURE-SPINE.md:146` AD-14의 `**History:**` 줄 | 이미 `History:` 접두로 이력임이 표시돼 있다. Stack 표·배포 토폴로지 다이어그램에는 Flutter가 **이미 없다**(확인 완료) — 스파인은 손댈 곳이 없다 |
| `EXPERIENCE.md:19,58` | 전환 근거와 `내 정보` 화면의 유래 |
| `deferred-work.md`의 `[소멸 2026-07-21]` 항목 3건(취소선 본문 포함) | 규약이 "고쳐서 없어진 것이 아니라 대상이 사라져 추적을 멈추는 것"이라고 구분해 두었다. 지우면 그 구분이 사라진다 |
| Epic 8 스토리 파일(8.1~8.7)의 Flutter 언급 | "Flutter판 부채를 여기서 갚는다"류 설계 근거 |
| `apps/web/app/(buyer)/cart/cart-view.tsx:30,137` · `orders/[id]/order-detail-view.tsx:78` | **코드 주석이지만 남긴다.** "Flutter판 `guard()`의 finally-invalidate 부채를 여기서 갚는다"는 *이 코드가 왜 이렇게 짜였는지*를 설명한다. 참조 대상이 저장소에서 사라져도 그 설계 근거는 유효하고, 태그가 실물을 보존한다 |
| `epic-7-pg-draft-2026-07-20.md` | "7.4 Flutter 결제 플로우는 무효" — 앞으로의 지시이자 이력 |
| `.orca/SESSION_HANDOFF.md` | 세션 인계용 임시 파일. **`[ASSUMPTION]`** 다음 세션 종료 시 자연히 덮어써진다. 이 스토리의 종료 기록을 쓸 때 함께 갱신되면 충분하고, 과거 완료 노트(`apps/mobile 변경 0건`)는 이력이다 |

#### 이미 되어 있어서 할 일이 없는 것 (확인만)

에픽 8.8 AC가 요구한 `deferred-work.md` 정리 3건은 **2026-07-21에 이미 반영돼 있다** — cart_screen 항목 `[소멸 2026-07-21]`, 사업자 실정보 항목의 `lib/src/config/company.dart` 취소선 처리, `WEB_BASE_URL` 주입 `[소멸 2026-07-21]`. 8.8이 할 일은 **다시 고치는 것이 아니라 반영 여부를 확인하고 상단 규약 문장의 시제만 바꾸는 것**이다. 이를 모르고 손대면 이미 정리된 문서를 두 번 정리하게 된다.

### D3 — 백엔드는 손대지 않는다: CORS는 정리할 것이 없고, 진짜 잔재는 따로 있다

**CORS — 확인 결과 변경 없음.**

```python
# apps/api/app/core/config.py:15
cors_origins: list[str] = ["http://localhost:3000", "https://web-production-abfe1.up.railway.app"]
```

두 항목 모두 **웹 오리진**이고 앱 전용 항목은 없다. 애초에 그럴 수밖에 없다 — **네이티브 앱은 `Origin` 헤더를 보내지 않아 CORS 정책의 대상이 아니었다.** Flutter는 `--dart-define=API_BASE_URL`로 FastAPI를 직접 호출했고 브라우저 동일 출처 정책 밖에 있었다. 앱이 사라져도 CORS 목록에서 뺄 것이 없다. **이것은 생략이 아니라 확인 결과다.**

**진짜 잔재는 카카오 네이티브 로그인 경로다.**

| 자리 | 무엇 |
|---|---|
| `apps/api/app/auth/router.py:43` | `POST /api/v1/auth/kakao/native` |
| `apps/api/app/auth/service.py:148` | `kakao_native_login()` |
| `apps/api/app/auth/kakao.py:109~130` | 카카오 access token의 `app_id` 검증 |
| `apps/api/app/core/config.py:30` | `kakao_app_id` |
| `.railway/railway.ts:19` · `tests/conftest.py:10` | `KAKAO_APP_ID` |
| `apps/api/tests/test_kakao.py:170~209` | 테스트 **4건** |

이 경로는 **Flutter의 카카오 네이티브 SDK 전용**이었다. 웹은 8.2가 인가코드 방식(`POST /auth/kakao`)만 쓴다 — `apps/web` 전체에 `native` 참조 **0건**. 앱을 지우는 순간 이 엔드포인트의 클라이언트는 0이 된다.

**그래도 이 스토리에서 지우지 않는다.** 세 가지 이유다.
1. **Epic 8의 경계가 "백엔드 무변경"이다.** 8.1~8.7이 전부 `apps/api` diff 0건을 증거로 써왔고, 마지막 스토리가 그 규칙을 깨면 에픽 전체의 증거 체계가 흔들린다.
2. **테스트 4건이 딸려 있다.** 지우면 153건이 149건이 된다. `153`은 코스 코렉션 §6 성공 기준 4이자 Epic 8 전 스토리의 검증 기준이다. 이 숫자를 8.8이 바꾸면 안 된다.
3. **미사용 엔드포인트는 위험이 아니라 표면이다.** `kakao_app_id`가 비어 있으면 502로 떨어지도록 이미 설계돼 있어(`kakao.py:114`) 오동작하지 않는다. 서두를 이유가 없다.

→ `deferred-work.md`에 **신규 항목으로 등록**하고, 착수 조건을 "Epic 8 회고 또는 Epic 7(PG) 착수 시 백엔드 정리와 함께"로 적는다 (AC 9). 같은 서랍에 이미 들어 있는 `middleware.ts` → `proxy.ts` rename과 성격이 같다.

### D4 — 되돌리는 방법: 이것이 "보관"의 실질이다

**태그가 있다는 것만으로는 보관이 아니다. 되살리는 절차가 문서에 있어야 보관이다.**

**A. 전체를 별도 위치에 꺼내 읽기 (워킹트리를 건드리지 않는다 — 권장)**

```bash
git worktree add /tmp/flutter-restore flutter-app-final
ls /tmp/flutter-restore/apps/mobile          # 앱 전체가 여기 있다
# 다 봤으면
git worktree remove /tmp/flutter-restore
```

**B. 현재 브랜치로 되살리기 (진짜 롤백)**

```bash
git checkout flutter-app-final -- apps/mobile    # 47파일이 인덱스+워킹트리로 복귀
git commit -m "revert: apps/mobile 복원 (flutter-app-final)"
```

**C. 저장소가 없는 머신에서**

```bash
git clone --branch flutter-app-final --single-branch https://github.com/slur16105/SLUR_platform_blueprint.git
```

**D. 파일 하나만**

```bash
git show flutter-app-final:apps/mobile/lib/src/carts/cart_screen.dart
```

**복원 후 필요한 것.** 앱을 다시 *빌드*하려면 Flutter SDK(3.44 / Dart 3.12, `pubspec.yaml`의 `sdk: ^3.12.2`)와 `flutter pub get`이 필요하다. **이 머신에는 `flutter`·`dart` CLI가 없다**(확인: `which flutter dart` → 없음). 따라서 제거 전 마지막 `flutter analyze` 결과를 새로 만들 수 없고, **마지막으로 기록된 값은 `deferred-work.md`의 2026-07-20 항목 "`flutter analyze` 0"이다.** 이 사실을 Completion Notes에 그대로 적는다 — 이 스토리가 앱을 "정상 상태로" 검증하고 지웠다고 주장하지 않는다.

**이 보관의 한계 (알고 남긴다).** 보존은 **GitHub 원격 저장소 하나**에 걸려 있다. 저장소가 삭제되거나 계정이 사라지면 태그도 함께 사라진다. 47파일 288KB이므로 오프라인 사본을 따로 두는 비용은 거의 0이다 — **`[ASSUMPTION]` 별도 아카이브(zip)를 만들지는 Slur 판단**이며 이 스토리는 제안만 한다. 만든다면 `git archive flutter-app-final apps/mobile -o flutter-app-final.zip`이고, **저장소 안에 두지 않는다**(지운 것을 다시 넣는 셈이다).

### D5 — 제거 시점: 8.1~8.7이 전부 `done`이 된 뒤에만

**현재 상태 (baseline commit 기준) — 착수 조건 미충족이다.**

| 스토리 | Status |
|---|---|
| 8.1 buyer-web-shell | `in-progress` |
| 8.2 buyer-auth-web | `in-progress` |
| 8.3 buyer-product-browse-web | `review` |
| 8.4 cart-web | `review` |
| 8.5 checkout-web | `in-progress` |
| 8.6 order-history-cancel-web | `review` |
| 8.7 me-and-pwa | `ready-for-dev` |

**`review`로는 부족하다고 판단한다.** 제거는 태그가 있으니 기술적으로 되돌릴 수 있다. 그러나 되돌림에는 마찰이 있고, 마찰이 있으면 사람은 그냥 넘어간다. 리뷰 지적이 "이 문구는 Flutter판에서 뭐였나", "이 상태 매핑은 5.1에서 어떻게 했나"를 되묻는 일은 8.6에서 **이미 일어났다**(`취소완료` vs `취소` 문언 판정). 앱 소스가 `apps/mobile/`에 있는 것과 worktree를 새로 파는 것은 비용이 다르다.

**그러므로 게이트는 두 겹이다** (AC 1):
1. 8.1~8.7 **전부 `done`** (`sprint-status.yaml`과 각 스토리 파일 Status 양쪽)
2. 코스 코렉션 §6 성공 기준 1~4 확인 — 특히 **1(구매자 실기 1회 완주)**. 실기가 되지 않았다면 "기능 동등"이 주장일 뿐이고, 8.8의 전제("구매자 웹이 기능 동등한 상태")가 성립하지 않는다

게이트가 안 열리면 이 스토리는 **대기한다.** 게이트를 낮추는 판단은 Slur의 몫이며 AI가 단독으로 내리지 않는다.

### D6 — 커밋 단위: 제거와 문서 정리를 **한 커밋**으로

**결정.** `git rm -r apps/mobile` + 문서 수정을 한 커밋에 담고, 커밋 메시지 본문에 태그명과 복원 명령을 적는다.

**근거.**
- 제거만 담긴 커밋을 되돌리면 **문서가 존재하지 않는 디렉터리를 가리키는 상태**로 돌아간다. 문서만 담긴 커밋은 그 자체로 거짓이다(앱은 아직 있는데 없다고 쓴 문서). **두 변경은 같은 사실의 두 면이라 분리하면 양쪽 다 일관성이 깨진 중간 상태를 만든다.**
- `git log`에서 "언제 지웠나"를 찾은 사람이 같은 커밋 메시지에서 "어떻게 되살리나"를 바로 읽을 수 있다. 보관의 실질은 절차의 발견 가능성이다.
- 커밋 메시지 예:

  ```
  Flutter 구매자 앱 제거 — 보관 태그 flutter-app-final

  구매자 표면이 반응형 웹으로 전환 완료(Epic 8)되어 apps/mobile 47파일을 제거한다.
  전체 소스는 태그 flutter-app-final(원격 푸시 확인 완료)에 보존된다.

  복원: git checkout flutter-app-final -- apps/mobile
  읽기: git worktree add /tmp/f flutter-app-final

  근거: sprint-change-proposal-2026-07-21.md §4·§6, Story 8.8
  ```

**태그 푸시는 이 커밋보다 반드시 먼저다** — D1의 순서가 커밋 단위 판단보다 우선한다.

## Tasks / Subtasks

- [ ] **Task 0 — 착수 게이트 확인** (AC: 1)
  - [ ] `sprint-status.yaml`의 `8-1`~`8-7`이 전부 `done`인지 확인. 각 스토리 파일의 `Status:` 줄도 함께 본다(둘이 어긋나면 어긋남 자체를 보고하고 멈춘다)
  - [ ] 코스 코렉션 §6 성공 기준 1~4 확인 — 특히 **구매자 실기 1회 완주**(주문 생성까지)가 어디에 기록돼 있는지 근거를 찾는다
  - [ ] 🚨 하나라도 미충족이면 **여기서 멈추고 보고한다.** 이후 Task를 진행하지 않는다
  - [ ] 확인 결과(스토리별 Status 목록)를 Completion Notes에 표로 적는다

- [ ] **Task 1 — 제거 전 마지막 상태 기록** (AC: 2, 4)
  - [ ] `git ls-files apps/mobile | wc -l` → **47** 기대. 다르면 그 값을 기록한다
  - [ ] `find apps/mobile -name "*.dart" | wc -l` → **22** (`lib` 21 + `integration_test` 1). 에픽 AC의 "21개 dart 파일"은 `lib` 기준이며 integration test가 22번째다 — 복원 대조 시 숫자를 착각하지 않는다
  - [ ] `du -sh apps/mobile` → 약 **288K**
  - [ ] `which flutter dart` → **이 머신에는 없다.** `flutter analyze`를 새로 돌릴 수 없음을 기록하고, 마지막으로 기록된 값(`deferred-work.md` 2026-07-20 "`flutter analyze` 0")을 인용한다. **통과했다고 새로 주장하지 않는다**
  - [ ] 작업 트리가 clean인지 확인 (`git status`) — 다른 작업의 미커밋 변경 위에서 제거를 시작하지 않는다

- [ ] **Task 2 — 보관 태그 생성** (AC: 2)
  - [ ] `git tag -a flutter-app-final -m "구매자 Flutter 앱 최종 상태 (반응형 웹 전환 전 보존)"`
  - [ ] `git show --stat flutter-app-final | head -20`으로 대상 커밋 확인
  - [ ] `git show flutter-app-final:apps/mobile/pubspec.yaml | head -5` — 태그 대상 커밋에 앱이 실제로 있음의 직접 증거
  - [ ] **lightweight 태그(`git tag <name>`)를 쓰지 않는다** — `-a`와 `-m`이 반드시 붙는다

- [ ] **Task 3 — 원격 푸시와 확인 (이 스토리의 가장 중요한 Task)** (AC: 3)
  - [ ] `git push origin flutter-app-final`
  - [ ] `git ls-remote --tags origin` — 출력에 `refs/tags/flutter-app-final`이 **보여야 한다**
  - [ ] `git rev-parse flutter-app-final^{}`와 `ls-remote` 출력의 SHA를 **눈으로 대조**한다 (annotated 태그는 `ls-remote`에 태그 객체 SHA와 `^{}` 역참조 두 줄로 나온다 — 커밋 SHA는 `^{}` 쪽이다)
  - [ ] 🚨 **출력을 Completion Notes에 그대로 붙인다.** "확인했다"는 문장은 증거가 아니다
  - [ ] 🚨 **푸시가 실패하거나 출력이 비어 있으면 여기서 멈춘다.** Task 4 이후로 넘어가지 않는다. 네트워크·권한 문제라면 해결한 뒤 다시 확인한다
  - [ ] 참고: 이 저장소 원격에는 현재 태그가 **0개**이고 로컬에는 `archive/open-gate-review-2026-07-21`이 있다. 로컬 태그가 자동으로 푸시되지 않는다는 사실이 이 저장소에 이미 존재한다

- [ ] **Task 4 — 복원 가능성 실증 (제거 전)** (AC: 4)
  - [ ] `git worktree add <스크래치패드 경로>/flutter-restore flutter-app-final`
  - [ ] `find <경로>/apps/mobile -type f | wc -l` → **47**, `find … -name "*.dart" | wc -l` → **22** 대조
  - [ ] 구매자 화면 파일이 실제로 열리는지 한두 개 확인 (`lib/src/screens/home_screen.dart` 등)
  - [ ] `git worktree remove <경로>/flutter-restore` — 임시 worktree를 남기지 않는다
  - [ ] **현재 브랜치에서 `git checkout flutter-app-final`을 하지 않는다** (detached HEAD로 들어가면 이후 Task가 엉킨다)

- [ ] **Task 5 — 제거** (AC: 5)
  - [ ] `git rm -r apps/mobile`
  - [ ] `git status` — `deleted:` 47건 외에 예상 밖 항목이 없는지 확인
  - [ ] `git ls-files apps/mobile | wc -l` → **0**
  - [ ] `ls -a apps/mobile` → **없음.** 남아 있으면 ignored 산출물(`.dart_tool/`·`android/build/`·`.DS_Store`)이 있는 것이므로 확인 후 수동 제거한다 (`git rm`은 추적 파일만 지운다)
  - [ ] 🚨 **Task 3의 확인 출력이 Completion Notes에 적혀 있지 않으면 이 Task를 시작하지 않는다**

- [ ] **Task 6 — 문서 정리: 고칠 것** (AC: 6)
  - [ ] `CLAUDE.md` 명령어 절 — `# 앱 (apps/mobile)` / `cd apps/mobile && flutter analyze && flutter run` 두 줄 제거
  - [ ] `CLAUDE.md` 아키텍처 절 — "Flutter·Next.js는" → "Next.js는" / 구매자 표면 줄을 AD-14 서술(하나의 Next.js 앱, 구매자 라우트는 모바일 퍼스트 반응형+PWA)로 교체
  - [ ] `CLAUDE.md` 프로젝트 절 구현 상태 줄에 Epic 8 완료를 반영 (`[ASSUMPTION]` — 에픽 AC 밖이지만 같은 이유로 낡은 문장이다. 범위를 넘는다고 판단되면 고치지 말고 사유를 Completion Notes에 적는다)
  - [ ] `deferred-work.md` 상단 정리 규약 — "아직 저장소에 있으며 … 제거될 예정" → 제거 완료 사실(날짜·태그명). **아래 `[소멸]` 항목 본문·취소선은 손대지 않는다**
  - [ ] `research-stack-versions.md` — §4와 권장 핀 요약에 **한 줄 주석으로 정정**(2026-07-15 리서치 시점 기록, 구매자 Flutter는 2026-07-21 전환으로 폐기). **문장을 지우지 않는다**
  - [ ] 고친 곳마다 근거 한 줄(전환으로 대상 자체가 사라졌음 + 태그 `flutter-app-final`)이 남았는지 확인
  - [ ] 각 문서에 `apps/mobile`·`flutter` 잔여가 있는지 `grep -n -i "apps/mobile\|flutter" CLAUDE.md` 등으로 재확인

- [ ] **Task 7 — 문서 정리: 남길 것 검증** (AC: 7)
  - [ ] `git diff --stat`을 열어 **D2 "남길 것" 표의 경로가 한 건도 없는지** 확인한다. 있으면 되돌린다
  - [ ] 특히 확인: `epics.md`(대체 주석) · `1-5-flutter-login.md` 등 완료 스토리 · `brief.md` · `prd.md` · 코스 코렉션 두 문서 · `ARCHITECTURE-SPINE.md` · `EXPERIENCE.md` · `apps/web/app/(buyer)/**`
  - [ ] `deferred-work.md`의 diff가 **상단 규약 문장 + Task 8의 신규 항목**뿐인지 확인 (`[소멸]` 항목 본문이 diff에 나타나면 잘못된 것)

- [ ] **Task 8 — 드러난 잔재를 부채로 등록** (AC: 9)
  - [ ] `deferred-work.md`의 Epic 8 절에 신규 항목 추가 — `POST /api/v1/auth/kakao/native` 계열(라우터·서비스·`kakao.py` app_id 검증·`kakao_app_id`·`KAKAO_APP_ID`·테스트 4건)이 **클라이언트 0**이 되었음
  - [ ] 지우지 않는 이유를 함께 적는다: Epic 8 백엔드 무변경 경계 · 테스트 4건이 사라지면 `153`이 깨짐 · 미설정 시 502로 안전 (D3)
  - [ ] 착수 조건: Epic 8 회고 또는 Epic 7(PG) 백엔드 정리와 함께
  - [ ] **`apps/api`를 열어 코드를 고치지 않는다** — 문서에 등록만 한다

- [ ] **Task 9 — 검증: 빌드·정적** (AC: 8)
  - [ ] `cd apps/web && npx tsc --noEmit` → 0
  - [ ] `cd apps/web && npm run lint` → 0 errors · 0 warnings (A-E456-5 베이스라인)
  - [ ] `cd apps/web && npx next build` → 성공, 라우트 수가 제거 전과 동일
  - [ ] `git diff --stat`에 **`apps/api` 0건** 확인
  - [ ] `cd apps/api && uv run pytest -q` → 153 passed — **환경이 갖춰진 경우에만.** 이 머신에는 `uv`·`docker`가 없다(확인 완료). 실행하지 못했으면 **"미실행 + 사유"** 를 적는다. 통과했다고 쓰지 않는다
  - [ ] `.railway/railway.ts`에 `apps/mobile` 참조 0건 재확인 — `rootDirectory`가 `apps/api`·`apps/web` 둘뿐이고 `resources: [api, web]`이다
  - [ ] `docker-compose.yml`·루트 `package.json`·`scripts/`에도 mobile 참조 0건 재확인 (`grep -rn -i "mobile\|flutter"`)
  - [ ] `.github/` 워크플로가 **없음**을 확인 (CI가 mobile을 참조할 자리 자체가 없다)

- [ ] **Task 10 — 검증: 배포** (AC: 8)
  - [ ] main push 후 Railway api·web 두 서비스 배포가 정상 완료되는지 확인
  - [ ] `GET /`(web) 200 · `GET /api/v1/health`(api) 200
  - [ ] 배포 로그에 `apps/mobile` 관련 경고·오류가 없는지 확인
  - [ ] 구매자 웹의 주요 라우트(`/`·`/cart`·`/orders`·`/me`)가 제거 전과 동일하게 응답하는지 확인

- [ ] **Task 11 — 검증: 제거 후 복원 (진짜 증명)** (AC: 4)
  - [ ] 제거 커밋을 push한 **뒤에**, 저장소를 새로 클론하거나 worktree로 `flutter-app-final`을 꺼내 `apps/mobile` 47파일이 복원되는지 다시 확인한다
  - [ ] **Task 4와 다르다.** Task 4는 "태그가 온전한가", 여기는 "**main에서 지운 뒤에도** 태그에서 되살아나는가"다. 코스 코렉션 §6 성공 기준 5가 요구하는 것은 후자다
  - [ ] 확인 후 임시 worktree·클론을 제거한다
  - [ ] 결과를 Completion Notes에 기록한다 (파일 수 · 사용한 명령)

- [ ] **Task 12 — 상태 갱신과 마무리**
  - [ ] `sprint-status.yaml`의 `8-8-flutter-archive-remove` 갱신
  - [ ] 이 스토리 Status 갱신
  - [ ] `.orca/SESSION_HANDOFF.md`에 세션 종료 기록 (Orca 세션 규칙)
  - [ ] D6대로 **제거 + 문서 정리를 한 커밋**으로. 커밋 메시지에 태그명과 복원 명령을 넣는다

## Dev Notes

### 이 스토리의 경계 — 하지 않는 일

| 하지 않는다 | 왜 / 어디가 하는가 |
|---|---|
| 코드 작성 | 이 스토리는 제거·정리다. `apps/web`에 **한 줄도 쓰지 않는다** |
| `apps/api` 수정 (CORS·`kakao/native`·`kakao_app_id`) | Epic 8 백엔드 무변경 경계. 테스트 153건이 걸려 있다 (D3). `deferred-work.md`에 등록만 |
| `epics.md`의 대체 주석·`done` 상태 되돌리기 | 에픽 8.8 Dev Notes가 명시적으로 금지. 이력이다 |
| 완료 스토리 파일·브리프·PRD 본문 수정 | 이력 문서. 정오표·대체 주석이 이미 감싸고 있다 (D2) |
| `flutter analyze` 새로 실행 | 이 머신에 `flutter`·`dart` CLI가 없다. 마지막 기록값을 인용만 한다 |
| 태그 삭제·이동(`-f`) | 태그가 곧 백업이다 (D1) |
| 오프라인 zip 아카이브 생성 | `[ASSUMPTION]` Slur 판단. 제안만 한다 (D4) |
| Capacitor 래퍼 검토 | v1 범위 밖 (제안서 §4) |

### 고칠 파일 — ① 지금 무엇을 말하는가 ② 무엇을 바꾸는가 ③ 깨뜨리면 안 되는 것

**`CLAUDE.md`**
1. 명령어 절에 `# 앱 (apps/mobile)` / `cd apps/mobile && flutter analyze && flutter run` 2줄. 아키텍처 절이 "Flutter·Next.js는 FastAPI API만 호출한다"(37행)와 "구매자: Flutter 모바일 앱 (Android 먼저, iOS는 이후)"(39행)를 **현행 사실로** 서술한다. 프로젝트 절(9행)은 "Epic 1~6 완주"에서 멈춰 있다.
2. 명령어 2줄 제거 + 두 아키텍처 문장을 AD-14 서술로 + 구현 상태 줄에 Epic 8 반영.
3. **Supabase 배제 결정**(38행) · **ERD 단독 확정 금지**(46행) · **PG 선행 조건**(41행) · Orca 세션 규칙 절. 이 스토리와 무관하며 문장 하나도 건드리지 않는다. `CLAUDE.md`는 모든 세션의 첫 컨텍스트라 **의도치 않은 삭제가 조용히 오래 간다.**
   - ⚠️ 명령어 절의 `uv run pytest -q # 전체 테스트 (149)` 주석은 **실제 153건과 이미 어긋나 있다.** 이 스토리의 범위는 아니지만 같은 절을 여는 김에 고칠지 판단하고, 고치면 Completion Notes에 적는다

**`_bmad-output/implementation-artifacts/deferred-work.md`**
1. 상단 정리 규약이 "`apps/mobile`은 **아직 저장소에 있으며**, Story 8.8에서 보존 태그(`flutter-app-final`) 생성 후 제거될 예정이다"라고 **미래형**으로 쓰고, 아래에 `[소멸 2026-07-21]` 항목 3건이 취소선으로 정리돼 있다.
2. 규약 문장만 완료 사실로. **신규 부채 1건 추가**(kakao/native 잔재).
3. 🚨 **`[소멸]` 항목 3건의 본문·취소선·후속 지시.** 특히 cart_screen 항목의 "**후속**: 웹 장바구니(Epic 8.4)에서 …"와 AD-13 `999` 리터럴 항목의 "같은 상한이 웹에 다시 놓이므로 확산 자체는 해소되지 않는다"는 **여전히 유효한 지시**다. 취소선이 그어져 있다고 삭제 대상이 아니다.

**`_bmad-output/planning-artifacts/architecture/.../research-stack-versions.md`**
1. §4 `Flutter / Dart`가 Flutter 3.44 · Dart 3.12 · Riverpod 3 권장을 적고, 마지막 "권장 핀 요약"이 그것을 스택 핀 목록에 포함한다.
2. **문장을 지우지 않고 한 줄 주석으로 정정.** 2026-07-15 리서치 시점 기록이며 구매자 Flutter는 폐기됐음을 밝힌다.
3. 리서치 내용 자체. 이것은 "그때 무엇을 조사해서 무엇을 골랐나"의 기록이고, `ARCHITECTURE-SPINE.md`의 Stack 표가 정본이다 — **스파인 Stack 표에는 Flutter가 이미 없다**(확인 완료). 정본이 이미 맞으므로 리서치 문서는 주석으로 충분하다.

**`.railway/railway.ts` (읽기만)**
1. `api`(rootDirectory `apps/api`) · `web`(rootDirectory `apps/web`) 두 서비스, `project(… resources: [api, web])`. `apps/mobile` 참조 **0건**.
2. **수정하지 않는다.**
3. `KAKAO_APP_ID: preserve()`는 D3의 잔재 목록에 속하지만 **지금 지우지 않는다** — 백엔드 `kakao_app_id`가 살아 있는 동안 IaC 선언만 빼면 다음 `config apply`에서 프로덕션 변수가 사라진다(회고 R1의 사고 유형). 백엔드 코드와 **함께** 정리해야 하며 그것이 D3의 부채 항목이다.

**`apps/api/app/core/config.py` (읽기만)**
1. `cors_origins = ["http://localhost:3000", "https://web-production-abfe1.up.railway.app"]` — 웹 오리진 둘뿐.
2. **수정하지 않는다** (D3 — 정리할 앱 항목이 애초에 없다).
3. `CORS_ORIGINS` 환경변수 재정의 경로. 프로덕션 값이 여기 기본값과 다를 수 있으므로 코드만 보고 프로덕션을 단정하지 않는다.

### 앞선 학습

- **R1 — Railway `config apply`가 환경변수를 조용히 누락한 적이 있다.** 이 스토리는 새 변수를 요구하지 않고 `railway.ts`를 수정하지도 않는다. 그러나 `KAKAO_APP_ID` 정리 유혹이 있는 자리이므로 **선언만 먼저 빼지 않는다**는 규칙을 D3·위 표에 못 박았다.
- **R3 — 프로덕션(프록시 뒤) 실요청 검증 후에만 done.** 이 스토리는 미들웨어·쿠키를 건드리지 않지만 배포가 걸리므로 Task 10의 프로덕션 확인이 완료 조건이다.
- **R5 — 이전 보류 스캔.** 이 스토리는 반대 방향이다 — **보류 항목을 새로 만드는 쪽**(kakao/native)이며, 그것을 등록하는 것이 AC 9다.
- **A-E456-5 — 웹 lint 베이스라인 0.** `apps/mobile` 제거는 웹 lint에 영향이 없어야 정상이다. 1건이라도 늘면 무언가 잘못 지운 것이다.
- **8.6의 선례 — "Flutter판은 뭐였나"를 실제로 되물었다.** `취소완료`/`취소` 문언 판정에서 5.1(Flutter)의 매핑을 참조했다. D5가 제거 시점을 `done` 이후로 잡은 직접 근거다.
- **8.1~8.7 전부가 `git diff --stat`의 `apps/mobile` 0건을 무변경 증거로 써왔다.** 이 스토리에서 그 줄은 **47건 삭제**로 바뀐다 — 이 에픽에서 `apps/mobile`이 diff에 나타나도 되는 유일한 스토리다.

### 발견한 위험 (작업 전에 읽을 것)

1. 🚨 **태그 푸시 실패를 모르고 제거를 진행하면 코드가 영구 소실된다.** 이 스토리의 유일한 비가역 사고다. `git push`는 태그를 자동으로 보내지 않으며, **이 저장소에는 이미 로컬 전용 태그가 하나 있다**(`archive/open-gate-review-2026-07-21`, 원격 태그 0개). `git ls-remote --tags origin`의 **실제 출력**을 보기 전에는 아무것도 지우지 않는다.
2. **`git rm -r`은 추적 파일만 지운다.** Flutter를 빌드한 적 있는 머신이라면 `.dart_tool/`·`android/build/`·`.pub-cache/`가 ignored 상태로 남아 빈 디렉터리가 된다. 지금 이 머신에서는 `git status --ignored apps/mobile`이 0건이지만, **다른 머신에서 실행한다면 반드시 `ls -a apps/mobile`로 확인**한다.
3. **Epic 8의 나머지 스토리가 아직 `review`·`in-progress`다** (D5 표). 착수 조건 미충족 상태이며, Task 0이 게이트다. 게이트를 낮추는 판단은 Slur의 몫이다.
4. **에픽 AC의 "21개 dart 파일"과 실제 22개.** `lib` 21 + `integration_test/auth_flow_test.dart` 1이다. 복원 대조에서 21로 세면 integration test가 빠진 줄 모르고 통과시키거나, 22를 보고 불일치로 오판할 수 있다.
5. **에픽 AC가 요구한 `deferred-work.md` 정리 3건은 이미 2026-07-21에 반영돼 있다.** 모르고 손대면 정리된 문서를 두 번 정리한다. 8.8이 할 일은 **확인 + 상단 규약 문장의 시제 변경**이다.
6. **동시 작업 충돌.** 이 스토리 작성 시점에 다른 작업이 `apps/web`과 `8-7-*.md`를 편집 중이었다. 실행 시점에도 `sprint-status.yaml`·`deferred-work.md`는 여러 스토리가 함께 만지는 파일이므로, **작업 트리가 clean인지 Task 1에서 확인**하고 제거를 시작한다.
7. **`kakao/native` 엔드포인트가 클라이언트 0이 된다.** 보안 사고는 아니다(`kakao_app_id` 미설정 시 502로 안전). 그러나 "쓰는 사람이 없는 인증 엔드포인트"가 살아 있다는 사실은 등록해 두지 않으면 잊힌다 — AC 9.
8. **`CLAUDE.md`는 모든 세션의 첫 컨텍스트다.** 여기서 문장 하나를 잘못 지우면 이후 모든 세션의 전제가 조용히 바뀐다. 특히 Supabase 배제·ERD 승인 게이트·PG 선행 조건은 **이 스토리와 무관하므로 diff에 나타나면 안 된다.**
9. **보관이 원격 저장소 하나에 걸려 있다.** GitHub 저장소가 사라지면 태그도 사라진다. D4의 한계이며 오프라인 사본 여부는 Slur 판단이다.
10. **제거 후 `apps/mobile` 경로를 인용한 문서 링크가 죽는다** (예: `deferred-work.md`의 `cart_screen.dart:96~98`). **이것은 고치지 않는다** — 죽은 링크가 아니라 **태그 안의 좌표**이며, `git show flutter-app-final:apps/mobile/lib/src/carts/cart_screen.dart`로 여전히 열린다. D4의 복원 절차가 이 좌표들을 유효하게 유지한다.

### Project Structure Notes

- 제거 후 저장소는 `apps/api` · `apps/web` 두 워크스페이스가 된다. `docker-compose.yml`(postgres + api) · `.railway/railway.ts`(api + web) · 루트 `package.json`(railway CLI만) 모두 이미 그 형태다 — **구조 변경이 아니라 이미 참조하지 않던 디렉터리의 제거다.**
- CI 워크플로가 없다(`.github/` 부재). mobile을 참조하는 자동화 자체가 존재하지 않는다.
- 제거 규모: 추적 파일 **47** (dart 22 · android 20 · 설정·문서 5), dart **2,811줄**, **288KB**.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.8 — AC 원문(태그 생성·원격 확인·제거·복원 확인·문서 정리), Dev Notes(마지막 스토리 · Epic 1~6 대체 주석 보존)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8 — 에픽 경계(ERD 0건 · 구매자 API 12개 재사용 · 테스트 153건 · Epic 1~6 done 불변 · 구현 기록은 태그에 보존)]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-21.md#§4 — 8.8 실행 규약 3줄, "태그 원격 푸시 확인 후에만 제거", Capacitor는 v1 밖]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-21.md#§5.6 — deferred-work 정리 대상 3건(이미 반영 완료)]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-21.md#§6 — 실행 순서 5단계 게이트("태그 원격 푸시 확인"), 성공 기준 1~5]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-21.md#§3.4 — Railway는 api·web만 배포, `apps/mobile` 참조 0건]
- [Source: _bmad-output/planning-artifacts/course-correction-buyer-web-2026-07-21.md — 분기 지점(brief.md:38) 진단, Q1·Q2·Q3 확정]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#정리-규약 — `[소멸]`과 `[해소]`의 구분, "대상이 사라질 예정이라 추적을 멈추는 것"]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Epic-8 — 기존 부채 서랍(middleware→proxy rename 등). kakao/native 항목이 여기 추가된다]
- [Source: _bmad-output/implementation-artifacts/8-7-me-and-pwa.md — "이 스토리로 구매자 화면 9개가 전부 선다. 남은 것은 8.8뿐" — 8.8의 선행 조건]
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml#development_status — 8-1~8-7 현재 상태(D5 표의 출처), `8-8-flutter-archive-remove: backlog`]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md#AD-14 — 클라이언트 표면 단일화, `History:` 줄. Stack 표·배포 토폴로지에 Flutter 없음(정정 완료 확인)]
- [Source: _bmad-output/planning-artifacts/architecture/.../research-stack-versions.md#4-Flutter-Dart — 2026-07-15 리서치 시점 기록(주석 정정 대상)]
- [Source: CLAUDE.md#명령어 · #아키텍처 — `apps/mobile` 2줄, 37·39행 Flutter 서술 (고칠 것)]
- [Source: apps/mobile/** — 추적 47파일 · dart 22(lib 21 + integration_test 1) · 2,811줄 · 288KB (baseline_commit 기준 실측)]
- [Source: apps/api/app/core/config.py:15 — `cors_origins` 웹 오리진 2개, 앱 항목 0건 (D3 근거)]
- [Source: apps/api/app/auth/router.py:43 · service.py:148 · kakao.py:109~130 · tests/test_kakao.py:170~209 — kakao/native 잔재 4테스트 (AC 9)]
- [Source: .railway/railway.ts — api(`apps/api`)·web(`apps/web`) 두 서비스, mobile 참조 0건 재확인]
- [Source: git 실측 (baseline_commit) — 로컬 태그 `archive/open-gate-review-2026-07-21` 1개 · `git ls-remote --tags origin` **출력 없음**(원격 태그 0개) — D1의 핵심 근거]

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context)

### Debug Log References

_(구현 시 기록)_

### Completion Notes List

**Task 0 — 착수 게이트 (2026-07-30 개방)**

| 스토리 | 착수 전 | 게이트 후 |
|---|---|---|
| 8-1 buyer-web-shell | in-progress | done |
| 8-2 buyer-auth-web | in-progress | done |
| 8-3 buyer-product-browse-web | review | done |
| 8-4 cart-web | review | done |
| 8-5 checkout-web | in-progress | done |
| 8-6 order-history-cancel-web | review | done |
| 8-7 me-and-pwa | in-progress | done |

실기 검증 근거(A-E8-2 해소): Hub맥 Docker를 **최신 코드로 재빌드**(기존 이미지는 9시간 전 것이라 이후 커밋 미반영)하고 `local_seed_bulk`로 대량 더미를 넣은 뒤(주문 34건 = 입금대기12·배송준비7·배송중6·배송완료5·취소4 / 판매자 영업중4·심사대기3·반려1 / 상품 32 = active24·soldout4·hidden4 / 회원 21), Slur가 관리자 10화면·판매자·구매자 전 플로우를 직접 점검하고 **이상 없음**을 확인했다. `sprint-status.yaml`의 A-E8-2를 done으로 갱신.

**Task 1 — 제거 전 실측 (전부 기대값 일치)**

```
추적 파일 47 (기대 47) · dart 22 = lib 21 + integration_test 1 (기대 22) · dart 2,811줄 (기대 2,811) · 384K
```

⚠️ **스토리 전제와 달랐던 점**: D4·Dev Notes는 "이 머신에 `flutter`·`dart` CLI가 없어 `flutter analyze`를 새로 돌릴 수 없다"고 적었으나, **이 머신(Hub맥)에는 있다**(`/opt/homebrew/bin/flutter`). 따라서 옛 기록을 인용하는 대신 실제로 실행했다 — `flutter pub get` 후 **`flutter analyze` → No issues found! (4.6s)**. 앱이 정상 상태로 보관됐음을 인용이 아니라 실측으로 남긴다.

**Task 2·3 — 태그와 원격 확인 (D1의 핵심)**

annotated 태그 확인(`git cat-file -t` → `tag`). 대상 커밋 `cf60ff4`에 `apps/mobile/pubspec.yaml`이 실재함을 `git show`로 직접 확인.

```
$ git ls-remote --tags origin | grep flutter-app-final
3357a70f086951d33baf47caf8a0d12ac39b0ae2	refs/tags/flutter-app-final
cf60ff42d8ccdb89da7bbbf5b4676b40f02c3d2a	refs/tags/flutter-app-final^{}

$ git rev-parse flutter-app-final^{}
cf60ff42d8ccdb89da7bbbf5b4676b40f02c3d2a      <- 일치
```

**Task 4 — 제거 전 복원 실증**: `git worktree add <스크래치패드>/flutter-restore flutter-app-final` -> 47파일 / dart 22 대조 일치, `lib/src/carts/cart_screen.dart` 실제 열림 확인. worktree 제거 완료(`git worktree list`에 잔여 없음).

**Task 5 — 제거**: `git rm -r apps/mobile` 후 `git ls-files apps/mobile` **0줄**. 스토리 위험 #2가 예측한 대로 ignored 산출물(`.dart_tool`·`.flutter-plugins-dependencies`·`android`·`slur_mobile.iml`)이 빈 디렉터리로 남아 `rm -rf apps/mobile`로 수동 제거 — `ls -a apps/mobile` 없음 확인. 저장소는 `apps/api`·`apps/web` 두 워크스페이스가 됐다.

> 참고: 같은 세션에서 제거 **전에** ignored 빌드 산출물 **2.1GB**(`build/`·`.dart_tool/`·`android/build`·`android/.gradle`)를 먼저 정리했다(2.4G -> 384K). git 추적 파일 0건이라 저장소 영향은 없다.

**Task 6·7 — 문서 정리**

고친 것: `CLAUDE.md`(명령어 2줄 제거 / "Flutter·Next.js는" -> "Next.js는" / 구매자 표면 줄을 AD-14 서술로 / 구현 상태 줄에 Epic 8 완료·Epic 9 review 반영) · `deferred-work.md`(상단 규약을 완료 사실로 + "남은 `apps/mobile/...` 경로는 죽은 링크가 아니라 태그 안의 좌표" 명시) · `research-stack-versions.md`(§4와 권장 핀 요약에 **지우지 않고** 정정 주석).

남길 것 검증: `epics.md` · 완료 스토리 파일 · `brief.md` · `prd.md` · 코스 코렉션 2문서 · `ARCHITECTURE-SPINE.md` · `EXPERIENCE.md` · `apps/web/app/(buyer)/**` 전부 **diff 0건** 확인.

**Task 8 — 잔재 등록**: `POST /api/v1/auth/kakao/native` 계열을 `deferred-work.md` Epic 8 절에 신규 항목으로 등록. 지우지 않는 이유 3가지와 `railway.ts` `KAKAO_APP_ID: preserve()` 선행 제거 금지(R1 사고 유형)를 함께 기록. `apps/api` 코드는 열지 않았다.

**Task 9 — 검증**

- `npx tsc --noEmit` -> **0**
- `npx next build` -> **성공** (라우트 정상, `f Proxy (Middleware)` 포함)
- `npm run lint` -> **0 errors / 1 warning**. ⚠️ 베이스라인(0/0)에서 늘어난 1건은 **이 스토리의 변경이 아니다** — `(console)/seller/products/[id]/edit/page.tsx:32`의 미사용 `NewImage`로, 같은 워킹트리에서 **다른 세션이 작업 중인 신규 파일**이다. 이 커밋의 스테이징에는 포함되지 않았다
- 커밋 스테이징 `apps/api` **0건** · `apps/web` **0건** 확인 (다른 세션의 미커밋 변경 5파일이 워킹트리에 있어 경로를 명시해 스테이징)
- `pytest` **미실행** — 이 워킹트리의 `apps/api`에 다른 세션의 미커밋 변경 4파일(products·sellers 계열)이 있어, 지금 실행한 결과는 이 스토리의 무변경 증거가 될 수 없다. 이 스토리는 `apps/api`를 열지 않았고 diff 0건이다
- `docker-compose.yml`·루트 `package.json`·`scripts/`·`.railway/` mobile 참조 **0건**, `.github/` 부재 확인

**Task 10 — 배포**: Railway 대신 **Hub맥 Docker가 현행 실호스트**다. 제거 전 최신 코드로 재빌드한 컨테이너에서 web `/` 200 · `/login` 200 · api `/api/v1/health` 200 확인. Railway 배포 확인은 이 커밋을 main에 반영하는 시점의 판단으로 넘긴다.

**Task 11 — 제거 후 복원 (수행 완료)**: 제거 커밋 `82ef255`를 원격에 push한 **뒤에** 재시험했다. 워킹트리에 `apps/mobile`이 없는 상태에서 `git worktree add <스크래치패드>/verify-restore flutter-app-final` -> **47파일 / dart 22 / 2,811줄** 전부 기대값 일치, worktree 제거 완료. Task 4가 "태그가 온전한가"였다면 이것은 "**main 계열에서 지운 뒤에도 태그에서 되살아나는가**"이며, 코스 코렉션 §6 성공 기준 5가 요구한 것은 후자다.

**스토리 전제와 달랐던 점 정리** — (1) `flutter` CLI 존재(-> analyze 실측으로 대체) (2) 워킹트리 clean 전제 불성립(다른 세션 동시 작업 -> 경로 명시 스테이징으로 대응, `apps/api`·`apps/web` 0건 확인) (3) Railway -> Hub맥 Docker로 배포 검증 경로 변경.


- Task 0 게이트 확인 결과 (8.1~8.7 Status 표 + 실기 완주 근거)
- Task 1 제거 전 실측값 (파일 수 · dart 수 · 용량 · `flutter` CLI 부재)
- **Task 3 `git ls-remote --tags origin` 원문 출력 + SHA 대조 결과** ← 이것 없이 Task 5 이후를 진행했다면 절차 위반
- Task 4 / Task 11 복원 확인 (사용한 명령 · 대조한 파일 수)
- Task 9 검증 수치 (tsc · lint · build · `apps/api` diff 0건 · pytest 미실행 사유)
- Task 10 프로덕션 배포·health 확인
- 문서 정리에서 "고칠 것"과 "남길 것"을 어떻게 갈랐는지, 표와 다르게 판단한 곳이 있으면 그 사유

### File List

삭제: `apps/mobile/**` 47파일
수정: `CLAUDE.md` · `deferred-work.md` · `sprint-status.yaml` · `research-stack-versions.md` · `8-1`~`8-7` 스토리 파일 Status · 이 파일

### Change Log

| 날짜 | 변경 | 비고 |
|---|---|---|
| 2026-07-22 | 스토리 작성 (`ready-for-dev`) | D1~D6 확정. 착수 게이트(8.1~8.7 done) 미충족 상태 |
| 2026-07-30 | 실행 완료 (`done`) | 실기 검증으로 게이트 개방 -> 태그 `flutter-app-final` 원격 확인 -> 47파일 제거 -> 문서 정리. flutter analyze 실측(No issues) |
