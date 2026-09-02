import type { ComponentStatus, ServiceReport, StatusReport } from "@/lib/status";
import { STATUS_LABEL, STATUS_RANK } from "@/lib/status";
import { bands } from "@/app/_lib/usage";
import { Plate, PlateHead, SectionRule } from "./Plate";

const NEUTRAL = { color: "var(--ink-2)", tint: "rgba(236,230,218,0.06)" };

const MARKS: Record<ComponentStatus, { color: string; tint: string; code: string }> = {
  operational: { color: bands.ok.color, tint: bands.ok.tint, code: "Nominal" },
  under_maintenance: { ...NEUTRAL, code: "Maintenance" },
  unknown: { ...NEUTRAL, code: "No reading" },
  degraded_performance: { color: bands.warn.color, tint: bands.warn.tint, code: "Degraded" },
  partial_outage: { color: bands.warn.color, tint: bands.warn.tint, code: "Partial" },
  major_outage: { color: bands.crit.color, tint: bands.crit.tint, code: "Outage" },
};

export type ServiceStatusState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; report: StatusReport };

export function ServiceStatus({ state }: { state: ServiceStatusState }) {
  const services = state.status === "ready" ? state.report.services : [];
  const degraded = services.filter(
    (service) => !service.available || STATUS_RANK[service.status] > 0
  ).length;

  return (
    <div className="flex flex-col gap-3">
      <SectionRule
        index="04"
        title="Upstream services"
        aside={
          <span className="plate-label">
            {state.status === "ready"
              ? degraded === 0
                ? "All nominal"
                : `${degraded} flagged`
              : "Polling"}
          </span>
        }
      />

      {state.status === "ready" ? (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {services.map((service, index) => (
            <ServicePlate key={service.id} service={service} delay={30 + index * 40} />
          ))}
        </div>
      ) : (
        <Plate bracket={false}>
          <div className="px-4 py-5">
            <p className="text-[12px] text-ink-2">
              {state.status === "loading"
                ? "Interrogating provider status pages…"
                : "Provider status pages could not be reached."}
            </p>
          </div>
        </Plate>
      )}
    </div>
  );
}

function ServicePlate({ service, delay }: { service: ServiceReport; delay: number }) {
  const mark = MARKS[service.available ? service.status : "unknown"];
  const headline = service.available ? STATUS_LABEL[service.status] : "Unavailable";
  const detail = service.available
    ? service.description || "Reported by provider status page"
    : service.reason;

  return (
    <Plate delay={delay} className="flex flex-col">
      <PlateHead
        title={service.title}
        aside={
          <span className="stencil text-[9px]" style={{ color: mark.color }}>
            {mark.code}
          </span>
        }
      />

      <div className="flex items-center gap-3.5 px-4 py-4">
        <Lamp color={mark.color} tint={mark.tint} />
        <div className="min-w-0">
          <p className="truncate text-[14px] leading-none" style={{ color: mark.color }}>
            {headline}
          </p>
          <p className="mt-2 truncate text-[11px] text-ink-3">{detail}</p>
        </div>
      </div>

      {service.available && service.components.length > 0 ? (
        <div className="border-t border-rule px-4 py-3.5">
          <p className="plate-label">Components</p>
          <div className="mt-3 flex flex-col gap-2">
            {service.components.map((component) => (
              <div
                key={component.name}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="truncate text-[11px] text-ink-2">{component.name}</span>
                <span
                  className="shrink-0 text-[11px]"
                  style={{ color: MARKS[component.status].color }}
                >
                  {STATUS_LABEL[component.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-auto border-t border-rule px-4 py-2.5">
        <a
          href={service.page}
          target="_blank"
          rel="noreferrer noopener"
          className="plate-label focus-ring hover:text-ink-2"
        >
          {service.page.replace(/^https:\/\//, "")} ↗
        </a>
      </div>
    </Plate>
  );
}

function Lamp({ color, tint }: { color: string; tint: string }) {
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center border"
      style={{ borderColor: color, backgroundColor: tint }}
    >
      <span className="size-2" style={{ backgroundColor: color }} />
    </span>
  );
}
