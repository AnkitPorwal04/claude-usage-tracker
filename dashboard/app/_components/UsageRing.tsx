import { clampPercent, usageLevel, usagePalette } from "@/app/_lib/usage";

export function UsageRing({
  pct,
  size = 148,
  stroke = 11,
}: {
  pct: number;
  size?: number;
  stroke?: number;
}) {
  const level = usageLevel(pct);
  const palette = usagePalette[level];
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clampPercent(pct) / 100);
  const display = Number.isFinite(pct) ? Math.round(pct) : 0;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${display}% used`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={palette.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-[stroke-dashoffset,stroke] duration-700 ease-out ${palette.glow}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`tnum text-3xl font-semibold ${palette.text}`}>{display}</span>
        <span className="text-xs font-medium text-muted">percent</span>
      </div>
    </div>
  );
}
