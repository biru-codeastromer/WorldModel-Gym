import { cn } from "./cn";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Apply a fully-rounded shape (for avatars/dots). */
  circle?: boolean;
};

/**
 * Shimmering loading placeholder. The shimmer animation is disabled under
 * prefers-reduced-motion (handled in globals.css). Pass width/height via
 * className (e.g. "h-4 w-32").
 */
export function Skeleton({ circle = false, className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("shimmer", circle ? "rounded-full" : "rounded-md", className)}
      {...props}
    />
  );
}
