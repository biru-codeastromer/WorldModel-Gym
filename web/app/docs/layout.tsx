import type { Metadata } from "next";

import { MobileNav, SidebarNav, type SidebarGroup } from "@/components/docs";
import { getDocGroups } from "@/content/docs";

export const metadata: Metadata = {
  title: {
    default: "Docs",
    template: "%s | Docs | WorldModel Gym"
  },
  description:
    "Documentation for WorldModel Gym: overview, quickstart, concepts, the submission API, and deployment."
};

function toSidebarGroups(): SidebarGroup[] {
  return getDocGroups().map(({ group, sections }) => ({
    group,
    sections: sections.map((s) => ({ slug: s.slug, title: s.title }))
  }));
}

/**
 * Docs shell: a sticky left section-nav, a fluid content column, and (on the
 * page itself) an "On this page" rail. The sidebar collapses to a mobile drawer
 * via <MobileNav>. The content + on-this-page split lives inside each page so it
 * can be section-specific.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const groups = toSidebarGroups();
  // First section title is a sensible default label for the mobile trigger;
  // the page overrides nothing — the drawer always lists all sections.
  const firstTitle = groups[0]?.sections[0]?.title ?? "Documentation";

  return (
    <div className="mx-auto w-full max-w-[1320px] px-5 py-8 md:px-8 md:py-12 xl:px-10">
      <div className="mb-6 lg:hidden">
        <MobileNav groups={groups} currentTitle={firstTitle} />
      </div>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Desktop sticky sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[124px] max-h-[calc(100vh-148px)] overflow-y-auto pb-10 pr-2">
            <SidebarNav groups={groups} />
          </div>
        </aside>

        {/* Page content (article + on-this-page) */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
