"use client";

/* 메인 히어로 스와이퍼 — 가운데 슬라이드 + 양옆 미리보기(peek) **무한 루프** 캐러셀.
   외부 라이브러리 없이 구현한다(swiper 패키지 추가 0).
   컨트롤은 하단 진행 바(인디케이터)뿐이다 — 화살표·장수 카운터는 두지 않는다(오너 지시 2026-07-30).
   이동 수단은 인디케이터 · 양옆 슬라이드 클릭 · 마우스 드래그 / 터치 스와이프 · 자동 넘김(5s)이다.

   ── 레이아웃 수식 (양옆이 가운데의 '절반'만 보이도록) ──
   트랙 폭 = 컨테이너 폭(100%)이고 각 슬라이드는 basis 50%(=컨테이너의 절반)다.
   슬라이드 i 구간은 [i·50%, (i+1)·50%]이므로 translateX = 25% − i·50% 이면 i번이 가운데 온다.
   좌우에 25%씩 남고, 이는 가운데 폭(50%)의 정확히 절반이다. 슬라이드 사이 여백은 없다(완전 밀착).

   ── 무한 루프 ──
   슬라이드를 3벌 복제해 [원본][원본][원본]으로 깔고 **가운데 벌**에서 시작한다.
   위치(pos)는 경계를 넘어도 그대로 전진/후진시켜 되감기 없이 이어지게 하고,
   전환이 끝난 뒤 **애니메이션을 끈 채** 한 벌(n)만큼 조용히 되돌려 놓는다(사용자는 눈치채지 못한다).
   🚨 이 스냅을 transition 중에 하면 화면이 튄다 — 전환 시간(700ms) 뒤에 실행하고,
      다시 그리기 두 프레임 뒤에 transition을 되켠다. */

import { useCallback, useEffect, useRef, useState } from "react";

export type HeroSlide = {
  image: string;
  eyebrow: string | null;
  title: string;
  lead: string | null;
};

const DURATION = 700;

