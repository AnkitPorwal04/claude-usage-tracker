import { Plate, SectionRule } from "./Plate";
import { bands } from "@/app/_lib/usage";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`pulse-dim bg-[rgba(236,230,218,0.08)] ${className}`} />;
}

function ScanLine() {
  return (
    <div className="relative h-px w-full overflow-hidden bg-rule">
      <div className="sweep h-px w-1/4 bg-[var(--ink-2)]" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <section
      className="flex flex-col gap-7"
      aria-busy="true"
      aria-label="Acquiring usage signal"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2.5">
          <Bar className="h-5 w-48" />
          <Bar className="h-3 w-36" />
        </div>
        <Bar className="h-4 w-40" />
      </div>

      <ScanLine />

      {[
        { index: "01", title: "Claude", plates: 2 },
        { index: "02", title: "Codex", plates: 1 },
      ].map((section) => (
        <div key={section.index} className="flex flex-col gap-3">
          <SectionRule index={section.index} title={section.title} />
          <Bar className="h-2.5 w-52" />
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: section.plates }, (_, key) => (
              <Plate
                key={key}
                bracket={false}
                className={section.plates === 1 ? "lg:col-span-2" : ""}
              >
                <div className="border-b border-rule px-4 py-2.5">
                  <Bar className="h-2.5 w-24" />
                </div>
                <div className="flex flex-col items-center gap-5 p-5 sm:flex-row">
                  <Bar className="h-[132px] w-[164px] shrink-0 rounded-full" />
                  <div className="w-full flex-1">
                    <Bar className="h-2.5 w-28" />
                    <Bar className="mt-4 h-2 w-full" />
                    <Bar className="mt-5 h-3 w-full" />
                  </div>
                </div>
              </Plate>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-3">
        <SectionRule index="03" title="Expenditure" />
        <div className="grid border border-rule sm:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="border-b border-rule px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
              <Bar className="h-2.5 w-16" />
              <Bar className="mt-3 h-6 w-24" />
              <Bar className="mt-2.5 h-2.5 w-14" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SectionRule index="04" title="Recorder" />
        <Plate bracket={false}>
          <div className="p-4">
            <Bar className="h-[210px] w-full" />
          </div>
        </Plate>
      </div>
    </section>
  );
}

export function EmptyState() {
  return (
    <Plate>
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <svg viewBox="0 0 200 24" className="h-6 w-full max-w-xs text-ink-3" aria-hidden>
          <line x1="0" y1="12" x2="200" y2="12" stroke="currentColor" strokeWidth="1" strokeDasharray="4 5" />
        </svg>
        <h2 className="stencil mt-6 text-[13px] text-ink">No signal</h2>
        <p className="mt-2.5 max-w-sm text-[12px] leading-relaxed text-ink-2">
          Waiting for the first snapshot from your Mac. The local tracker reports Claude and
          Codex usage every 2 minutes and this plate will pick it up automatically.
        </p>
        <p className="plate-label mt-6">Receiver armed</p>
      </div>
    </Plate>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Plate>
      <div
        className="flex flex-col items-center px-6 py-16 text-center"
        style={{ borderTop: `2px solid ${bands.crit.color}` }}
      >
        <span
          className="stencil px-2 py-1 text-[10px]"
          style={{ backgroundColor: bands.crit.tint, color: bands.crit.color }}
        >
          Fault
        </span>
        <h2 className="stencil mt-5 text-[13px] text-ink">Telemetry unavailable</h2>
        <p className="mt-2.5 max-w-sm text-[12px] leading-relaxed text-ink-2">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="btn-solid focus-ring stencil mt-7 px-4 py-2 text-[11px]"
        >
          Retry acquisition
        </button>
      </div>
    </Plate>
  );
}
