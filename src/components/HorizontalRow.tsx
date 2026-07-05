"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontally scrolling card row with scroll-snap and chevron paging.
 * Children are the cards; each gets a fixed-width snap slot.
 */
export function HorizontalRow({ children }: { children: React.ReactNode[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateChevrons = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateChevrons();
    window.addEventListener("resize", updateChevrons);
    return () => window.removeEventListener("resize", updateChevrons);
  }, [updateChevrons]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth - 120), behavior: "smooth" });
  };

  return (
    <div className="group/row relative">
      <div
        ref={scroller}
        onScroll={updateChevrons}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1"
      >
        {children.map((child, i) => (
          <div key={i} className="w-[280px] shrink-0 snap-start sm:w-[300px]">
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
            visible ? "opacity-0 group-hover/row:opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}
