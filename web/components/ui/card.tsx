import { forwardRef } from "react";

import { cn } from "./cn";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Visual elevation. "flat" = no shadow, "raised" = md, "pop" = lg. */
  elevation?: "flat" | "raised" | "pop";
  /** Inner padding. Default "md". */
  padding?: "none" | "sm" | "md" | "lg";
  /** Use the slightly recessed surface-2 instead of surface. */
  inset?: boolean;
};

const pad: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8"
};

const elev: Record<NonNullable<CardProps["elevation"]>, string> = {
  flat: "shadow-none",
  raised: "shadow-md",
  pop: "shadow-lg"
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ elevation = "flat", padding = "md", inset = false, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-border",
        inset ? "bg-surface-2" : "bg-surface",
        elev[elevation],
        pad[padding],
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";
