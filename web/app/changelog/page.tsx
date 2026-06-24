import type { Metadata } from "next";

import { Reveal } from "@/components/motion";
import {
  Badge,
  type BadgeTone,
  Card,
  Section,
  SectionHeader,
  cn
} from "@/components/ui";
import { CHANGE_TONE, RELEASES, type ChangeKind } from "@/content/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Release notes for WorldModel Gym — production hardening, honest metrics, the scalable async tier, testing and supply-chain work, the API contract, and the editorial UI overhaul.",
  alternates: { canonical: "/changelog" }
};

const KIND_ORDER: ChangeKind[] = ["Added", "Changed", "Fixed", "Security"];

function toneFor(kind: ChangeKind): BadgeTone {
  return CHANGE_TONE[kind];
}

export default function ChangelogPage() {
  return (
    <Section>
      <SectionHeader
        kicker="Release notes"
        title="Changelog"
        as="h1"
        lede="How WorldModel Gym evolved — from the first benchmark cut to a hardened, scalable platform with an editorial dashboard. Newest releases first."
      />

      <Reveal group className="relative mt-12">
        {/* Continuous timeline spine, hidden on the narrowest screens. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[7px] top-2 bottom-2 hidden w-px bg-border sm:block"
        />

        <div className="flex flex-col gap-8">
          {RELEASES.map((release) => {
            const groups = release.groups
              .slice()
              .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));

            return (
              <Reveal key={release.version} className="relative sm:pl-12">
                {/* Timeline node. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-0 top-2 hidden h-[15px] w-[15px] items-center justify-center rounded-full border-2 border-bg sm:flex",
                    release.highlight ? "bg-accent" : "bg-border-strong"
                  )}
                />

                <Card
                  elevation={release.highlight ? "raised" : "flat"}
                  padding="lg"
                  className={cn(release.highlight && "border-accent/40")}
                >
                  <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-baseline sm:justify-between">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                      <h2 className="font-mono text-lg font-semibold text-fg">
                        {release.version}
                      </h2>
                      {release.highlight ? (
                        <Badge tone="accent">Latest</Badge>
                      ) : null}
                      {release.version === "Unreleased" ? (
                        <Badge tone="neutral" variant="outline">
                          In progress
                        </Badge>
                      ) : null}
                    </div>
                    {release.date ? (
                      <time className="font-mono text-xs uppercase tracking-[0.14em] text-fg-subtle">
                        {release.date}
                      </time>
                    ) : null}
                  </header>

                  <div className="mt-5">
                    <p className="font-serif text-xl leading-snug text-fg">
                      {release.title}
                    </p>
                    <p className="mt-2 font-mono text-sm leading-7 text-fg-muted">
                      {release.summary}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-col gap-5">
                    {groups.map((group) => (
                      <div
                        key={group.kind}
                        className="grid gap-3 sm:grid-cols-[110px_1fr] sm:gap-5"
                      >
                        <div className="sm:pt-0.5">
                          <Badge tone={toneFor(group.kind)}>{group.kind}</Badge>
                        </div>
                        <ul className="flex flex-col gap-2">
                          {group.items.map((item) => (
                            <li
                              key={item}
                              className="flex gap-2.5 font-mono text-sm leading-6 text-fg-muted"
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "mt-[0.55rem] h-1 w-1 shrink-0 rounded-full",
                                  group.kind === "Added" && "bg-success",
                                  group.kind === "Changed" && "bg-accent",
                                  group.kind === "Fixed" && "bg-fg-subtle",
                                  group.kind === "Security" && "bg-warning"
                                )}
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </Reveal>
    </Section>
  );
}
