import type { ModelBreakdown } from "@/lib/redis";
import type { LimitWindow, Provider } from "@/app/_lib/providers";
import { isLoneTrailingWindow } from "@/app/_lib/providers";
import { Plate, PlateHead, SectionRule } from "./Plate";
import { Gauge } from "./Gauge";
import { ScaleBar } from "./ScaleBar";
import { formatResetTime } from "@/app/_lib/format";
import { bandFor } from "@/app/_lib/usage";

export function ProviderSection({
  provider,
  index,
}: {
  provider: Provider;
  index: string;
}) {
  const total = provider.windows.length;

  return (
    <section className="flex flex-col gap-3">
      <SectionRule
        index={index}
        title={provider.name}
        tag={provider.plan ?? undefined}
        aside={<span className="plate-label">{provider.surface}</span>}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="plate-label">{provider.coverage}</span>
        {provider.email ? (
          <>
            <span className="h-2.5 w-px shrink-0 bg-rule-2" aria-hidden />
            <span className="truncate text-[11px] text-ink-3">{provider.email}</span>
          </>
        ) : null}
      </div>

      {total === 0 ? (
        <NoTelemetryPlate provider={provider} />
      ) : (
        <div className="grid items-stretch gap-3 lg:grid-cols-2">
          {provider.windows.map((window, position) => {
            const wide = isLoneTrailingWindow(position, total);
            return (
              <LimitPlate
                key={window.key}
                window={window}
                breakdownLabel={provider.breakdownLabel}
                wide={wide}
                className={wide ? "lg:col-span-2" : ""}
                delay={30 + position * 40}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function NoTelemetryPlate({ provider }: { provider: Provider }) {
  return (
    <Plate delay={30}>
      <PlateHead
        title="No reading"
        aside={<span className="stencil text-[9px] text-ink-3">—</span>}
      />
      <div className="px-4 py-8 text-center">
        <p className="text-[12px] leading-relaxed text-ink-2">
          This station is not reporting {provider.name} rate-limit windows.
        </p>
        <p className="plate-label mt-3">Receiver armed</p>
      </div>
    </Plate>
  );
}

function LimitPlate({
  window,
  breakdownLabel,
  wide,
  className,
  delay,
}: {
  window: LimitWindow;
  breakdownLabel: string;
  wide: boolean;
  className: string;
  delay: number;
}) {
  const band = bandFor(window.pct);
  const resetLabel = formatResetTime(window.resetsAt);
  const hasBreakdown = window.breakdown.length > 0;

  return (
    <Plate delay={delay} className={`flex flex-col ${className}`}>
      <PlateHead
        title={window.title}
        aside={
          <span className="stencil text-[9px]" style={{ color: band.color }}>
            {band.code}
          </span>
        }
      />

      <div className="flex flex-1 flex-col items-center gap-5 p-4 sm:flex-row sm:items-start">
        <Gauge pct={window.pct} size={wide ? 172 : 156} />

        <dl className="w-full min-w-0 flex-1 sm:pt-2">
          <Row term="Scope" value={window.scope} />
          <Row term="Resets" value={resetLabel ?? "Unavailable"} />
          <Row term="State" value={band.label} accent={band.color} />

          <div className="pt-4">
            <ScaleBar label="Of allowance" pct={window.pct} />
          </div>
        </dl>

        {wide && hasBreakdown ? (
          <div className="hidden min-w-0 lg:block lg:w-0 lg:flex-1 lg:border-l lg:border-rule lg:pt-2 lg:pl-6">
            <Breakdown label={breakdownLabel} entries={window.breakdown} />
          </div>
        ) : null}
      </div>

      {hasBreakdown ? (
        <div className={`border-t border-rule px-4 py-3.5 ${wide ? "lg:hidden" : ""}`}>
          <Breakdown label={breakdownLabel} entries={window.breakdown} />
        </div>
      ) : null}
    </Plate>
  );
}

function Breakdown({ label, entries }: { label: string; entries: ModelBreakdown[] }) {
  return (
    <>
      <p className="plate-label">{label}</p>
      <div className="mt-3 flex flex-col gap-2.5">
        {entries.map((entry) => (
          <ScaleBar key={entry.name} label={entry.name} pct={entry.pct} size="sm" />
        ))}
      </div>
    </>
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
