import { clampPercent, usageLevel, usagePalette } from "@/app/_lib/usage";
import { formatPercent } from "@/app/_lib/format";

export function UsageMeter({
  label,
  pct,
  size = "md",
}: {
  label: string;
  pct: number;
  size?: "sm" | "md";
}) {
  const palette = usagePalette[usageLevel(pct)];
  const height = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span
          className={
            size === "sm"
              ? "truncate text-xs text-muted"
              : "truncate text-sm font-medium text-foreground/85"
          }
        >
          {label}
        </span>
        <span className={`tnum shrink-0 text-xs font-semibold ${palette.text}`}>
          {formatPercent(pct)}
        </span>
      </div>
      <div className={`w-full overflow-hidden rounded-full bg-white/6 ${height}`}>
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${palette.bar}`}
          style={{ width: `${clampPercent(pct)}%` }}
        />
      </div>
    </div>
  );
}
