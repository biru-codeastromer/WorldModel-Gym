import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";

type PagerLink = { slug: string; title: string };

/** Prev / next links between adjacent docs sections. */
export function DocPager({ prev, next }: { prev?: PagerLink; next?: PagerLink }) {
  if (!prev && !next) return null;
  return (
    <nav
      aria-label="Pagination"
      className="mt-14 grid gap-3 border-t border-border pt-8 sm:grid-cols-2"
    >
      {prev ? (
        <Link
          href={`/docs/${prev.slug}`}
          className="group flex flex-col gap-1 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <span className="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-fg-subtle">
            <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Previous
          </span>
          <span className="font-mono text-sm text-fg group-hover:text-accent">{prev.title}</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      {next ? (
        <Link
          href={`/docs/${next.slug}`}
          className="group flex flex-col items-end gap-1 rounded-lg border border-border bg-surface px-4 py-3 text-right transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <span className="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-fg-subtle">
            Next <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </span>
          <span className="font-mono text-sm text-fg group-hover:text-accent">{next.title}</span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}
