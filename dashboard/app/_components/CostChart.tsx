"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { Snapshot } from "@/lib/redis";
import {
  formatAxisCurrency,
  formatCurrency,
  formatDayLabel,
  formatFullDayLabel,
  formatTokens,
} from "@/app/_lib/format";

type ChartPoint = {
  date: string;
  cost: number;
  tokens: number;
  label: string;
};

function isChartPoint(value: unknown): value is ChartPoint {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.date === "string" &&
    typeof point.cost === "number" &&
    typeof point.tokens === "number"
  );
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point: unknown = payload[0].payload;
  if (!isChartPoint(point)) return null;

  return (
    <div className="rounded-xl border border-line-strong bg-[#111317]/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="text-xs font-medium text-muted">{formatFullDayLabel(point.date)}</p>
      <p className="tnum mt-1 text-sm font-semibold text-foreground">
        {formatCurrency(point.cost)}
      </p>
      <p className="tnum text-xs text-muted">{formatTokens(point.tokens)}</p>
    </div>
  );
}

export function CostChart({ history }: { history: Snapshot["dailyHistory"] }) {
  if (history.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted">
        No daily history recorded yet
      </div>
    );
  }

  const data: ChartPoint[] = history.map((point) => ({
    date: point.date,
    cost: point.cost,
    tokens: point.tokens,
    label: formatDayLabel(point.date),
  }));

  const tickInterval = data.length > 20 ? Math.ceil(data.length / 8) - 1 : 0;

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="costBarFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3fcf8e" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#3fcf8e" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            interval={tickInterval}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={4}
            tick={{ fill: "#8b909a", fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fill: "#8b909a", fontSize: 11 }}
            tickFormatter={formatAxisCurrency}
          />
          <Tooltip
            content={ChartTooltip}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar
            dataKey="cost"
            fill="url(#costBarFill)"
            radius={[4, 4, 2, 2]}
            maxBarSize={26}
            animationDuration={700}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
