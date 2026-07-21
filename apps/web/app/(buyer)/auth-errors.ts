/* 로그인·회원가입 두 화면이 공유하는 오류 표시 규약 (R6 에러 code 시드).
   분기는 봉투의 code로, 표시는 아래 고정 한국어 문장으로 한다 —
   HTTP 코드·code 문자열은 화면에 절대 쓰지 않는다 (UX-DR9·15).
   auth.css와 같은 이유로 그룹 루트에 평평하게 둔다: 두 라우트가 함께 쓴다.
   page/layout/route가 아니므로 라우트를 만들지 않는다. */

export type ErrorEnvelope = {
  code?: string;
  message?: string;
  details?: { field?: string; reason?: string }[];
};

export const MSG = {
  invalidCredentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  emailExists: "이미 가입된 이메일입니다.",
  serviceUnavailable: "잠시 후 다시 시도해 주세요.",
  network: "네트워크 연결을 확인해 주세요.",
  generic: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  invalidInput: "입력값이 올바르지 않습니다.",
  kakaoFailed: "카카오 로그인을 완료하지 못했습니다. 다시 시도해 주세요.",
  kakaoConflict: "이미 이메일로 가입된 계정입니다. 이메일 로그인을 이용해 주세요.",
} as const;

export type FieldErrors = Record<string, string>;

/** 422 validation_error의 details[]를 필드에 매핑한다.
 *  field에는 `body.password`처럼 접두어가 붙어 오므로 떼어 낸다.
 *  매핑되지 않는 항목은 폼 하단 한 줄로 흘린다 — 조용히 삼키지 않는다. */
export function mapFieldErrors(
  details: ErrorEnvelope["details"],
  known: readonly string[],
): { fields: FieldErrors; rest: string[] } {
  const fields: FieldErrors = {};
  const rest: string[] = [];
  for (const d of details ?? []) {
    const field = (d.field ?? "").replace(/^body\./, "");
    const reason = d.reason || MSG.invalidInput;
    if (known.includes(field) && !fields[field]) fields[field] = reason;
    else rest.push(reason);
  }
  return { fields, rest };
}

/** `?e=` 토큰은 kakao · conflict · state 셋뿐이다(취소는 토큰 없음).
 *  모르는 값은 무시한다 — 서버 메시지 원문이 URL로 들어오는 경로를 만들지 않는다. */
export function kakaoNotice(e: string | undefined): string | null {
  if (e === "conflict") return MSG.kakaoConflict;
  if (e === "kakao" || e === "state") return MSG.kakaoFailed;
  return null;
}

/** 단일 값 쿼리 읽기 — Next 16의 searchParams는 배열일 수 있다. */
export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
