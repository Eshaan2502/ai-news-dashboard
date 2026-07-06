"use client";

import { useEffect, useState } from "react";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
};

/**
 * Renders the masthead date. The server passes its own rendered date as the
 * initial value (so the strip is never blank and still works without JS), then
 * we recompute on mount so the date reflects the reader's device local time
 * rather than the server's timezone.
 */
export function MastheadDate({ initial }: { initial: string }) {
  const [today, setToday] = useState(initial);

  useEffect(() => {
    setToday(new Date().toLocaleDateString(undefined, DATE_FORMAT));
  }, []);

  return <span suppressHydrationWarning>{today}</span>;
}
