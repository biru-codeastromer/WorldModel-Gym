import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocArticle, DocPager, OnThisPage } from "@/components/docs";
import {
  DOCS_SECTIONS,
  DOC_SLUGS,
  getDocSection,
  getSectionAnchors
} from "@/content/docs";

type PageParams = { params: { slug: string } };

/** Pre-render every docs section. */
export function generateStaticParams() {
  return DOC_SLUGS.map((slug) => ({ slug }));
}

export function generateMetadata({ params }: PageParams): Metadata {
  const section = getDocSection(params.slug);
  if (!section) {
    return { title: "Not found" };
  }
  return {
    title: section.title,
    description: section.summary,
    alternates: { canonical: `/docs/${section.slug}` },
    openGraph: {
      title: `${section.title} | Docs`,
      description: section.summary,
      url: `/docs/${section.slug}`,
      type: "article"
    }
  };
}

export default function DocSectionPage({ params }: PageParams) {
  const section = getDocSection(params.slug);
  if (!section) {
    notFound();
  }

  const anchors = getSectionAnchors(section);
  const index = DOCS_SECTIONS.findIndex((s) => s.slug === section.slug);
  const prev = index > 0 ? DOCS_SECTIONS[index - 1] : undefined;
  const next =
    index < DOCS_SECTIONS.length - 1 ? DOCS_SECTIONS[index + 1] : undefined;

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-10">
      <div className="min-w-0">
        <DocArticle section={section} />
        <DocPager
          prev={prev ? { slug: prev.slug, title: prev.title } : undefined}
          next={next ? { slug: next.slug, title: next.title } : undefined}
        />
      </div>

      {/* On-this-page rail — desktop-wide only */}
      <aside className="hidden xl:block">
        <div className="sticky top-[124px] max-h-[calc(100vh-148px)] overflow-y-auto pb-10">
          <OnThisPage items={anchors} />
        </div>
      </aside>
    </div>
  );
}
