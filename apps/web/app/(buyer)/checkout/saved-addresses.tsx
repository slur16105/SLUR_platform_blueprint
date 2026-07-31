"use client";

/* 저장된 배송지 선택 — 주문서 상단에 붙는다.

   주소록은 **입력을 채워주는 장치**일 뿐이다. 선택하면 폼에 값을 넣어줄 뿐, 주문에 실리는 값은
   여전히 폼의 내용이다(주문의 배송지는 스냅샷 — AD-7).

   🚨 폼과 검증 규칙이 같아야 한다(우편번호 5자리·전화 숫자 9~11자리) — 저장은 됐는데 주문이
      거부되면 사용자는 이유를 알 수 없다. 서버가 두 곳에서 같은 규칙을 쓴다. */

import { useCallback, useEffect, useState } from "react";

import type { AddressValues } from "./address-form";

export type SavedAddress = {
  id: string;
  label: string;
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  address1: string;
  address2: string;
  is_default: boolean;
};

export function toValues(a: SavedAddress, orderNote: string): AddressValues {
  return {
    recipientName: a.recipient_name,
    recipientPhone: a.recipient_phone,
    postalCode: a.postal_code,
    address1: a.address1,
    address2: a.address2,
    orderNote,
  };
}

export default function SavedAddresses({
  onPick,
  onLoaded,
}: {
  onPick: (a: SavedAddress) => void;
  /** 기본 배송지를 처음 한 번 자동 적용하기 위해 부모에게 알린다 */
  onLoaded?: (list: SavedAddress[]) => void;
}) {
  const [list, setList] = useState<SavedAddress[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/addresses");
      // 비로그인·오류는 조용히 숨긴다 — 주소록이 없어도 주문은 직접 입력으로 가능하다
      if (!res.ok) return void setList([]);
      const rows: SavedAddress[] = await res.json();
      setList(rows);
      const def = rows.find((r) => r.is_default) ?? rows[0];
      if (def) setSelected(def.id);
      onLoaded?.(rows);
    } catch {
      setList([]);
    }
  }, [onLoaded]);

  useEffect(() => { void (async () => { await load(); })(); }, [load]);

  if (list === null || list.length === 0) return null;

  return (
    <section className="mb-8 border border-border p-5" aria-labelledby="saved_addr_cap">
      <p id="saved_addr_cap" className="text-[13px] font-medium">저장된 배송지</p>
      <ul className="mt-3 space-y-2">
        {list.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => { setSelected(a.id); onPick(a); }}
              aria-pressed={selected === a.id}
              className={`w-full border p-3 text-left text-[14px] transition-colors ${
                selected === a.id ? "border-foreground" : "border-border hover:border-foreground/50"
              }`}
            >
              <span className="flex flex-wrap items-center gap-2">
                {a.label && <span className="border border-border px-1.5 py-0.5 text-[12px]">{a.label}</span>}
                <span className="font-medium">{a.recipient_name}</span>
                {a.is_default && <span className="text-[12px] text-muted-foreground">기본 배송지</span>}
              </span>
              <span className="mt-1 block text-[13px] text-muted-foreground">
                [{a.postal_code}] {a.address1} {a.address2}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-muted-foreground">
        선택하면 아래 배송 정보가 채워집니다. 내용을 고쳐도 저장된 배송지는 바뀌지 않습니다.
      </p>
    </section>
  );
}
