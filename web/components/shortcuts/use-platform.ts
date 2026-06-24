"use client";

import { useEffect, useState } from "react";

/**
 * Client-only Apple-platform detection.
 *
 * We intentionally default to `false` (assume non-mac) for the very first
 * render so the server HTML and the initial client render agree — detecting the
 * platform during render would read `navigator`, which is undefined on the
 * server and would trip a hydration mismatch. The real value lands in a layout
 * effect right after mount, before paint, so the user never sees the wrong key
 * symbol flash.
 */
export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const platform =
      // `userAgentData` is the modern source; fall back to the legacy fields.
      (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent ||
      "";
    setIsMac(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);

  return isMac;
}
