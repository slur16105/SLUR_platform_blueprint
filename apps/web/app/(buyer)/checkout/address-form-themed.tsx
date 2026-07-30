"use client";

/* 배송지 폼 — **새 테마 판**. 모양만 새로 짰고 **검증 로직은 기존 것을 그대로 import해 쓴다**
   (validateField·isAddressComplete·digitsOnly·SERVER_FIELD_MAP은 address-form.tsx가 소유).
   같은 규칙을 두 벌로 만들면 언젠가 어긋나므로 복사하지 않았다.

   🚨 우편번호는 검색 결과로 채워지되 **직접 입력도 항상 가능하다** — 외부 스크립트(다음 우편번호)가
      죽어도 주문이 막히지 않아야 한다. readOnly로 잠그지 않는 것이 그 결정의 전부다. */

import type { Ref } from "react";

import type { AddressField, AddressValues, FieldErrorMap } from "./address-form";

const LABEL: Record<AddressField, string> = {
  recipientName: "수령인",
  recipientPhone: "연락처",
  postalCode: "우편번호",
  address1: "주소",
  address2: "상세주소",
  orderNote: "요청사항",
};

const INPUT =
  "w-full border border-border bg-background px-4 text-[15px] h-12 transition-colors focus:border-foreground focus:outline-none disabled:bg-muted disabled:text-muted-foreground";

function Field({
  field,
  optional,
  error,
  children,
}: {
  field: AddressField;
  optional?: boolean;
  error?: string;
  children: (a: { id: string; className: string; describedBy?: string }) => React.ReactNode;
}) {
  const id = `co_${field}`;
  const errId = error ? `${id}_err` : undefined;
  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-2 block text-[13px] font-medium">
        {LABEL[field]}
        {optional ? <span className="ml-1.5 text-[12px] text-muted-foreground">(선택)</span> : null}
      </label>
      {children({
        id,
        className: `${INPUT} ${error ? "border-accent" : ""}`,
        describedBy: errId,
      })}
      {error ? (
        <p id={errId} role="alert" className="mt-2 text-[12px] text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function AddressFormThemed({
  values,
  errors,
  onChange,
  onBlur,
  onOpenPostcode,
  searchButtonRef,
  address2Ref,
  disabled,
}: {
  values: AddressValues;
  errors: FieldErrorMap;
  onChange: (field: AddressField, value: string) => void;
  onBlur: (field: AddressField) => void;
  onOpenPostcode: () => void;
  searchButtonRef: Ref<HTMLButtonElement>;
  address2Ref: Ref<HTMLInputElement>;
  disabled: boolean;
}) {
  return (
    <>
      <Field field="recipientName" error={errors.recipientName}>
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

      <Field field="recipientPhone" error={errors.recipientPhone}>
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

      <Field field="postalCode" error={errors.postalCode}>
        {(a) => (
          <div className="flex gap-2">
            <input
              id={a.id}
              className={`${a.className} flex-1`}
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
              ref={searchButtonRef}
              disabled={disabled}
              onClick={onOpenPostcode}
              className="h-12 flex-none border border-foreground px-5 text-[13px] font-semibold transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
            >
              우편번호 검색
            </button>
          </div>
        )}
      </Field>

      <Field field="address1" error={errors.address1}>
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

      <Field field="address2" optional error={errors.address2}>
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

/** 배송 요청사항 — 구획이 따로라 별도 export다. 같은 폼 프리미티브를 쓴다. */
export function OrderNoteFieldThemed({
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
    <Field field="orderNote" optional error={error}>
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
