import { cn } from "../ui/cn";

type SparklineProps = {
  data: number[];
  /** "accent" | "success" | "danger". Default "accent". */
  tone?: "accent" | "success" | "danger";
  /** Fill the area under the line. Default true. */
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
};

const STROKE: Record<NonNullable<SparklineProps["tone"]>, string> = {
  accent: "stroke-accent",
  success: "stroke-success",
  danger: "stroke-danger"
};
const FILL: Record<NonNullable<SparklineProps["tone"]>, string> = {
  accent: "fill-accent",
  success: "fill-success",
  danger: "fill-danger"
};

/**
 * Tiny inline sparkline for trend cells (e.g. success-rate over runs). Pure SVG,
 * theme-aware, decorative. Auto-scales to data min/max.
 */
export function Sparkline({
  data,
  tone = "accent",
  fill = true,
  width = 80,
  height = 24,
  className
}: SparklineProps) {
  if (data.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" className={className} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((d, i) => {
    const x = i * stepX;
    const y = height - ((d - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={cn("overflow-visible", className)}
    >
      {fill ? <path d={area} className={cn(FILL[tone])} opacity={0.12} /> : null}
      <path
        d={line}
        fill="none"
        className={cn(STROKE[tone])}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
