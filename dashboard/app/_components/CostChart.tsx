"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Snapshot } from "@/lib/redis";
import {
  formatAxisCurrency,
  formatCurrency,
  formatDayLabel,
  formatFullDayLabel,
  formatTokens,
} from "@/app/_lib/format";

const PAD_L = 44;
const PAD_R = 14;
const PAD_T = 16;
const PAD_B = 22;
const HEIGHT = 210;

function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const n = value / base;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * base;
}

function useWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export function CostChart({ history }: { history: Snapshot["dailyHistory"] }) {
  const { ref, width } = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const points = history;
  const count = points.length;

  const stats = useMemo(() => {
    if (count === 0) return { max: 1, mean: 0, peakIndex: -1 };
    let max = 0;
    let total = 0;
    let peakIndex = 0;
    points.forEach((point, i) => {
      const cost = Number.isFinite(point.cost) ? point.cost : 0;
      total += cost;
      if (cost > max) {
        max = cost;
        peakIndex = i;
      }
    });
    return { max, mean: total / count, peakIndex };
  }, [points, count]);

  const top = niceCeil(stats.max);
  const innerW = Math.max(0, width - PAD_L - PAD_R);
  const innerH = HEIGHT - PAD_T - PAD_B;

  const xAt = useCallback(
    (i: number) => (count <= 1 ? PAD_L + innerW / 2 : PAD_L + (i / (count - 1)) * innerW),
    [count, innerW]
  );
  const yAt = useCallback(
    (v: number) => PAD_T + innerH - (Math.max(0, v) / top) * innerH,
    [innerH, top]
  );

  const selected = active !== null && active < count ? active : count - 1;
  const cursor = points[selected];

  const handleMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (count === 0 || innerW <= 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const rel = event.clientX - rect.left - PAD_L;
      const ratio = Math.min(1, Math.max(0, rel / innerW));
      setActive(Math.round(ratio * (count - 1)));
    },
    [count, innerW]
  );

  if (count === 0) {
    return (
      <div className="flex h-[210px] items-center justify-center border border-dashed border-rule">
        <span className="plate-label">No samples recorded</span>
      </div>
    );
  }

  const trace = points.map((p, i) => `${xAt(i)},${yAt(p.cost)}`).join(" ");
  const area = `${PAD_L},${yAt(0)} ${trace} ${xAt(count - 1)},${yAt(0)}`;

  const MIN_LABEL_GAP = 54;
  const labelled: number[] = [];
  let lastLabelX = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < count - 1; i += 1) {
    if (xAt(i) - lastLabelX >= MIN_LABEL_GAP) {
      labelled.push(i);
      lastLabelX = xAt(i);
    }
  }
  while (labelled.length > 0 && xAt(count - 1) - xAt(labelled[labelled.length - 1]) < MIN_LABEL_GAP) {
    labelled.pop();
  }
  labelled.push(count - 1);

  return (
    <div ref={ref} className="w-full">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-2.5">
        <span className="plate-label">
          {cursor ? formatFullDayLabel(cursor.date) : "—"}
        </span>
        <span className="flex items-baseline gap-3">
          <span className="tnum text-[15px] font-medium text-ink">
            {cursor ? formatCurrency(cursor.cost) : "—"}
          </span>
          <span className="tnum text-[11px] text-ink-3">
            {cursor ? formatTokens(cursor.tokens) : ""}
          </span>
        </span>
      </div>

      {width > 0 ? (
        <svg
          width={width}
          height={HEIGHT}
          onPointerMove={handleMove}
          onPointerLeave={() => setActive(null)}
          className="touch-pan-y"
          role="img"
          aria-label={`Daily spend over ${count} recorded days`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = PAD_T + innerH - f * innerH;
            const labelled = f === 0 || f === 0.5 || f === 1;
            return (
              <g key={f}>
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={width - PAD_R}
                  y2={y}
                  stroke="var(--ink)"
                  strokeWidth={1}
                  opacity={f === 0 ? 0.22 : 0.07}
                />
                {labelled ? (
                  <text
                    x={PAD_L - 8}
                    y={y}
                    fill="var(--ink-3)"
                    fontSize={9}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="tnum"
                  >
                    {formatAxisCurrency(top * f)}
                  </text>
                ) : null}
              </g>
            );
          })}

          {points.map((p, i) => (
            <line
              key={`grid-${p.date}`}
              x1={xAt(i)}
              y1={PAD_T}
              x2={xAt(i)}
              y2={PAD_T + innerH}
              stroke="var(--ink)"
              strokeWidth={1}
              opacity={0.045}
            />
          ))}

          <polygon points={area} fill="var(--ink)" opacity={0.06} />

          <line
            x1={PAD_L}
            y1={yAt(stats.mean)}
            x2={width - PAD_R}
            y2={yAt(stats.mean)}
            stroke="var(--ink-2)"
            strokeWidth={1}
            strokeDasharray="3 4"
            opacity={0.7}
          />
          <text
            x={PAD_L + 4}
            y={yAt(stats.mean) - 5}
            fill="var(--ink-3)"
            fontSize={9}
            textAnchor="start"
            className="tnum"
          >
            AVG {formatAxisCurrency(stats.mean)}
          </text>

          <polyline
            points={trace}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={1.4}
            strokeLinejoin="round"
            opacity={0.85}
          />

          {points.map((p, i) => (
            <line
              key={`tick-${p.date}`}
              x1={xAt(i)}
              y1={yAt(p.cost) - 2.5}
              x2={xAt(i)}
              y2={yAt(p.cost) + 2.5}
              stroke="var(--ink)"
              strokeWidth={1}
              opacity={0.5}
            />
          ))}

          {stats.peakIndex >= 0 ? (
            <circle
              cx={xAt(stats.peakIndex)}
              cy={yAt(stats.max)}
              r={3.2}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={1.2}
            />
          ) : null}

          {active !== null ? (
            <line
              x1={xAt(selected)}
              y1={PAD_T - 4}
              x2={xAt(selected)}
              y2={PAD_T + innerH + 4}
              stroke="var(--ink)"
              strokeWidth={1}
              opacity={0.45}
            />
          ) : null}
          <rect
            x={xAt(selected) - 2.5}
            y={yAt(points[selected]?.cost ?? 0) - 2.5}
            width={5}
            height={5}
            fill="var(--ink)"
          />

          {labelled.map((i) => (
            <text
              key={`x-${points[i].date}`}
              x={xAt(i)}
              y={HEIGHT - 6}
              fill="var(--ink-3)"
              fontSize={9}
              textAnchor={i === 0 ? "start" : i === count - 1 ? "end" : "middle"}
              className="tnum"
            >
              {formatDayLabel(points[i].date)}
            </text>
          ))}
        </svg>
      ) : (
        <div style={{ height: HEIGHT }} />
      )}
    </div>
  );
}
