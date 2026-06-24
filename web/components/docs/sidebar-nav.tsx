"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui";

export type SidebarGroup = {
  group: string;
  sections: { slug: string; title: string }[];
};

/**
 * Docs section navigation with active-section highlighting derived from the
 * current pathname. Shared between the desktop sticky sidebar and the mobile
 * drawer; `onNavigate` lets the drawer close itself on selection.
 */
export function SidebarNav({
  groups,
  onNavigate
}: {
  groups: SidebarGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation sections" className="flex flex-col gap-7">
      {groups.map(({ group, sections }) => (
        <div key={group}>
          <p className="mb-2.5 px-3 font-mono text-[0.62rem] font-medium uppercase tracking-[0.18em] text-fg-subtle">
            {group}
          </p>
          <ul className="flex flex-col gap-0.5">
            {sections.map((section) => {
              const href = `/docs/${section.slug}`;
              const active = pathname === href;
              return (
                <li key={section.slug}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-1.5 font-mono text-[0.82rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                      active
                        ? "bg-accent-soft font-medium text-accent"
                        : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                    )}
                  >
                    {section.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
