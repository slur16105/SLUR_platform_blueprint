"use client";

/* 배송지 6필드 — 수령인 · 연락처 · 우편번호(+검색) · 주소 · 상세주소 · 배송 요청사항.
   요청사항은 AC 1이 별도 구획으로 못 박았으므로 이 파일이 두 조각으로 export한다
   (같은 폼 프리미티브를 쓰는 한 벌이라 파일은 하나다).

   D8 — 클라이언트 검사는 **형식만**이다. 제출 버튼 비활성 판정과 즉시 피드백에만 쓰고,
        서버가 422 validation_error를 주면 그 details가 이긴다.
   🚨 오류는 **해당 필드에만** 테두리·면 + 아래 한 줄. 상단 요약 배너를 쓰지 않는다 (UX-DR9).
   🚨 라벨-필드-오류를 htmlFor/id/aria-describedby로 묶는다 — 색 하나로만 오류를 말하지 않는다.
   🚨 연락처에 자동 하이픈 마스킹을 만들지 않는다 — 커서 위치·붙여넣기·IME에서 잔버그가 나고
      완주에 기여하지 않는다. 전송 직전 숫자만 남기는 쪽이 계약(^\d{9,11}$)과 정확히 맞는다. */

import type { Ref } from "react";

export type AddressValues = {
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2: string;
  orderNote: string;
};

export type AddressField = keyof AddressValues;

export type FieldErrorMap = Partial<Record<AddressField, string>>;

/** 서버 필드명 → 화면 필드. 422 details를 입력 아래로 옮길 때 쓴다 (AC 11). */
export const SERVER_FIELD_MAP: Record<string, AddressField> = {
  recipient_name: "recipientName",
  recipient_phone: "recipientPhone",
  postal_code: "postalCode",
  address1: "address1",
  address2: "address2",
  order_note: "orderNote",
};

const INPUT_ID: Record<AddressField, string> = {
  recipientName: "co_recipient",
  recipientPhone: "co_phone",
  postalCode: "co_postal",
  address1: "co_address1",
  address2: "co_address2",
  orderNote: "co_note",
};

/** 숫자만 남긴다 — 전송 직전에 쓰고, 자릿수 검사도 이 결과로 한다 (D8, 위험 4). */
export function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

/** 형식 검사 한 곳. 통과하면 null, 아니면 필드 아래에 놓을 문장. */
export function validateField(field: AddressField, raw: string): string | null {
  const v = raw.trim();
  switch (field) {
    case "recipientName":
      if (v.length === 0) return "수령인을 입력해 주세요.";
      if (v.length > 50) return "수령인은 50자까지 입력할 수 있습니다.";
      return null;
    case "recipientPhone": {
      const d = digitsOnly(v);
      if (d.length === 0) return "연락처를 입력해 주세요.";
      if (d.length < 9 || d.length > 11) return "연락처는 숫자 9~11자리로 입력해 주세요.";
      return null;
    }
    case "postalCode":
      if (v.length === 0) return "우편번호를 입력해 주세요.";
      if (!/^\d{5}$/.test(v)) return "우편번호는 숫자 5자리입니다.";
      return null;
    case "address1":
      if (v.length === 0) return "주소를 입력해 주세요.";
      if (v.length > 255) return "주소는 255자까지 입력할 수 있습니다.";
      return null;
    case "address2":
      if (v.length > 255) return "상세주소는 255자까지 입력할 수 있습니다.";
      return null;
    case "orderNote":
      if (v.length > 500) return "배송 요청사항은 500자까지 입력할 수 있습니다.";
      return null;
  }
}

const REQUIRED: AddressField[] = ["recipientName", "recipientPhone", "postalCode", "address1"];

/** 제출 버튼 비활성 판정 — 필수 넷이 형식을 통과하고 선택 둘이 길이를 넘지 않았는가. */
export function isAddressComplete(values: AddressValues): boolean {
  for (const f of REQUIRED) if (validateField(f, values[f]) !== null) return false;
  return validateField("address2", values.address2) === null && validateField("orderNote", values.orderNote) === null;
}

type FieldProps = {
  field: AddressField;
  label: string;
  optional?: boolean;
  error?: string;
  children: (a: { id: string; className: string; describedBy: string | undefined }) => React.ReactNode;
};

