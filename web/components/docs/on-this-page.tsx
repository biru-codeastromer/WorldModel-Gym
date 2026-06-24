"use client";

import { useEffect, useState } from "react";

import { cn } from "@/components/ui";
import type { AnchorItem } from "./types";

/**
 * Desktop-only "On this page" rail. Tracks the visible heading via an
 * IntersectionObserver and highlights the active anchor. Clicking scrolls to the
 * heading (native anchor behavior); the observer keeps the highlight in sync on
 * manual scroll. Reduced-motion users still get correct highlighting — only the
 * smooth scroll is skipped by the browser when they opt out.
 */
export function OnThisPage({ items }: { items: AnchorItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (items.length === 0) return;
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      // Bias the active band toward the top of the viewport.
      { rootMargin: "-96px 0px -65% 0px", threshold: [0, 1] }
    );

    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="On this page" className="flex flex-col gap-3">
      <p className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.18em] text-fg-subtle">
        On this page
      </p>
      <ul className="flex flex-col gap-1 border-l border-border">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "-ml-px block border-l-2 py-0.5 pl-3 font-mono text-[0.78rem] leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                  active
                    ? "border-accent font-medium text-accent"
                    : "border-transparent text-fg-subtle hover:text-fg"
                )}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
