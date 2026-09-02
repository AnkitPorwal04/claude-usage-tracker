import type { Snapshot } from "@/lib/redis";
import { FootNote, Plate, Readout, SectionRule } from "./Plate";
import { AnomalyBanner } from "./AnomalyBanner";
import { CostChart } from "./CostChart";
import { ProviderSection } from "./ProviderSection";
import { buildProviders } from "@/app/_lib/providers";
import { formatCurrency, formatRelativeTime, formatTokens } from "@/app/_lib/format";

const COST_SOURCE_NOTE =
  "Measured from local ccusage logs on this station. Claude Code only — Codex does not publish spend, so it is not included in these figures.";

export function MachinePanel({
  snapshot,
  now,
  startIndex = 1,
}: {
  snapshot: Snapshot;
  now: number;
  startIndex?: number;
}) {
  const { account, anomaly, costs, dailyHistory, machine, ts } = snapshot;
  const providers = buildProviders(snapshot);
  const label = (offset: number) => String(startIndex + offset).padStart(2, "0");

  return (
    <section className="flex flex-col gap-7">
      <StationHeader operator={account.name} machine={machine} ts={ts} now={now} />

      <AnomalyBanner anomaly={anomaly} />

      {providers.map((provider, position) => (
        <ProviderSection key={provider.id} provider={provider} index={label(position)} />
      ))}

      <div className="flex flex-col gap-3">
        <SectionRule
          index={label(providers.length)}
          title="Expenditure"
          tag="Claude Code only"
          aside={<span className="plate-label">USD · local estimate</span>}
        />
        <Plate delay={90}>
          <div className="grid sm:grid-cols-3">
            <div className="border-b border-rule sm:border-r sm:border-b-0">
              <Readout
                label="Today"
                value={formatCurrency(costs.today)}
                sub={formatTokens(costs.todayTokens)}
              />
            </div>
            <div className="border-b border-rule sm:border-r sm:border-b-0">
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
          <FootNote>{COST_SOURCE_NOTE}</FootNote>
        </Plate>
      </div>

      <div className="flex flex-col gap-3">
        <SectionRule
          index={label(providers.length + 1)}
          title="Daily recorder"
          tag="Claude Code only"
          aside={<span className="tnum plate-label">{dailyHistory.length} samples</span>}
        />
        <Plate delay={120}>
          <div className="p-4">
            <CostChart history={dailyHistory} />
          </div>
          <FootNote>{COST_SOURCE_NOTE}</FootNote>
        </Plate>
      </div>
    </section>
  );
}

export function machineSectionCount(snapshot: Snapshot): number {
  return buildProviders(snapshot).length + 2;
}

function StationHeader({
  operator,
  machine,
  ts,
  now,
}: {
  operator: string | null;
  machine: string;
  ts: number;
  now: number;
}) {
  return (
    <div className="plate-in flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <p className="plate-label">Operator</p>
        <h2 className="stencil mt-2 truncate text-[20px] leading-none text-ink">
          {operator ?? "Unnamed operator"}
        </h2>
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
