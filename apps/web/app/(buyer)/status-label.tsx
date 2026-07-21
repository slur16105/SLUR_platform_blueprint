/* 상태 라벨 — 배지가 아니다. 면 없는 11.5px/800/.05em 글자에 색만 다르다.
   색과 텍스트를 항상 함께 쓴다 — 색만으로 상태를 전달하지 않는다 (UX-DR13, 접근성 바닥).
   액센트가 붙는 상태는 입금대기 하나뿐이다 — 구매자가 지금 무언가 해야 하는 유일한 상태이기 때문. */

export type StatusTone =
  | "waiting"   // 입금대기 — 액센트
  | "moving"    // 결제완료·배송준비·배송중 — 먹색
  | "finished"; // 배송완료·취소 — 흐린색

const TONE_CLASS: Record<StatusTone, string> = {
  waiting: "m_waiting",
  moving: "m_moving",
  finished: "m_finished",
};

export default function StatusLabel({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  /** 상태 문구. 색만으로 전달하지 않기 위해 항상 함께 온다. */
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={["b_status_label", TONE_CLASS[tone], className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
