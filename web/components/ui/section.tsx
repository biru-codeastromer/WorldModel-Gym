import { cn } from "./cn";

type SectionProps = React.HTMLAttributes<HTMLElement> & {
  as?: "section" | "div";
};

/** A vertical-rhythm wrapper for a page block. */
export function Section({ as = "section", className, ...props }: SectionProps) {
  const Tag = as;
  return <Tag className={cn("py-12 md:py-16", className)} {...props} />;
}

type SectionHeaderProps = {
  /** Mono uppercase kicker / eyebrow. */
  kicker?: string;
  /** Serif display title. */
  title: React.ReactNode;
  /** Supporting lede paragraph. */
  lede?: React.ReactNode;
  /** Optional action node (button/link) aligned to the right on wide screens. */
  action?: React.ReactNode;
  /** Heading level for the title. Default 2. */
  as?: "h1" | "h2" | "h3";
  align?: "left" | "center";
  className?: string;
};

/**
 * Compact editorial header: small mono kicker, serif title, muted lede.
 * Deliberately tight — keep heroes purposeful, not viewport-filling.
 */
export function SectionHeader({
  kicker,
  title,
  lede,
  action,
  as = "h2",
  align = "left",
  className
}: SectionHeaderProps) {
  const Heading = as;
  const centered = align === "center";
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        action && !centered
          ? "md:flex-row md:items-end md:justify-between"
          : "",
        centered && "items-center text-center",
        className
      )}
    >
      <div className={cn("max-w-2xl", centered && "mx-auto")}>
        {kicker ? (
          <p className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-accent">
            {kicker}
          </p>
        ) : null}
        <Heading className="font-serif text-3xl leading-[1.1] tracking-[-0.01em] text-fg md:text-4xl">
          {title}
        </Heading>
        {lede ? (
          <p className="mt-3 font-mono text-sm leading-7 text-fg-muted">{lede}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
