"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/* 옵션 축 칩 + 선택 결과 줄 (FR-9·10, UX-DR8).

   축을 만드는 규칙: option1_name·option2_name은 백엔드가 전 행 동일을 강제한다
   (VariantsReplace.within_cap_and_unique). 그러므로 첫 조합에서 축 이름을 읽고,
   값 목록은 variants가 내려온 순서(판매자가 만든 순서)대로 중복 제거해 만든다.
   🚨 클라이언트가 재정렬하지 않는다. 이름이 빈 문자열이면 그 축은 없다.

   판정 (D6) — 마지막으로 만진 축이 기준축(pivot)이다.
   · 기준축의 칩   : 전역 판정 (그 값이 들어간 조합 중 purchasable이 하나라도 있는가)
   · 상대축의 칩   : 기준축 선택값과 짝지은 조합 하나의 purchasable
   · 선택 유지     : 상대축 선택이 불가능해져도 해제하지 않는다 —
                     자동 해제하면 "품절 조합이 선택되면 CTA 두 개 비활성"이 성립할 수 없다.
   양쪽 축을 서로 기준으로 삼으면 막다른 골목이 생긴다(먹/240 품절 · 먹/320 가능인 상품에서
   `먹`이 영영 비활성). 기준축만 전역 판정하면 그 구멍이 닫힌다.

   🚨 비활성 칩에 disabled 속성을 쓰지 않는다 — 포커스에서 빠지고 스크린리더가 건너뛴다.
      숨기지 않는 이유(그 조합이 원래 있었다는 사실)가 낭독에서 사라지면 안 된다.
      aria-disabled="true" + 클릭 무시로 구현한다 (Accessibility Floor).

   🚨 재고 수량을 화면에 쓰지 않는다 — 응답에 없다(단일 술어 purchasable만 내려온다, AD-10). */

/** GET /api/v1/products/{id}의 variants[] 한 항목 (PublicVariant). */
export type PublicVariant = {
  id: string;
  option1_name: string;
  option1_value: string;
  option2_name: string;
  option2_value: string;
  final_price: number;
  purchasable: boolean;
};

type AxisNo = 1 | 2;
type ChipState = { disabled: boolean; sub: string | null };

const SUB_SOLD_OUT = "품절";
const SUB_PARTIAL = "일부 품절";
const MSG_CHOOSE = "옵션을 선택해 주세요."; // [ASSUMPTION] 목업에 없는 문구
const MSG_ALL_SOLD_OUT = "현재 구매할 수 있는 옵션이 없습니다."; // [ASSUMPTION] 목업에 없는 문구

