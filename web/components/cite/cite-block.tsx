"use client";

import { Check, Copy, Quote } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Badge, Card, Segmented, cn, toast } from "@/components/ui";
import { CodeBlock } from "@/components/docs";
import {
  WMG_CITATION,
  toBibTeX,
  toPlainText,
  type Citation
} from "./citation";

type Format = "bibtex" | "plain";

type CiteBlockProps = {
  /** Citation to render. Defaults to the WorldModel Gym benchmark record. */
  citation?: Citation;
  className?: string;
};

/**
 * "Cite this benchmark" card. Renders a BibTeX entry (default) with a toggle to
 * a plain-text reference. The dedicated copy button copies the *currently shown*
 * format and fires a "Citation copied" toast — distinct from CodeBlock's generic
 * "Copied". CSP-clean: the clipboard write is a bundled event handler, no inline
 * <script>.
 */
export function CiteBlock({ citation = WMG_CITATION, className }: CiteBlockProps) {
  const [format, setFormat] = useState<Format>("bibtex");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bibtex = toBibTeX(citation);
  const plain = toPlainText(citation);
  const current = format === "bibtex" ? bibtex : plain;
  const formatLabel = format === "bibtex" ? "BibTeX" : "Plain text";

  const onCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(current);
      } else {
        // Legacy fallback for browsers without the async clipboard API.
        const ta = document.createElement("textarea");
        ta.value = current;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success("Citation copied", {
        description: `${formatLabel} reference copied to your clipboard`
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed", {
        description: "Select the citation text and copy manually"
      });
    }
  }, [current, formatLabel]);

  return (
    <Card
      elevation="raised"
      padding="lg"
      className={cn("flex flex-col", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-accent"
            aria-hidden="true"
          >
            <Quote className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-serif text-xl text-fg">Cite this benchmark</h3>
            <p className="mt-1 font-mono text-xs leading-6 text-fg-muted">
              Reference WorldModel Gym in papers, READMEs, or model cards.
            </p>
          </div>
        </div>
        <Badge tone="accent" variant="outline">
          {citation.key}
        </Badge>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented<Format>
          ariaLabel="Citation format"
          size="sm"
          value={format}
          onChange={setFormat}
          options={[
            { value: "bibtex", label: "BibTeX" },
            { value: "plain", label: "Plain text" }
          ]}
        />
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${formatLabel} citation to clipboard`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3.5 py-1.5 font-mono text-xs font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{copied ? "Copied" : "Copy citation"}</span>
        </button>
      </div>

      {/* The CodeBlock has its own generic copy button + toast; the dedicated
          "Citation copied" button above is the primary affordance. */}
      {format === "bibtex" ? (
        <CodeBlock code={bibtex} language="bibtex" label="BibTeX" />
      ) : (
        <CodeBlock code={plain} language="text" label="Plain text" />
      )}
    </Card>
  );
}
