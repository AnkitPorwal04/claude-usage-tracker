import { bandFor, clampPercent, CRIT_AT, WARN_AT, bands } from "@/app/_lib/usage";
import { formatPercent } from "@/app/_lib/format";

const GATES = [
  { at: WARN_AT, color: bands.warn.color },
  { at: CRIT_AT, color: bands.crit.color },
];

export function ScaleBar({
  label,
  pct,
  size = "md",
}: {
  label: string;
  pct: number;
  size?: "sm" | "md";
}) {
  const band = bandFor(pct);
  const width = clampPercent(pct);
  const small = size === "sm";

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className={`truncate ${small ? "text-[11px]" : "text-[12px]"} text-ink-2`}>
          {label}
        </span>
        <span
          className={`tnum shrink-0 ${small ? "text-[11px]" : "text-[12px]"} font-medium`}
          style={{ color: band.color }}
        >
          {formatPercent(pct)}
        </span>
      </div>

      <div className={`relative w-full ${small ? "h-1.5" : "h-2"}`}>
        <div className="absolute inset-0 bg-[rgba(236,230,218,0.07)]" />

        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: band.color }}
        />

        {GATES.map((gate) => (
          <span
            key={gate.at}
            className="absolute -top-1 -bottom-1 w-px"
            style={{ left: `${gate.at}%`, backgroundColor: gate.color, opacity: 0.65 }}
          />
        ))}
      </div>

      {small ? null : (
        <div className="tick-rail-h mt-1 h-1 w-full opacity-50" aria-hidden />
      )}
    </div>
  );
}
