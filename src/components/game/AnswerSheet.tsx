"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const SHEET_QUERY = "(max-width: 900px) and (orientation: portrait)";

function rubberband(overshoot: number) {
  const dimension = 140;
  const constant = 0.55;
  const distance = Math.abs(overshoot);
  return Math.sign(overshoot) * ((distance * dimension * constant) / (dimension + constant * distance));
}

function project(velocity: number) {
  const deceleration = 0.995;
  return (velocity / 1000) * deceleration / (1 - deceleration);
}

function readOffset(panel: HTMLElement) {
  const transform = getComputedStyle(panel).transform;
  if (!transform || transform === "none") return 0;
  return new DOMMatrix(transform).m42;
}

export function AnswerSheet({ children, openToken }: { children: ReactNode; openToken: number }) {
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    origin: number;
    lastY: number;
    lastTime: number;
    velocity: number;
    moved: boolean;
  } | null>(null);
  const frameRef = useRef<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [token, setToken] = useState(openToken);
  const [expanded, setExpanded] = useState(openToken > 0);
  const velocityRef = useRef(0);
  if (token !== openToken) {
    setToken(openToken);
    setExpanded(openToken > 0);
  }

  const closedOffset = () => {
    const panel = panelRef.current;
    if (!panel) return 0;
    const peek = Number.parseFloat(getComputedStyle(panel).getPropertyValue("--peek")) || 214;
    return Math.max(panel.offsetHeight - peek, 0);
  };

  const settle = (open: boolean, velocity = 0) => {
    velocityRef.current = velocity;
    setExpanded(open);
  };

  useLayoutEffect(() => {
    const query = window.matchMedia(SHEET_QUERY);
    const update = () => setSheet(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !sheet) return;
    const measure = () => {
      const anchor = panel.querySelector<HTMLElement>(".sheet-anchor");
      const limit = panel.parentElement?.clientHeight ?? panel.offsetHeight;
      const bottom = anchor ? anchor.offsetTop + anchor.offsetHeight + 18 : 214;
      const peek = Math.round(Math.min(Math.max(bottom, 168), limit * 0.42));
      panel.style.setProperty("--peek", `${peek}px`);
      if (!expanded && !dragRef.current && frameRef.current == null) {
        panel.style.transform = `translateY(${Math.max(panel.offsetHeight - peek, 0)}px)`;
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [sheet, expanded, children]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (!sheet) {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      panel.style.transform = "";
      return;
    }
    const target = expanded ? 0 : Math.max(panel.offsetHeight - (Number.parseFloat(getComputedStyle(panel).getPropertyValue("--peek")) || 214), 0);
    const velocity = velocityRef.current;
    velocityRef.current = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      panel.style.transform = `translateY(${target}px)`;
      return;
    }
    let value = readOffset(panel);
    let speed = velocity;
    let previous = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - previous) / 1000);
      previous = now;
      const force = -340 * (value - target) - 32 * speed;
      speed += force * dt;
      value += speed * dt;
      panel.style.transform = `translateY(${value}px)`;
      if (Math.abs(speed) < 12 && Math.abs(value - target) < 0.6) {
        panel.style.transform = `translateY(${target}px)`;
        frameRef.current = null;
        return;
      }
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [sheet, expanded]);

  useEffect(() => () => {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!sheet || !panelRef.current) return;
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      origin: readOffset(panelRef.current),
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel || event.pointerId !== drag.pointerId) return;
    const delta = event.clientY - drag.startY;
    if (Math.abs(delta) > 4) drag.moved = true;
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = ((event.clientY - drag.lastY) / elapsed) * 1000;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    const max = closedOffset();
    let next = drag.origin + delta;
    if (next < 0) next = rubberband(next);
    if (next > max) next = max + rubberband(next - max);
    panel.style.transform = `translateY(${next}px)`;
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) {
      settle(!expanded);
      return;
    }
    const current = panelRef.current ? readOffset(panelRef.current) : 0;
    const projected = current + project(drag.velocity);
    settle(projected < closedOffset() / 2, drag.velocity);
  };

  return (
    <aside
      ref={panelRef}
      className={`answer-panel${sheet ? " answer-panel--sheet" : ""}${expanded ? " is-expanded" : ""}`}
    >
      <button
        className="sheet-grab"
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "Lower the answer panel" : "Raise the answer panel"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <i />
      </button>
      {children}
    </aside>
  );
}
