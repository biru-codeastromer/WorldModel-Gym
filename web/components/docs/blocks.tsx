import { Info, Link as LinkIcon, Lightbulb, TriangleAlert } from "lucide-react";

import { Badge, cn } from "@/components/ui";

import { CodeBlock } from "./code-block";
import type { CalloutBlock, DocBlock, Inline } from "./types";

/** Render an inline run (string or styled span) inside flowing text. */
function renderInline(node: Inline, key: number) {
  if (typeof node === "string") return <span key={key}>{node}</span>;
  if (node.type === "code") {
    return (
      <code
        key={key}
        className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[0.82em] text-fg"
      >
        {node.text}
      </code>
    );
  }
  if (node.type === "strong") {
    return (
      <strong key={key} className="font-semibold text-fg">
        {node.text}
      </strong>
    );
  }
  // link
  const external = /^https?:\/\//.test(node.href);
  return (
    <a
      key={key}
      href={node.href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className="font-medium text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      {node.text}
    </a>
  );
}

function Inlines({ content }: { content: Inline[] }) {
  return <>{content.map((n, i) => renderInline(n, i))}</>;
}

const calloutMeta: Record<
  CalloutBlock["tone"],
  { Icon: typeof Info; ring: string; tint: string; iconColor: string }
> = {
  info: {
    Icon: Info,
    ring: "border-accent/30",
    tint: "bg-accent-soft/40",
    iconColor: "text-accent"
  },
  success: {
    Icon: Lightbulb,
    ring: "border-success/30",
    tint: "bg-success-soft/40",
    iconColor: "text-success"
  },
  warning: {
    Icon: TriangleAlert,
    ring: "border-warning/30",
    tint: "bg-warning-soft/40",
    iconColor: "text-warning"
  }
};

/** Render a single doc block via the branded component map. */
export function Block({ block }: { block: DocBlock }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <p className="my-4 font-mono text-[0.92rem] leading-7 text-fg-muted">
          <Inlines content={block.content} />
        </p>
      );

    case "heading":
      return (
        <h2
          id={block.id}
          className="group/anchor mt-12 scroll-mt-32 font-serif text-2xl tracking-[-0.01em] text-fg"
        >
          <a
            href={`#${block.id}`}
            className="inline-flex items-center gap-2 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            aria-label={`Link to "${block.text}"`}
          >
            {block.text}
            <LinkIcon
              className="h-4 w-4 text-fg-subtle opacity-0 transition-opacity group-hover/anchor:opacity-100"
              aria-hidden="true"
            />
          </a>
        </h2>
      );

    case "code":
      return <CodeBlock code={block.code} language={block.language} label={block.label} />;

    case "list":
      return block.ordered ? (
        <ol className="my-4 list-decimal space-y-2 pl-6 font-mono text-[0.92rem] leading-7 text-fg-muted marker:text-fg-subtle">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines content={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="my-4 list-disc space-y-2 pl-6 font-mono text-[0.92rem] leading-7 text-fg-muted marker:text-fg-subtle">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines content={item} />
            </li>
          ))}
        </ul>
      );

    case "callout": {
      const meta = calloutMeta[block.tone];
      const { Icon } = meta;
      return (
        <div
          role="note"
          className={cn(
            "my-6 flex gap-3 rounded-lg border px-4 py-3.5",
            meta.ring,
            meta.tint
          )}
        >
          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.iconColor)} aria-hidden="true" />
          <div>
            {block.title ? (
              <p className="mb-1 font-mono text-[0.7rem] font-medium uppercase tracking-[0.14em] text-fg">
                {block.title}
              </p>
            ) : null}
            <p className="font-mono text-[0.86rem] leading-6 text-fg-muted">
              <Inlines content={block.content} />
            </p>
          </div>
        </div>
      );
    }

    case "table":
      return (
        <div className="my-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                {block.head.map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 font-mono text-[0.66rem] font-medium uppercase tracking-[0.12em] text-fg-subtle"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border last:border-0">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-4 py-2.5 font-mono text-[0.82rem] leading-6 text-fg-muted"
                    >
                      <Inlines content={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "custom":
      return <div className="my-6">{block.node}</div>;

    default:
      return null;
  }
}

/** Small re-export so content authors can sprinkle a Badge in custom blocks. */
export { Badge };
