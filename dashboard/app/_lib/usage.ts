export type UsageLevel = "ok" | "warn" | "crit";

export const WARN_AT = 50;
export const CRIT_AT = 80;

export function usageLevel(pct: number): UsageLevel {
  if (!Number.isFinite(pct)) return "ok";
  if (pct >= CRIT_AT) return "crit";
  if (pct >= WARN_AT) return "warn";
  return "ok";
}

export function clampPercent(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

type Band = {
  color: string;
  tint: string;
  label: string;
  code: string;
  from: number;
  to: number;
};

export const bands: Record<UsageLevel, Band> = {
  ok: {
    color: "#7dab5a",
    tint: "rgba(125, 171, 90, 0.13)",
    label: "Nominal",
    code: "I",
    from: 0,
    to: WARN_AT,
  },
  warn: {
    color: "#e9a13b",
    tint: "rgba(233, 161, 59, 0.13)",
    label: "Elevated",
    code: "II",
    from: WARN_AT,
    to: CRIT_AT,
  },
  crit: {
    color: "#f2542d",
    tint: "rgba(242, 84, 45, 0.13)",
    label: "Critical",
    code: "III",
    from: CRIT_AT,
    to: 100,
  },
};

export function bandFor(pct: number): Band {
  return bands[usageLevel(pct)];
}