function Field({ field, label, optional, error, children }: FieldProps) {
  const id = INPUT_ID[field];
  const errId = `${id}_err`;
  return (
    <div className="b_field b_row">
      <label className="b_label" htmlFor={id}>
        {label}
        {optional ? <i className="i_opt">(선택)</i> : null}
      </label>
      {children({
        id,
        className: `b_input b_input_text${error ? " m_error" : ""}`,
        describedBy: error ? errId : undefined,
      })}
      {error ? (
        <p className="b_err_msg" id={errId} role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type AddressFormProps = {
  values: AddressValues;
  errors: FieldErrorMap;
  onChange: (field: AddressField, value: string) => void;
  onBlur: (field: AddressField) => void;
  /** 우편번호 오버레이를 여는 유일한 지점 */
  onOpenPostcode: () => void;
  /** 오버레이를 닫으면 이 버튼으로 포커스가 돌아온다 (AC 4) */
  searchButtonRef: Ref<HTMLButtonElement>;
  /** 주소를 고르면 포커스가 이 입력으로 간다 — 상세주소는 직접 입력이다 (AC 4) */
  address2Ref: Ref<HTMLInputElement>;
  disabled: boolean;
};

export default function AddressForm({
  values,
  errors,
  onChange,
  onBlur,
  onOpenPostcode,
  searchButtonRef,
  address2Ref,
  disabled,
}: AddressFormProps) {
  return (
    <>
      <Field field="recipientName" label="수령인" error={errors.recipientName}>
        {(a) => (
          <input
            id={a.id}
            className={a.className}
            aria-describedby={a.describedBy}
            type="text"
            autoComplete="name"
            maxLength={50}
            disabled={disabled}
            value={values.recipientName}
            onChange={(e) => onChange("recipientName", e.target.value)}
            onBlur={() => onBlur("recipientName")}
          />
        )}
      </Field>

      <Field field="recipientPhone" label="연락처" error={errors.recipientPhone}>
        {(a) => (
          <input
            id={a.id}
            className={a.className}
            aria-describedby={a.describedBy}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            placeholder="01012345678"
            disabled={disabled}
            value={values.recipientPhone}
            onChange={(e) => onChange("recipientPhone", e.target.value)}
            onBlur={() => onBlur("recipientPhone")}
          />
        )}
      </Field>

      <Field field="postalCode" label="우편번호" error={errors.postalCode}>
        {(a) => (
          /* 검색 결과로 채워지되 **직접 입력도 항상 가능하다** — 외부 스크립트가 죽어도
             주문이 막히지 않아야 한다 (D1). readOnly로 잠그지 않는 것이 그 결정의 전부다. */
          <span className="b_input_row">
            <input
              id={a.id}
              className={a.className}
              aria-describedby={a.describedBy}
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              placeholder="04044"
              disabled={disabled}
              value={values.postalCode}
              onChange={(e) => onChange("postalCode", e.target.value)}
              onBlur={() => onBlur("postalCode")}
            />
            <button
              type="button"
              className="b_btn m_small"
              ref={searchButtonRef}
              disabled={disabled}
              onClick={onOpenPostcode}
            >
              우편번호 검색
            </button>
          </span>
        )}
      </Field>

      <Field field="address1" label="주소" error={errors.address1}>
        {(a) => (
          <input
            id={a.id}
            className={a.className}
            aria-describedby={a.describedBy}
            type="text"
            autoComplete="street-address"
            maxLength={255}
            disabled={disabled}
            value={values.address1}
            onChange={(e) => onChange("address1", e.target.value)}
            onBlur={() => onBlur("address1")}
          />
        )}
      </Field>

      <Field field="address2" label="상세주소" optional error={errors.address2}>
        {(a) => (
          <input
            id={a.id}
            className={a.className}
            aria-describedby={a.describedBy}
            ref={address2Ref}
            type="text"
            maxLength={255}
            disabled={disabled}
            value={values.address2}
            onChange={(e) => onChange("address2", e.target.value)}
            onBlur={() => onBlur("address2")}
          />
        )}
      </Field>
    </>
  );
}

/** 배송 요청사항 — 구획이 따로라 별도 export다 (AC 1). 같은 폼 프리미티브를 쓴다. */
export function OrderNoteField({
  value,
  error,
  onChange,
  onBlur,
  disabled,
}: {
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  disabled: boolean;
}) {
  return (
    <Field field="orderNote" label="요청사항" optional error={error}>
      {(a) => (
        <input
          id={a.id}
          className={a.className}
          aria-describedby={a.describedBy}
          type="text"
          maxLength={500}
          placeholder="부재 시 경비실에 맡겨주세요"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      )}
    </Field>
  );
}
