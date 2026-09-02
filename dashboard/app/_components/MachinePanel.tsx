import type { CodexLimitWindow, ModelBreakdown, Snapshot } from "@/lib/redis";
import { Plate, PlateHead, Readout, SectionRule } from "./Plate";
import { Gauge } from "./Gauge";
import { ScaleBar } from "./ScaleBar";
import { AnomalyBanner } from "./AnomalyBanner";
import { CostChart } from "./CostChart";
import {
  formatCurrency,
  formatRelativeTime,
  formatResetTime,
  formatTokens,
} from "@/app/_lib/format";
import { bandFor } from "@/app/_lib/usage";

export function MachinePanel({ snapshot, now }: { snapshot: Snapshot; now: number }) {
  const { account, fiveHour, week, codex, anomaly, costs, dailyHistory, machine, ts } = snapshot;
  const codexWindows = codex?.windows ?? [];

  return (
    <section className="flex flex-col gap-7">
      <AccountHeader account={account} machine={machine} ts={ts} now={now} />

      <AnomalyBanner anomaly={anomaly} />

      <div className="flex flex-col gap-3">
        <SectionRule
          index="01"
          title="Claude consumption limits"
          aside={<span className="plate-label">Bands I · II · III</span>}
        />
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <LimitPlate
            title="5-hour session"
            scope="Rolling 5h window"
            pct={fiveHour.pct}
            resetsAt={fiveHour.resetsAt}
            delay={30}
          />
          <LimitPlate
            title="Weekly allowance"
            scope="Rolling 7d window"
            pct={week.pct}
            resetsAt={week.resetsAt}
            byModel={week.byModel}
            delay={70}
          />
        </div>
      </div>

      {codexWindows.length > 0 ? (
        <div className="flex flex-col gap-3">
          <SectionRule
            index="02"
            title="Codex consumption limits"
            aside={
              <span className="plate-label">
                {codex?.plan ? `ChatGPT ${codex.plan}` : "Bands I · II · III"}
              </span>
            }
          />
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {codexWindows.map((window, index) => (
              <LimitPlate
                key={window.seconds}
                title={codexWindowTitle(window.seconds)}
                scope={codexWindowScope(window.seconds)}
                pct={window.pct}
                resetsAt={window.resetsAt}
                byModel={window.byLimit}
                delay={30 + index * 40}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <SectionRule
          index={codexWindows.length > 0 ? "03" : "02"}
          title="Expenditure"
          aside={<span className="plate-label">USD · local estimate</span>}
        />
        <div className="plate-in grid border border-rule bg-raise sm:grid-cols-3">
          <div className="border-b border-rule sm:border-b-0 sm:border-r">
            <Readout
              label="Today"
              value={formatCurrency(costs.today)}
              sub={formatTokens(costs.todayTokens)}
            />
          </div>
          <div className="border-b border-rule sm:border-b-0 sm:border-r">
            <Readout
              label="Last 7 days"
              value={formatCurrency(costs.week)}
              sub={formatTokens(costs.weekTokens)}
            />
          </div>
          <Readout
            label="This month"
            value={formatCurrency(costs.month)}
            sub={formatTokens(costs.monthTokens)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SectionRule
          index={codexWindows.length > 0 ? "04" : "03"}
          title="Daily recorder"
          aside={
            <span className="tnum plate-label">{dailyHistory.length} samples</span>
          }
        />
        <Plate delay={120}>
          <div className="p-4">
            <CostChart history={dailyHistory} />
          </div>
        </Plate>
      </div>
    </section>
  );
}

function codexWindowTitle(seconds: CodexLimitWindow["seconds"]): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Rate limit window";
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}-hour session`;
  if (seconds === 604_800) return "Weekly allowance";
  return `${Math.round(seconds / 86_400)}-day allowance`;
}

function codexWindowScope(seconds: CodexLimitWindow["seconds"]): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Reported by Codex";
  if (seconds < 86_400) return `Rolling ${Math.round(seconds / 3600)}h window`;
  return `Rolling ${Math.round(seconds / 86_400)}d window`;
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
    <div className="plate-in flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <p className="plate-label">Subject</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="stencil truncate text-[20px] leading-none text-ink">
            {account.name ?? "Claude account"}
          </h2>
          {account.plan ? (
            <span className="stencil border border-rule-2 px-1.5 py-0.5 text-[9px] text-ink-2">
              {account.plan}
            </span>
          ) : null}
        </div>
        {account.email ? (
          <p className="mt-2 truncate text-[11px] text-ink-3">{account.email}</p>
        ) : null}
      </div>

      <dl className="flex shrink-0 gap-6">
        <div>
          <dt className="plate-label">Station</dt>
          <dd className="mt-2 truncate text-[11px] text-ink-2">{machine}</dd>
        </div>
        <div>
          <dt className="plate-label">Last sample</dt>
          <dd className="tnum mt-2 text-[11px] text-ink-2">{formatRelativeTime(ts, now)}</dd>
        </div>
      </dl>
    </div>
  );
}

function LimitPlate({
  title,
  scope,
  pct,
  resetsAt,
  byModel,
  delay,
}: {
  title: string;
  scope: string;
  pct: number;
  resetsAt: string | null;
  byModel?: ModelBreakdown[];
  delay?: number;
}) {
  const band = bandFor(pct);
  const resetLabel = formatResetTime(resetsAt);

  return (
    <Plate delay={delay} className="flex flex-col">
      <PlateHead
        title={title}
        aside={
          <span className="stencil text-[9px]" style={{ color: band.color }}>
            {band.code}
          </span>
        }
      />

      <div className="flex flex-1 flex-col items-center gap-5 p-4 sm:flex-row sm:items-start sm:gap-5">
        <Gauge pct={pct} size={188} />

        <dl className="w-full min-w-0 flex-1 sm:pt-3">
          <Row term="Scope" value={scope} />
          <Row term="Resets" value={resetLabel ?? "Unavailable"} />
          <Row term="State" value={band.label} accent={band.color} />

          <div className="pt-4">
            <ScaleBar label="Of allowance" pct={pct} />
          </div>
        </dl>
      </div>

      {byModel && byModel.length > 0 ? (
        <div className="border-t border-rule px-4 py-3.5">
          <p className="plate-label">Per model</p>
          <div className="mt-3 flex flex-col gap-2.5">
            {byModel.map((model) => (
              <ScaleBar key={model.name} label={model.name} pct={model.pct} size="sm" />
            ))}
          </div>
        </div>
      ) : null}
    </Plate>
  );
}

function Row({
  term,
  value,
  accent,
}: {
  term: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-rule py-2 first:pt-0">
      <dt className="plate-label">{term}</dt>
      <dd
        className="tnum truncate text-[12px]"
        style={accent ? { color: accent } : { color: "var(--ink)" }}
      >
        {value}
      </dd>
    </div>
  );
}
