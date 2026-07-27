import type { Metadata } from "next";

import { TermsDoc } from "@/app/legal/policy-docs";
import "@/app/styles/policy.css";

export const metadata: Metadata = {
  title: "이용약관 | SLUR",
  description: "SLUR 서비스 이용약관",
};

/* 본문은 단일 콘텐츠 소스 app/legal/policy-docs.tsx의 <TermsDoc />이다 —
   구매자 정책 모달과 같은 컴포넌트를 공유한다(중복 창작 금지, FR-33). policy.css로 스타일. */
export default function TermsPage() {
  return (
    <main className="page_policy">
      <div className="p_doc">
        <TermsDoc />
      </div>
    </main>
  );
}
