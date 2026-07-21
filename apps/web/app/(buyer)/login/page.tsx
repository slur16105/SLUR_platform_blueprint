import BuyerShell from "../buyer-shell";
import { firstParam, kakaoNotice } from "../auth-errors";
import LoginForm from "./login-form";
import { safeNextPath } from "@/lib/nav";

import "../auth.css";

/* 로그인 — `/login` (URL 불변).
   판매자·관리자도 이 화면으로 로그인한다 — 역할별로 진입점을 쪼개지 않는다 (FR-3, D2).
   상단바는 로고 중앙형, 탭바 없음, 본문 640px 한 단 (EXPERIENCE §IA 4번 행).

   서버 컴포넌트인 이유(D5): next 검증이 클라이언트로 내려가면 "검증 후 사용" 순서를
   렌더 타이밍이 흔들 수 있고, useSearchParams()는 Suspense 경계 없이 쓰면 빌드를 흔든다.
   searchParams는 Next 16에서 Promise다. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(firstParam(sp.next)); // 미들웨어가 심었더라도 소비 측이 다시 확인한다
  const notice = kakaoNotice(firstParam(sp.e));

  return (
    <BuyerShell topbar={{ variant: "logo-center" }}>
      <div className="b_container m_read b_auth">
        <LoginForm next={next} notice={notice} />
      </div>
    </BuyerShell>
  );
}
