"use client";

import { useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type CountUpProps = {
  /** Target value. */
  value: number;
  /** Decimal places to render. Default 0. */
  decimals?: number;
  /** Animation duration in ms. Default 900. */
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

/**
 * Animated number count-up that runs once when scrolled into view. Respects
 * prefers-reduced-motion (renders the final value instantly). Designed to wrap
 * a Stat value or any numeric display.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 900,
  prefix = "",
  suffix = "",
  className
}: CountUpProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
