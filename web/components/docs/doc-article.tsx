import { Block } from "./blocks";
import type { DocSection } from "./types";

/**
 * Renders a docs section's editorial header and its block content. Kept as a
 * server component (no client hooks) so the article is fully static and
 * pre-rendered; interactive bits (CodeBlock copy) are their own "use client"
 * islands.
 */
export function DocArticle({ section }: { section: DocSection }) {
  return (
    <article className="min-w-0 max-w-2xl">
      <header className="mb-2">
        <p className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-accent">
          {section.kicker}
        </p>
        <h1 className="font-serif text-3xl leading-[1.1] tracking-[-0.01em] text-fg md:text-4xl">
          {section.title}
        </h1>
        <p className="mt-3 font-mono text-sm leading-7 text-fg-muted">{section.summary}</p>
      </header>

      <div className="mt-4">
        {section.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </article>
  );
}