export default function HeroSwiper({ slides }: { slides: HeroSlide[] }) {
  const n = slides.length;
  const loop = n > 1 ? [...slides, ...slides, ...slides] : slides;

  /* 가운데 벌의 첫 장에서 시작 */
  const [pos, setPos] = useState(n > 1 ? n : 0);
  const [anim, setAnim] = useState(true);
  const [paused, setPaused] = useState(false);

  /* 드래그(마우스·터치 공통) — 포인터 이벤트 하나로 처리한다.
     dragX는 손이 끌고 온 거리(px)이며 트랙 transform에 그대로 더해 화면이 손을 따라오게 한다.
     moved는 "끌었는가"를 기억해 드래그 끝의 click이 옆 슬라이드 이동으로 오인되는 것을 막는다. */
  const [dragX, setDragX] = useState(0);
  /* 렌더에 쓰는 값은 state로 둔다(커서·전환 on/off). ref는 핸들러 안에서만 읽는다 —
     렌더 중 ref를 읽으면 갱신이 어긋날 수 있어 규칙으로 금지돼 있다. */
  const [isDragging, setIsDragging] = useState(false);
  /* 이동(전환)이 진행 중인지. 이게 켜져 있는 동안 새 이동 요청을 받지 않는다 — 아래 go() 참조. */
  const [moving, setMoving] = useState(false);
  const dragging = useRef(false);
  const moved = useRef(false);
  const startX = useRef(0);
  const DRAG_THRESHOLD = 60; // 이만큼 끌면 다음/이전으로 넘긴다

  const active = n > 0 ? ((pos % n) + n) % n : 0;

  /* 🚨 이동은 한 번에 하나만 받는다.
     복제본은 3벌(3n장)뿐이라 전환이 끝나기 전에 이동 요청이 쌓이면 pos가 배열 밖으로 나가고,
     그 자리엔 그릴 슬라이드가 없어 화면이 하얗게 빈다(빠르게 여러 번 넘겼을 때의 증상).
     전환 중 요청을 무시하면 pos는 항상 [n-1, 3n-2] 안에 머물러 어떤 속도로 조작해도 안전하다. */
  const go = useCallback(
    (delta: number) => {
      if (delta === 0 || moving) return;
      setMoving(true);
      setPos((p) => p + delta);
    },
    [moving],
  );
  /* 인디케이터 — 목표 슬라이드까지 앞으로 도는 거리만큼 이동한다(뒤로 감지 않는다).
     이동 거리는 최대 n-1이라 pos는 3n-2를 넘지 않는다(배열 범위 안). 잠금 규칙은 go와 공유. */
  const goTo = useCallback(
    (i: number) => {
      if (moving) return;
      const delta = (((i - active) % n) + n) % n;
      if (delta === 0) return;
      setMoving(true);
      setPos((p) => p + delta);
    },
    [moving, active, n],
  );

  /* 자동 넘김 */
  useEffect(() => {
    if (paused || n <= 1) return;
    const t = setInterval(() => go(1), 5000);
    return () => clearInterval(t);
  }, [paused, n, go]);

  /* 전환이 끝나면 잠금을 풀고, 경계를 넘었으면 그 순간 조용히 한 벌 되돌린다 */
  useEffect(() => {
    if (!moving) return;
    const t = setTimeout(() => {
      setMoving(false);
      if (n > 1 && (pos >= 2 * n || pos < n)) {
        setAnim(false);
        setPos((p) => (p >= 2 * n ? p - n : p + n));
      }
    }, DURATION);
    return () => clearTimeout(t);
  }, [moving, pos, n]);

  /* 스냅을 그린 뒤 transition 복구 (두 프레임 대기 — 한 프레임이면 전환이 되살아나 튄다) */
  useEffect(() => {
    if (anim) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setAnim(true)));
    return () => cancelAnimationFrame(r);
  }, [anim]);

  if (n === 0) return null;
  const cur = slides[active];

  return (
    <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div
        className="relative h-[380px] w-full touch-pan-y select-none overflow-hidden bg-muted md:h-[600px]"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return; // 좌클릭만
          dragging.current = true;
          setIsDragging(true);
          moved.current = false;
          startX.current = e.clientX;
          e.currentTarget.setPointerCapture?.(e.pointerId); // 포인터가 밖으로 나가도 계속 추적
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          const dx = e.clientX - startX.current;
          if (Math.abs(dx) > 5) moved.current = true;
          setDragX(dx);
        }}
        onPointerUp={(e) => {
          if (!dragging.current) return;
          dragging.current = false;
          setIsDragging(false);
          const dx = e.clientX - startX.current;
          setDragX(0);
          if (Math.abs(dx) > DRAG_THRESHOLD) go(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          dragging.current = false;
          setIsDragging(false);
          setDragX(0);
        }}
      >
        <div
          /* 드래그 중에는 전환을 끈다 — 손을 즉시 따라와야 하기 때문. 놓으면 다시 부드럽게 이동한다. */
          className={`flex h-full w-full ${
            anim && !isDragging ? "transition-transform duration-700 ease-out" : ""
          } ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{ transform: `translateX(calc(25% - ${pos * 50}% + ${dragX}px))` }}
        >
          {loop.map((s, i) => {
            const isActive = i === pos;
            return (
              <button
                key={i}
                type="button"
                tabIndex={isActive ? -1 : 0}
                aria-label={isActive ? undefined : "다른 슬라이드로 이동"}
                aria-hidden={isActive}
                /* 드래그로 끝난 포인터의 click은 무시한다 — 끌어서 넘긴 뒤 엉뚱한 슬라이드로 튀지 않게. */
                onClick={() => {
                  if (moved.current) return;
                  if (!isActive) go(i - pos);
                }}
                className={`relative h-full flex-none basis-1/2 overflow-hidden ${
                  isActive ? "cursor-default" : "cursor-pointer"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.image}
                  alt=""
                  draggable={false} /* 브라우저 기본 이미지 끌기(고스트 이미지)를 막는다 */
                  className="h-full w-full object-cover"
                />
                {/* 검은 딤 — 가운데가 아닌 슬라이드를 어둡게 눌러 주인공을 분리한다.
                    🚨 무한 루프 스냅(anim=false) 중에는 **전환을 끈다**. 스냅 순간에는 활성 슬라이드가
                       다른 DOM 노드로 옮겨가는데(2n번 → n번), 전환이 살아 있으면 옛 노드는 어두워지고
                       새 노드는 밝아지는 페이드가 동시에 보여 한 번 깜빡인다. */}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 bg-black ${
                    anim ? "transition-opacity duration-500" : ""
                  } ${isActive ? "opacity-0" : "opacity-60 hover:opacity-40"}`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* 검은 캡션 바 — 슬라이드에 따라 문구가 바뀐다 (이미지 위에 얹지 않는다) */}
      <div className="bg-foreground py-7 text-background">
        <div className="mx-auto max-w-[1600px] px-5">
          {cur.eyebrow ? <p className="text-[13px] tracking-[0.2em] text-accent">{cur.eyebrow}</p> : null}
          <p className="mt-2 text-[30px] font-semibold leading-tight md:text-[38px]">{cur.title}</p>
          {cur.lead ? <p className="mt-2.5 text-[15px] opacity-70">{cur.lead}</p> : null}

          {n > 1 ? (
            <div className="mt-4 flex gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`${i + 1}번 슬라이드`}
                  aria-current={i === active ? "true" : undefined}
                  className={`h-0.5 transition-all ${i === active ? "w-8 bg-accent" : "w-4 bg-background/40"}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
