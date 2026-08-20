import type { Snapshot } from "@/lib/redis";
import { Card, CardLabel } from "./Card";
import { UsageRing } from "./UsageRing";
import { UsageMeter } from "./UsageMeter";
import { AnomalyBanner } from "./AnomalyBanner";
import { CostChart } from "./CostChart";
import {
  formatCurrency,
  formatRelativeTime,
  formatResetTime,
  formatTokens,
} from "@/app/_lib/format";
import { usageLabel, usageLevel, usagePalette } from "@/app/_lib/usage";

export function MachinePanel({ snapshot, now }: { snapshot: Snapshot; now: number }) {
  const { account, fiveHour, week, anomaly, costs, dailyHistory, machine, ts } = snapshot;

  return (
    <section className="flex flex-col gap-4">
      <AccountHeader
        account={account}
        machine={machine}
        ts={ts}
        now={now}
      />

      <AnomalyBanner anomaly={anomaly} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SessionCard
          title="5-hour session"
          subtitle="Rolling session limit"
          pct={fiveHour.pct}
          resetsAt={fiveHour.resetsAt}
          delay={40}
        />
        <SessionCard
          title="Weekly limit"
          subtitle="Rolling 7-day limit"
          pct={week.pct}
          resetsAt={week.resetsAt}
          delay={80}
          byModel={week.byModel}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CostCard
          label="Today"
          cost={costs.today}
          tokens={costs.todayTokens}
          delay={120}
        />
        <CostCard
          label="Last 7 days"
          cost={costs.week}
          tokens={costs.weekTokens}
          delay={160}
        />
        <CostCard
          label="This month"
          cost={costs.month}
          tokens={costs.monthTokens}
          delay={200}
        />
      </div>

      <Card delay={240}>
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <CardLabel>Daily spend</CardLabel>
            <p className="mt-1 text-sm text-muted">
              Local cost estimate, last {dailyHistory.length} days
            </p>
          </div>
        </div>
        <CostChart history={dailyHistory} />
      </Card>
    </section>
  );
}

function AccountHeader({
  account,
  machine,
  ts,
  now,
}: {
  account: Snapshot["account"];
  machine: string;
  ts: number;
  now: number;
}) {
  return (
    <div className="anim-rise flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            {account.name ?? "Claude account"}
          </h2>
          {account.plan ? (
            <span className="rounded-full border border-line-strong bg-panel-strong px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
              {account.plan}
            </span>
          ) : null}
        </div>
        {account.email ? (
          <p className="mt-1 truncate text-sm text-muted">{account.email}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="font-mono text-foreground/70">{machine}</span>
        <span className="text-line-strong">·</span>
        <span className="tnum">updated {formatRelativeTime(ts, now)}</span>
      </div>
    </div>
  );
}

function SessionCard({
  title,
  subtitle,
  pct,
  resetsAt,
  byModel,
  delay,
}: {
  title: string;
  subtitle: string;
  pct: number;
  resetsAt: string | null;
  byModel?: Snapshot["week"]["byModel"];
  delay?: number;
}) {
  const level = usageLevel(pct);
  const palette = usagePalette[level];
  const resetLabel = formatResetTime(resetsAt);

  return (
    <Card delay={delay} className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardLabel>{title}</CardLabel>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${palette.chipBg} ${palette.chipText} ${palette.chipRing}`}
        >
          {usageLabel(level)}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-6">
        <UsageRing pct={pct} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            {resetLabel ? (
              <>
                Resets{" "}
                <span className="font-medium text-foreground/85">{resetLabel}</span>
              </>
            ) : (
              "Reset time unavailable"
            )}
          </p>
          <div className="mt-4">
            <UsageMeter label="Used" pct={pct} />
          </div>
        </div>
      </div>

      {byModel && byModel.length > 0 ? (
        <div className="mt-6 border-t border-line pt-4">
          <CardLabel>By model</CardLabel>
          <div className="mt-3 flex flex-col gap-3">
            {byModel.map((model) => (
              <UsageMeter key={model.name} label={model.name} pct={model.pct} size="sm" />
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function CostCard({
  label,
  cost,
  tokens,
  delay,
}: {
  label: string;
  cost: number;
  tokens: number;
  delay?: number;
}) {
  return (
    <Card delay={delay}>
      <CardLabel>{label}</CardLabel>
      <p className="tnum mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
        {formatCurrency(cost)}
      </p>
      <p className="tnum mt-1 text-sm text-muted">{formatTokens(tokens)}</p>
    </Card>
  );
}
