"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Autoscroll pace in px/s — slow enough to read headlines as they drift by. */
const MARQUEE_SPEED = 30;

/**
 * Horizontally scrolling card row. When the cards overflow the viewport the
 * row autoscrolls in an endless loop (cards are rendered twice and the scroll
 * position wraps seamlessly at the halfway point). Hovering, touching, or
 * focusing the row pauses it; chevrons and manual scrolling still work.
 */
export function HorizontalRow({ children }: { children: React.ReactNode[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  // Marquee position as a float. scrollLeft snaps to whole pixels on read-back,
  // so sub-pixel per-frame increments (30px/s ≈ 0.5px/frame) would otherwise be
  // lost — or double up — depending on refresh rate and rounding.
  const pos = useRef(0);
  const [loop, setLoop] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateChevrons = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  /** Distance between the first card and its clone — one full lap. */
  const period = useCallback(() => {
    const el = scroller.current;
    const first = el?.children[0] as HTMLElement | undefined;
    const clone = el?.children[children.length] as HTMLElement | undefined;
    return first && clone ? clone.offsetLeft - first.offsetLeft : 0;
  }, [children.length]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => {
      const setWidth = period() || el.scrollWidth;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setLoop(!reduceMotion && setWidth > el.clientWidth + 1);
      updateChevrons();
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [period, updateChevrons]);

  useEffect(() => {
    if (!loop) return;
    const el = scroller.current;
    if (!el) return;
    let raf: number;
    let last: number | null = null;
    const tick = (now: number) => {
      const dt = last === null ? 0 : Math.min(now - last, 100);
      last = now;
      // Wrapping while paused would yank a chevron/manual scroll mid-flight,
      // so both the advance and the wrap wait for the pointer to leave.
      if (!paused.current) {
        // If the user scrolled (wheel, drag, chevron), adopt their position.
        if (Math.abs(el.scrollLeft - pos.current) > 1) pos.current = el.scrollLeft;
        pos.current += (MARQUEE_SPEED * dt) / 1000;
        const lap = period();
        if (lap > 0 && pos.current >= lap) pos.current -= lap;
        el.scrollLeft = pos.current;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop, period]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const amount = el.clientWidth - 120;
    // Near the start of a loop there is no room to page left, but the clone
    // set one lap ahead shows identical content — jump there invisibly first.
    if (loop && dir === -1 && el.scrollLeft < amount) el.scrollLeft += period();
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  const pause = () => {
    paused.current = true;
  };
  const resume = () => {
    paused.current = false;
  };

  return (
    <div
      className="group/row relative"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
      onTouchCancel={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
    >
      <div
        ref={scroller}
        onScroll={updateChevrons}
        className={cn(
          "no-scrollbar flex gap-4 overflow-x-auto pb-1",
          !loop && "snap-x snap-mandatory",
        )}
      >
        {(loop ? [...children, ...children] : children).map((child, i) => (
          <div
            key={i}
            className={cn("w-[280px] shrink-0 sm:w-[300px]", !loop && "snap-start")}
          >
            {child}
          </div>
        ))}
      </div>
      {([
        [canLeft, -1, ChevronLeft, "left-0 -translate-x-1/3", "Scroll left"],
        [canRight, 1, ChevronRight, "right-0 translate-x-1/3", "Scroll right"],
      ] as const).map(([visible, dir, Icon, pos, label]) => (
        <button
          key={dir}
          onClick={() => page(dir)}
          aria-label={label}
          className={cn(
            "absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border-strong bg-card text-muted shadow-md transition-opacity hover:text-foreground sm:grid",
            pos,
            loop || visible
              ? "opacity-0 group-hover/row:opacity-100"
              : "pointer-events-none opacity-0",
          )}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}
