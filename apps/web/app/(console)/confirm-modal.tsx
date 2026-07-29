"use client";

/* 공통 확인 모달 — 되돌릴 수 없는/파괴적 액션 전에 세운다.
   브라우저 window.confirm 경고창 대체. 시각 어휘는 slur modal_dialog(components/modal.css)만 쓴다.
   ESC · 배경 클릭 · 취소로 닫고, 확인 버튼은 submitting 동안 잠근다.
   데이터/처리 로직은 갖지 않는다 — onConfirm/onCancel로 부모가 소유. */

import type { ReactNode } from "react";
import { useEffect } from "react";

import "./confirm-modal.css";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
  submitting = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  submitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // ESC로 닫기 — submitting 중엔 무시(처리 도중 이탈 방지).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !submitting) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal_dialog m_confirm"
      data-state="open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm_modal_title"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onCancel(); }}
    >
      <div className="i_wrap">
        <div className="i_head">
          <h2 className="i_title" id="confirm_modal_title">{title}</h2>
          <button className="i_close" type="button" aria-label="닫기" disabled={submitting} onClick={onCancel}>✕</button>
        </div>
        <div className="i_body">
          <p className="i_text">{message}</p>
        </div>
        <div className="i_foot">
          <button className="btn m_ghost" type="button" disabled={submitting} onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`btn ${danger ? "m_danger" : "m_primary"}`}
            type="button"
            data-state={submitting ? "loading" : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
