export type UsageLevel = "ok" | "warn" | "crit";

export function usageLevel(pct: number): UsageLevel {
  if (!Number.isFinite(pct)) return "ok";
  if (pct >= 80) return "crit";
  if (pct >= 50) return "warn";
  return "ok";
}

export function clampPercent(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

type UsagePalette = {
  stroke: string;
  text: string;
  bar: string;
  track: string;
  chipBg: string;
  chipText: string;
  chipRing: string;
  glow: string;
};

export const usagePalette: Record<UsageLevel, UsagePalette> = {
  ok: {
    stroke: "#3fcf8e",
    text: "text-ok",
    bar: "bg-ok",
    track: "bg-ok/12",
    chipBg: "bg-ok/10",
    chipText: "text-ok",
    chipRing: "ring-ok/25",
    glow: "drop-shadow-[0_0_10px_rgba(63,207,142,0.35)]",
  },
  warn: {
    stroke: "#f5a524",
    text: "text-warn",
    bar: "bg-warn",
    track: "bg-warn/12",
    chipBg: "bg-warn/10",
    chipText: "text-warn",
    chipRing: "ring-warn/25",
    glow: "drop-shadow-[0_0_10px_rgba(245,165,36,0.35)]",
  },
  crit: {
    stroke: "#f76c6c",
    text: "text-crit",
    bar: "bg-crit",
    track: "bg-crit/12",
    chipBg: "bg-crit/10",
    chipText: "text-crit",
    chipRing: "ring-crit/25",
    glow: "drop-shadow-[0_0_10px_rgba(247,108,108,0.4)]",
  },
};

export function usageLabel(level: UsageLevel): string {
  if (level === "crit") return "Critical";
  if (level === "warn") return "Elevated";
  return "Healthy";
}
