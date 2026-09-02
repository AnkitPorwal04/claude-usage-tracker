"use client";

import { useEffect, useState } from "react";
import { bandFor, clampPercent } from "@/app/_lib/usage";

const CX = 100;
const CY = 100;
const R = 84;
const STROKE = 9;
const C = 2 * Math.PI * R;

export function Gauge({ pct, size = 196 }: { pct: number; size?: number }) {
  const band = bandFor(pct);
  const value = clampPercent(pct);
  const display = Number.isFinite(pct) ? Math.round(pct) : 0;

  const [swept, setSwept] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setSwept(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const offset = swept ? C * (1 - value / 100) : C;

  return (
    <div
      className="shrink-0"
      style={{ width: size }}
      role="img"
      aria-label={`${display} percent used, band ${band.code}, ${band.label}`}
    >
      <svg viewBox="0 0 200 200" width={size} height={size}>
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="var(--rule)"
          strokeWidth={STROKE}
        />

        <circle
          className="ring-arc"
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={band.color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${CX} ${CY})`}
        />

        <text
          x={CX}
          y={CY + 10.5}
          fill="var(--ink)"
          fontSize={30}
          fontWeight={500}
          fontFamily="var(--font-plex-mono), monospace"
          textAnchor="middle"
          className="tnum"
        >
          {display}
          <tspan fontSize={13} fill="var(--ink-3)" dx={2}>
            %
          </tspan>
        </text>
      </svg>

      <div className="mt-1 flex items-center justify-center gap-2">
        <span
          className="stencil px-1.5 py-px text-[9px]"
          style={{ backgroundColor: band.tint, color: band.color }}
        >
          Band {band.code}
        </span>
        <span className="stencil text-[10px]" style={{ color: band.color }}>
          {band.label}
        </span>
      </div>
    </div>
  );
}
