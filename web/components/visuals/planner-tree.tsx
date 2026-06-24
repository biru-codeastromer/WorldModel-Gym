import { cn } from "../ui/cn";

type PlannerTreeProps = {
  className?: string;
};

/**
 * Planner search-tree / imagination-rollout motif: a root node branching into
 * sampled trajectories, with one highlighted "chosen" path. Evokes MCTS /
 * model-based planning. Pure SVG, theme-aware, decorative.
 */
export function PlannerTree({ className }: PlannerTreeProps) {
  // node positions in a 200x120 viewBox
  const root = { x: 18, y: 60 };
  const l1 = [
    { x: 70, y: 28 },
    { x: 70, y: 60 },
    { x: 70, y: 92 }
  ];
  const l2 = [
    { x: 128, y: 16, p: 0 },
    { x: 128, y: 40, p: 0 },
    { x: 128, y: 60, p: 1 },
    { x: 128, y: 80, p: 1 },
    { x: 128, y: 104, p: 2 }
  ];
  const leaf = [
    { x: 184, y: 16, p: 0 },
    { x: 184, y: 40, p: 1 },
    { x: 184, y: 60, p: 2 },
    { x: 184, y: 80, p: 3 },
    { x: 184, y: 104, p: 4 }
  ];
  // chosen path: root -> l1[1] -> l2[2] -> leaf[2]
  const chosen = new Set(["l1-1", "l2-2", "leaf-2"]);

  return (
    <svg
      viewBox="0 0 200 120"
      role="img"
      aria-hidden="true"
      className={cn("text-fg-subtle", className)}
    >
      {/* root -> l1 */}
      {l1.map((n, i) => (
        <line
          key={`e0-${i}`}
          x1={root.x}
          y1={root.y}
          x2={n.x}
          y2={n.y}
          stroke="currentColor"
          strokeOpacity={chosen.has(`l1-${i}`) ? 0 : 0.3}
          strokeWidth={1}
        />
      ))}
      {/* l1 -> l2 */}
      {l2.map((n, i) => (
        <line
          key={`e1-${i}`}
          x1={l1[n.p].x}
          y1={l1[n.p].y}
          x2={n.x}
          y2={n.y}
          stroke="currentColor"
          strokeOpacity={chosen.has(`l2-${i}`) ? 0 : 0.3}
          strokeWidth={1}
        />
      ))}
      {/* l2 -> leaf */}
      {leaf.map((n, i) => (
        <line
          key={`e2-${i}`}
          x1={l2[n.p].x}
          y1={l2[n.p].y}
          x2={n.x}
          y2={n.y}
          stroke="currentColor"
          strokeOpacity={chosen.has(`leaf-${i}`) ? 0 : 0.3}
          strokeWidth={1}
        />
      ))}

      {/* highlighted chosen rollout */}
      <polyline
        points={`${root.x},${root.y} ${l1[1].x},${l1[1].y} ${l2[2].x},${l2[2].y} ${leaf[2].x},${leaf[2].y}`}
        fill="none"
        className="stroke-accent"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* nodes */}
      {[...l1.map((n, i) => ({ ...n, id: `l1-${i}` })),
        ...l2.map((n, i) => ({ ...n, id: `l2-${i}` })),
        ...leaf.map((n, i) => ({ ...n, id: `leaf-${i}` }))].map((n) => (
        <circle
          key={n.id}
          cx={n.x}
          cy={n.y}
          r={chosen.has(n.id) ? 3.4 : 2.4}
          className={chosen.has(n.id) ? "fill-accent" : "fill-fg-subtle"}
          opacity={chosen.has(n.id) ? 1 : 0.5}
        />
      ))}
      <circle cx={root.x} cy={root.y} r={4} className="fill-fg" />
    </svg>
  );
}
