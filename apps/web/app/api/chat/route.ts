import { NextRequest, NextResponse } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

// 안내 도우미 — 로그인 불필요(근거가 FAQ·약관이라 공개 지면과 같은 내용이다).
// 상태 조회는 화면이 "그릴지 말지"를 정하는 데 쓴다 — 꺼져 있으면 입력창을 아예 만들지 않는다.
export async function GET(req: NextRequest) {
  return proxyWithRefresh(req, "/api/v1/chat/status", { method: "GET" });
}

export async function POST(req: NextRequest) {
  // 상태를 바꾸지는 않지만 서버 자원을 쓰는 요청이라 다른 BFF와 같은 Origin 검사를 건다
  const bad = assertSameOrigin(req);
  if (bad) return bad;

  let question = "";
  try {
    question = String(((await req.json()) as { question?: unknown }).question ?? "");
  } catch {
    return NextResponse.json({ code: "validation_error", message: "질문을 입력해 주세요." }, { status: 400 });
  }
  return proxyWithRefresh(req, "/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}
