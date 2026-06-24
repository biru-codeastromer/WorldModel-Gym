import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Reveal } from "@/components/motion";
import { Badge, Card } from "@/components/ui";
import { getDocGroups } from "@/content/docs";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Learn WorldModel Gym: what it is, how to submit your first run, the benchmark concepts, the submission API, and deployment.",
  alternates: { canonical: "/docs" }
};

/** Docs landing page — an editorial index of every section, grouped. */
export default function DocsIndexPage() {
  const groups = getDocGroups();

  return (
    <div className="max-w-3xl">
      <header className="mb-10">
        <p className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-accent">
          Documentation
        </p>
        <h1 className="font-serif text-3xl leading-[1.1] tracking-[-0.01em] text-fg md:text-4xl">
          WorldModel Gym docs
        </h1>
        <p className="mt-3 font-mono text-sm leading-7 text-fg-muted">
          Everything to evaluate long-horizon planning agents — from your first run to running the
          benchmark in production.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {groups.map(({ group, sections }) => (
          <section key={group}>
            <h2 className="mb-4 flex items-center gap-3 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-fg-subtle">
              {group}
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
            </h2>
            <Reveal group className="grid gap-3 sm:grid-cols-2">
              {sections.map((section) => (
                <Reveal key={section.slug}>
                  <Link
                    href={`/docs/${section.slug}`}
                    className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    <Card
                      elevation="flat"
                      className="group flex h-full flex-col gap-2 transition-colors hover:border-border-strong"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone="neutral" variant="outline">
                          {section.kicker}
                        </Badge>
                        <ArrowRight
                          className="h-4 w-4 text-fg-subtle transition-colors group-hover:text-accent"
                          aria-hidden="true"
                        />
                      </div>
                      <h3 className="font-serif text-lg text-fg">{section.title}</h3>
                      <p className="font-mono text-[0.82rem] leading-6 text-fg-muted">
                        {section.summary}
                      </p>
                    </Card>
                  </Link>
                </Reveal>
              ))}
            </Reveal>
          </section>
        ))}
      </div>
    </div>
  );
}
