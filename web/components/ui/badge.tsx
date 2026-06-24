import { cn } from "./cn";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  /** "soft" = tinted fill (default), "outline" = bordered. */
  variant?: "soft" | "outline";
};

const soft: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-fg-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger"
};

const outline: Record<BadgeTone, string> = {
  neutral: "border border-border text-fg-muted",
  accent: "border border-accent/40 text-accent",
  success: "border border-success/40 text-success",
  warning: "border border-warning/40 text-warning",
  danger: "border border-danger/40 text-danger"
};

export function Badge({
  tone = "neutral",
  variant = "soft",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[0.7rem] font-medium uppercase tracking-[0.08em]",
        variant === "soft" ? soft[tone] : outline[tone],
        className
      )}
      {...props}
    />
  );
}
