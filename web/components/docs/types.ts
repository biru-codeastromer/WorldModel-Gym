/**
 * Typed content model for the /docs site.
 *
 * Docs are authored as structured TSX-friendly data (not raw markdown) so every
 * section is type-checked, fully self-contained inside web/ (Vercel only deploys
 * web/), and renders through the design-system component map. This keeps the CSP
 * clean — no runtime markdown parsing, no inline scripts — while staying easy to
 * extend.
 */

import type { ReactNode } from "react";

/** Inline text run — plain string or a small set of styled spans. */
export type Inline =
  | string
  | { type: "code"; text: string }
  | { type: "strong"; text: string }
  | { type: "link"; text: string; href: string };

/** A paragraph of inline runs. */
export type ParagraphBlock = { kind: "paragraph"; content: Inline[] };

/** A sub-heading inside a section. Gets an anchor + appears in "On this page". */
export type HeadingBlock = { kind: "heading"; text: string; id: string };

/** A copy-able code block with a language label. */
export type CodeBlock = {
  kind: "code";
  language: string;
  /** Short human label shown in the block header (e.g. "bash", "json"). */
  label?: string;
  code: string;
};

/** An unordered / ordered list of inline runs. */
export type ListBlock = {
  kind: "list";
  ordered?: boolean;
  items: Inline[][];
};

/** A callout / admonition. */
export type CalloutBlock = {
  kind: "callout";
  tone: "info" | "success" | "warning";
  title?: string;
  content: Inline[];
};

/** A simple reference table. */
export type TableBlock = {
  kind: "table";
  head: string[];
  rows: Inline[][][];
};

/** An arbitrary design-system node (escape hatch for richer visuals). */
export type CustomBlock = { kind: "custom"; node: ReactNode };

export type DocBlock =
  | ParagraphBlock
  | HeadingBlock
  | CodeBlock
  | ListBlock
  | CalloutBlock
  | TableBlock
  | CustomBlock;

/** A top-level docs section, addressable at /docs/<slug>. */
export type DocSection = {
  slug: string;
  /** Sidebar + page title. */
  title: string;
  /** Mono kicker shown above the title. */
  kicker: string;
  /** One-line lede under the title and used for metadata description. */
  summary: string;
  /** Grouping label for the sidebar (e.g. "Get started", "Reference"). */
  group: string;
  blocks: DocBlock[];
};

/** A heading extracted for the "On this page" rail. */
export type AnchorItem = { id: string; text: string };