function valueOf(v: PublicVariant, axis: AxisNo): string {
  return axis === 1 ? v.option1_value : v.option2_value;
}

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export default function OptionAxes({
  variants,
  initialVariantId,
  onSelect,
}: {
  variants: PublicVariant[];
  /** ?variant=<uuid> 복원값. 응답에 없는 값은 무시한다 — 표시 상태이지 권위가 아니다 (D4). */
  initialVariantId: string | null;
  onSelect: (variantId: string | null) => void;
}) {
  const first = variants[0];
  const name1 = first?.option1_name ?? "";
  const name2 = first?.option2_name ?? "";
  const has1 = name1 !== "";
  const has2 = name2 !== "";

  const values1 = useMemo(
    () => (has1 ? uniq(variants.map((v) => v.option1_value)) : []),
    [variants, has1],
  );
  const values2 = useMemo(
    () => (has2 ? uniq(variants.map((v) => v.option2_value)) : []),
    [variants, has2],
  );

  const restored = variants.find((v) => v.id === initialVariantId) ?? null;
  const [sel1, setSel1] = useState<string | null>(restored && has1 ? restored.option1_value : null);
  const [sel2, setSel2] = useState<string | null>(restored && has2 ? restored.option2_value : null);
  const [pivot, setPivot] = useState<AxisNo | null>(null);

  /* 조합이 특정됐는가 — 존재하는 축이 전부 정해졌을 때만.
     축이 0개면(옵션 없는 상품, 백엔드가 조합 1개로 만든다) 유일 조합이 자동 선택된다. */
  const selected = useMemo(() => {
    if (!has1 && !has2) return variants[0] ?? null;
    if (has1 && sel1 === null) return null;
    if (has2 && sel2 === null) return null;
    return (
      variants.find(
        (v) => (!has1 || v.option1_value === sel1) && (!has2 || v.option2_value === sel2),
      ) ?? null
    );
  }, [variants, has1, has2, sel1, sel2]);

  const selectedId = selected?.id ?? null;
  useEffect(() => {
    onSelect(selectedId);
  }, [selectedId, onSelect]);

  const judge = useCallback(
    (axis: AxisNo, value: string): ChipState => {
      const other: AxisNo = axis === 1 ? 2 : 1;
      const otherHas = other === 1 ? has1 : has2;
      const otherSel = other === 1 ? sel1 : sel2;
      // 상대축 판정 — 기준축이 정해져 있을 때만. 그 외에는 전역 판정이다.
      if (otherHas && otherSel !== null && pivot === other) {
        const combo = variants.find(
          (v) => valueOf(v, axis) === value && valueOf(v, other) === otherSel,
        );
        return combo?.purchasable ? { disabled: false, sub: null } : { disabled: true, sub: SUB_SOLD_OUT };
      }
      const combos = variants.filter((v) => valueOf(v, axis) === value);
      const ok = combos.filter((v) => v.purchasable).length;
      if (ok === 0) return { disabled: true, sub: SUB_SOLD_OUT };
      if (ok < combos.length) return { disabled: false, sub: SUB_PARTIAL };
      return { disabled: false, sub: null };
    },
    [variants, has1, has2, sel1, sel2, pivot],
  );

  function pick(axis: AxisNo, value: string, state: ChipState) {
    if (state.disabled) return; // aria-disabled — 클릭을 무시한다
    if (axis === 1) setSel1(value);
    else setSel2(value);
    setPivot(axis);
  }

  const allSoldOut = variants.length > 0 && variants.every((v) => !v.purchasable);
  const comboText = [has1 ? sel1 : null, has2 ? sel2 : null].filter(Boolean).join(" / ");

  const renderAxis = (axis: AxisNo, label: string, values: string[], sel: string | null) => (
    <div className="b_axis">
      <span className="b_label i_name">{label}</span>
      <div className="i_chips">
        {values.map((value) => {
          const state = judge(axis, value);
          const isSelected = sel === value;
          return (
            <button
              key={value}
              type="button"
              className="b_opt b_control"
              data-selected={isSelected ? "true" : undefined}
              aria-pressed={isSelected}
              aria-disabled={state.disabled ? "true" : undefined}
              onClick={() => pick(axis, value, state)}
            >
              <span className="i_value">{value}</span>
              {state.sub ? <span className="b_tag i_sub">{state.sub}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  // 축이 없는 상품 — 축 UI를 그리지 않는다. 전 조합 품절일 때만 사실을 말한다.
  if (!has1 && !has2) {
    return allSoldOut ? (
      <div className="b_pick m_message">
        <span className="b_control i_msg">{MSG_ALL_SOLD_OUT}</span>
      </div>
    ) : null;
  }

  return (
    <section className="b_options">
      <h2 className="b_section_label i_head">옵션 선택</h2>
      {has1 ? renderAxis(1, name1, values1, sel1) : null}
      {has2 ? renderAxis(2, name2, values2, sel2) : null}

      {/* 선택 결과 한 줄 — 조합 목록을 따로 나열하지 않는다 (EXPERIENCE Component Patterns). */}
      {allSoldOut ? (
        <div className="b_pick m_message">
          <span className="b_control i_msg">{MSG_ALL_SOLD_OUT}</span>
        </div>
      ) : selected ? (
        <div className="b_pick">
          <span className="b_section_label i_key">선택</span>
          <span className="b_product_name_row i_value">{comboText}</span>
          <span
            className={`b_status_label i_state ${selected.purchasable ? "m_waiting" : "m_finished"}`}
          >
            {selected.purchasable ? "구매 가능" : "품절"}
          </span>
        </div>
      ) : (
        <div className="b_pick m_message">
          <span className="b_control i_msg">{MSG_CHOOSE}</span>
        </div>
      )}
    </section>
  );
}
