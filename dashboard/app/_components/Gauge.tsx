"use client";

import { useEffect, useState } from "react";
import { bandFor, bands, bandOrder, clampPercent, usageLevel } from "@/app/_lib/usage";

const CX = 100;
const CY = 104;
const START = 150;
const SWEEP = 240;

const R_BAND = 92;
const R_TICK = 82;
const R_NUM = 62;

function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function angleAt(pct: number): number {
  return START + (clampPercent(pct) / 100) * SWEEP;
}

function arcPath(r: number, fromPct: number, toPct: number): string {
  const a0 = angleAt(fromPct);
  const a1 = angleAt(toPct);
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

const MINOR = Array.from({ length: 51 }, (_, i) => i * 2);
const NUMERALS: { at: number; fill: string }[] = [
  { at: 0, fill: "var(--ink-3)" },
  { at: 50, fill: bands.warn.color },
  { at: 80, fill: bands.crit.color },
  { at: 100, fill: "var(--ink-3)" },
];

export function Gauge({ pct, size = 196 }: { pct: number; size?: number }) {
  const level = usageLevel(pct);
  const band = bandFor(pct);
  const value = clampPercent(pct);
  const display = Number.isFinite(pct) ? Math.round(pct) : 0;

  const [swept, setSwept] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setSwept(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const angle = swept ? angleAt(value) : START;

  return (
    <div
      className="shrink-0"
      style={{ width: size }}
      role="img"
      aria-label={`${display} percent used, band ${band.code}, ${band.label}`}
    >
      <svg viewBox="0 0 200 168" width={size} height={(size * 168) / 200}>
        {bandOrder.map((key) => {
          const b = bands[key];
          const active = key === level;
          return (
            <path
              key={key}
              d={arcPath(R_BAND, b.from, b.to)}
              fill="none"
              stroke={b.color}
              strokeWidth={active ? 4 : 2}
              opacity={active ? 1 : 0.24}
            />
          );
        })}

        {MINOR.map((p) => {
          const major = p % 10 === 0;
          const [x0, y0] = polar(R_TICK, angleAt(p));
          const [x1, y1] = polar(R_TICK - (major ? 11 : 5), angleAt(p));
          return (
            <line
              key={p}
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              stroke="var(--ink)"
              strokeWidth={major ? 1.4 : 0.8}
              opacity={major ? 0.55 : 0.22}
            />
          );
        })}

        {NUMERALS.map((n) => {
          const [x, y] = polar(R_NUM, angleAt(n.at));
          return (
            <text
              key={n.at}
              x={x}
              y={y}
              fill={n.fill}
              fontSize={9}
              fontFamily="var(--font-plex-mono), monospace"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {n.at}
            </text>
          );
        })}

        <g
          className="needle"
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${CY}px` }}
        >
          <line
            x1={CX - 16}
            y1={CY}
            x2={CX + 68}
            y2={CY}
            stroke={band.color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <circle cx={CX - 16} cy={CY} r={3} fill={band.color} />
        </g>

        <circle cx={CX} cy={CY} r={6} fill="var(--ground)" stroke="var(--ink-2)" strokeWidth={1} />
        <circle cx={CX} cy={CY} r={1.6} fill="var(--ink-2)" />

        <text
          x={CX}
          y={150}
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

      <div className="-mt-1 flex items-center justify-center gap-2">
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
