"use client";

/* 우편번호 검색 오버레이 — 이 제품의 유일한 모달 예외다 (UX-DR16, D1).

   다음(카카오) 우편번호 서비스 v2를 **클릭 시점에 동적 로드해 우리 오버레이 안에 embed**한다.
   🚨 .open()(팝업)을 쓰지 않는다 — 모바일 브라우저 팝업 차단에 걸리고, 뜨더라도
      <768 전체 화면 / ≥768 가운데 모달이라는 우리 규격을 따르지 않는다.
   🚨 새 npm 의존성을 만들지 않는다 (react-daum-postcode 같은 래퍼 금지) — package.json diff 0건.
   🚨 스크립트가 죽거나 차단되면 오버레이 안에 안내 + `다시 시도`가 뜨고,
      **우편번호·주소 필드는 언제나 직접 입력할 수 있다.** 검색이 유일한 입력 수단이면
      제3자 스크립트 장애가 곧 청약 정지다 (위험 5).

   부채로 남기는 사실 셋 (D1):
   - 현재 이 앱에 CSP 헤더가 없어 지금은 막히지 않는다. CSP를 도입하면
     script-src https://t1.daumcdn.net, frame-src·img-src·connect-src *.daumcdn.net·*.daum.net이 필요하다.
   - PWA(8.7)의 서비스워커는 이 스크립트를 캐시하지 않는다 — 오프라인에서 검색은 되지 않는다.
   - 개인정보처리방침의 제3자 스크립트 고지 검토 대상이다(오픈 게이트). */

import { useCallback, useEffect, useRef, useState } from "react";

const SCRIPT_SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
const LOAD_TIMEOUT_MS = 8000;

/** 위젯이 oncomplete로 돌려주는 값 중 우리가 쓰는 넷. any를 쓰지 않는다(lint 베이스라인 0 warnings). */
type DaumPostcodeData = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  /** 사용자가 고른 주소 종류 — "R"이면 도로명, "J"면 지번 */
  userSelectedType: "R" | "J";
};

type DaumPostcodeOptions = {
  oncomplete: (data: DaumPostcodeData) => void;
  onresize?: (size: { width: number; height: number }) => void;
  width?: string;
  height?: string;
};

type DaumPostcodeInstance = { embed: (el: HTMLElement, options?: { autoClose?: boolean }) => void };

declare global {
  interface Window {
    daum?: { Postcode: new (options: DaumPostcodeOptions) => DaumPostcodeInstance };
  }
}

/* 모듈 스코프 Promise 하나로 캐시한다 — 오버레이를 두 번 열어도 스크립트는 한 번만 받는다.
   실패하면 캐시를 비워 `다시 시도`가 실제로 다시 시도하게 한다. */
let scriptPromise: Promise<void> | null = null;

function loadPostcodeScript(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SCRIPT_SRC;
    el.async = true;
    const timer = window.setTimeout(() => {
      el.remove();
      reject(new Error("timeout"));
    }, LOAD_TIMEOUT_MS);
    el.onload = () => {
      window.clearTimeout(timer);
      if (window.daum?.Postcode) resolve();
      else reject(new Error("missing"));
    };
    el.onerror = () => {
      window.clearTimeout(timer);
      el.remove();
      reject(new Error("network"));
    };
    document.head.appendChild(el);
  }).catch((e) => {
    scriptPromise = null;
    throw e;
  });

  return scriptPromise;
}

/** 포커스를 오버레이 안에 가둔다 — 뒤 본문의 입력으로 Tab이 새어 나가지 않게 (AC 4). */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

export type PostcodeResult = { postalCode: string; address1: string };

export default function PostcodeOverlay({
  onSelect,
  onClose,
}: {
  onSelect: (r: PostcodeResult) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const embedRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  /* onSelect가 매 렌더 새 함수여도 위젯을 다시 심지 않도록 ref에 담는다 —
     embed는 부작용이 큰 조작이라 의존성 배열에 콜백을 넣으면 안 된다. */
  const selectRef = useRef(onSelect);
  // 🚨 렌더 중에 ref를 쓰지 않는다(react-hooks/refs가 error다) — effect에서 최신 값으로 맞춘다.
  //    선언 순서가 아래 embed effect보다 먼저여야 첫 embed도 최신 콜백을 잡는다.
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  /* 스크립트 로드 + embed.
     🚨 effect 본문에서 동기 setState를 하지 않는다 — 상태 갱신은 전부 await 이후의
        비동기 연속에서만 일어난다 (react-hooks/set-state-in-effect가 error다). */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await loadPostcodeScript();
      } catch {
        if (alive) setStatus("error");
        return;
      }
      const host = embedRef.current;
      if (!alive || !host || !window.daum?.Postcode) {
        if (alive) setStatus("error");
        return;
      }
      try {
        new window.daum.Postcode({
          width: "100%",
          height: "100%",
          oncomplete: (data) => {
            selectRef.current({
              postalCode: data.zonecode,
              // 사용자가 고른 쪽을 그대로 쓴다 — 도로명을 강제하면 지번만 있는 주소가 빈다
              address1: data.userSelectedType === "R" ? data.roadAddress : data.jibunAddress,
            });
          },
        }).embed(host, { autoClose: true });
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  /* 열려 있는 동안 뒤 본문이 스크롤되지 않는다. DOM 조작이므로 effect에서 해도 무방하다. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* 열리면 포커스가 안으로 들어간다. 닫을 때의 복원은 부모가 한다 —
     원래 버튼을 아는 것은 부모이고, 오버레이가 사라진 뒤에 일어나야 하는 일이기 때문이다. */
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  return (
    <div
      className="b_overlay"
      role="dialog"
      aria-modal="true"
      aria-label="우편번호 검색"
      onKeyDown={onKeyDown}
    >
      <div className="i_panel" ref={panelRef}>
        <div className="i_head">
          <span className="b_topbar_title">우편번호 검색</span>
          <button type="button" className="i_close" ref={closeRef} onClick={onClose} aria-label="우편번호 검색 닫기">
            ×
          </button>
        </div>

        <div className="i_body">
          {status === "error" ? (
            /* 🚨 이 자리에서도 우편번호·주소는 직접 입력할 수 있다는 사실을 말한다 —
               사용자가 오버레이를 닫고 무엇을 하면 되는지 알아야 완주한다. */
            <div className="i_fallback" role="status">
              <p className="b_body">우편번호 검색을 불러오지 못했습니다. 우편번호를 직접 입력해 주세요.</p>
              <div className="i_acts">
                <button
                  type="button"
                  className="b_btn m_ghost b_control"
                  onClick={() => setAttempt((n) => n + 1)}
                >
                  다시 시도
                </button>
                <button type="button" className="b_btn m_ghost b_control" onClick={onClose}>
                  닫기
                </button>
              </div>
            </div>
          ) : (
            /* 로딩 중에도 같은 상자를 둔다 — 위젯이 붙을 자리가 나중에 생기면 embed가 실패한다 */
            <div className="i_embed" ref={embedRef} />
          )}
        </div>
      </div>
    </div>
  );
}
