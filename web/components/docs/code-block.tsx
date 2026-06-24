"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { toast } from "@/components/ui";
import { cn } from "@/components/ui";

type CodeBlockProps = {
  code: string;
  /** Language id (used for the a11y label). */
  language?: string;
  /** Short visible label in the header; defaults to `language`. */
  label?: string;
  className?: string;
};

/**
 * Token-themed code block with a copy button. Copying fires a "Copied" toast via
 * the shared toast system. Mono font, language label, and a focus-visible copy
 * affordance. No inline <script> — the clipboard write is a bundled event
 * handler, so it stays CSP-clean.
 */
export function CodeBlock({ code, language = "text", label, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const display = (label ?? language).toLowerCase();

  const onCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Legacy fallback for browsers without the async clipboard API.
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success("Copied", { description: "Code copied to your clipboard" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed", { description: "Select the text and copy manually" });
    }
  }, [code]);

  return (
    <div
      className={cn(
        "group relative my-5 overflow-hidden rounded-lg border border-border bg-surface-2",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border bg-surface-3/60 px-4 py-2">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-fg-subtle">
          {display}
        </span>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy code to clipboard"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 font-mono text-[0.66rem] text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[0.8rem] leading-6">
        <code className="font-mono text-fg">{code}</code>
      </pre>
    </div>
  );
}
