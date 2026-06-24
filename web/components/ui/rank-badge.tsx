import { cn } from "./cn";

type RankBadgeProps = {
  rank: number;
  className?: string;
};

/**
 * Leaderboard rank treatment. Top 3 get warm medal tints (gold/silver/bronze);
 * the rest get a neutral mono numeral. The numeral is the only content so it
 * stays readable for screen readers when placed in a cell.
 */
const MEDAL: Record<number, string> = {
  1: "bg-[#f3d27a] text-[#5a4410] border-[#e0b24a]",
  2: "bg-[#dcdfe6] text-[#454b57] border-[#c3c8d2]",
  3: "bg-[#e8c4a0] text-[#6a4423] border-[#d6a878]"
};

export function RankBadge({ rank, className }: RankBadgeProps) {
  const medal = MEDAL[rank];
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border px-1.5 font-mono text-sm font-semibold tabular-nums",
        medal ?? "border-border bg-surface-2 text-fg-muted",
        className
      )}
    >
      {rank}
    </span>
  );
}
