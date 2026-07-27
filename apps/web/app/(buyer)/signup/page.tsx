import BuyerShell from "../buyer-shell";
import { firstParam } from "../auth-errors";
import SignupForm from "./signup-form";
import { safeNextPath } from "@/lib/nav";

import "../auth.css";

/* 회원가입 — `/signup` (신규 URL 1건).
   상단바는 뒤로가기 + `회원가입` 제목형, 탭바 없음, 640px 한 단 (EXPERIENCE §IA 5번 행).
   next는 로그인과 같은 규칙으로 소비된다 — 서버에서 한 번 거른 뒤 폼에 문자열로 내린다 (D5). */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(firstParam(sp.next));

  return (
    <BuyerShell topbar={{ variant: "back-title", title: "회원가입" }}>
      <div className="b_frame">
        <div className="b_col_form b_auth">
          <SignupForm next={next} />
        </div>
      </div>
    </BuyerShell>
  );
}
