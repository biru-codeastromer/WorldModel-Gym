import { cn } from "../ui/cn";

type GridWorldProps = {
  /** Grid size (cells per side). Default 6. */
  size?: number;
  className?: string;
};

/**
 * On-brand grid-world environment glyph: a paper grid with an agent, a goal,
 * and a couple of obstacles + a dotted planned path. Pure SVG, theme-aware via
 * currentColor / token classes. Decorative (aria-hidden).
 */
export function GridWorld({ size = 6, className }: GridWorldProps) {
  const cells = Array.from({ length: size * size }, (_, i) => i);
  const unit = 100 / size;
  const center = (i: number) => (i + 0.5) * unit;
  const agent = { c: 0, r: size - 1 };
  const goal = { c: size - 1, r: 0 };
  const obstacles = [
    { c: 2, r: 3 },
    { c: 3, r: 3 },
    { c: 4, r: 2 }
  ];
  const path = [
    { c: 0, r: 5 },
    { c: 1, r: 5 },
    { c: 1, r: 4 },
    { c: 2, r: 4 },
    { c: 3, r: 4 },
    { c: 4, r: 4 },
    { c: 5, r: 3 },
    { c: 5, r: 1 },
    { c: 5, r: 0 }
  ];

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-hidden="true"
      className={cn("text-fg-muted", className)}
    >
      {/* cells */}
      {cells.map((i) => {
        const c = i % size;
        const r = Math.floor(i / size);
        return (
          <rect
            key={i}
            x={c * unit}
            y={r * unit}
            width={unit}
            height={unit}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.18}
            strokeWidth={0.5}
          />
        );
      })}
      {/* obstacles */}
      {obstacles.map((o, i) => (
        <rect
          key={`o-${i}`}
          x={o.c * unit + unit * 0.16}
          y={o.r * unit + unit * 0.16}
          width={unit * 0.68}
          height={unit * 0.68}
          rx={1.5}
          className="fill-fg-subtle"
          opacity={0.35}
        />
      ))}
      {/* planned path */}
      <polyline
        points={path.map((p) => `${center(p.c)},${center(p.r)}`).join(" ")}
        fill="none"
        className="stroke-accent"
        strokeWidth={1.4}
        strokeDasharray="2 2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
      {/* goal */}
      <g>
        <circle cx={center(goal.c)} cy={center(goal.r)} r={unit * 0.32} className="fill-success-soft" />
        <circle cx={center(goal.c)} cy={center(goal.r)} r={unit * 0.16} className="fill-success" />
      </g>
      {/* agent */}
      <g>
        <circle cx={center(agent.c)} cy={center(agent.r)} r={unit * 0.3} className="fill-accent-soft" />
        <circle cx={center(agent.c)} cy={center(agent.r)} r={unit * 0.15} className="fill-accent" />
      </g>
    </svg>
  );
}
