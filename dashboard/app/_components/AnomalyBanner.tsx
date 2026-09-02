import type { Snapshot } from "@/lib/redis";
import { bands } from "@/app/_lib/usage";

type Anomaly = Snapshot["anomaly"];

const STAMPS = {
  flag: { code: "Flag", color: bands.warn.color, tint: bands.warn.tint },
  baseline: { code: "Calibrating", color: "var(--ink-2)", tint: "rgba(236,230,218,0.06)" },
  clean: { code: "Clean", color: bands.ok.color, tint: bands.ok.tint },
};

export function AnomalyBanner({ anomaly }: { anomaly: Anomaly }) {
  if (anomaly.status === "unknown") return null;

  const stamp = STAMPS[anomaly.status];

  return (
    <div
      role="status"
      className="plate-in flex items-stretch border border-rule bg-raise"
      style={{ borderLeftColor: stamp.color, borderLeftWidth: 2 }}
    >
      <span
        className="stencil flex shrink-0 items-center px-3 text-[10px]"
        style={{ backgroundColor: stamp.tint, color: stamp.color }}
      >
        {stamp.code}
      </span>
      <p className="min-w-0 px-3 py-2.5 text-[12px] leading-snug text-ink-2">
        {anomaly.message}
      </p>
    </div>
  );
}
