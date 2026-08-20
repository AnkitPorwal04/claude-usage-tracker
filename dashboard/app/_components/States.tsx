import { Card } from "./Card";

function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/6 ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <section className="flex flex-col gap-4" aria-busy="true" aria-label="Loading usage data">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Shimmer className="h-7 w-52" />
          <Shimmer className="h-4 w-40" />
        </div>
        <Shimmer className="h-4 w-44" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((key) => (
          <Card key={key}>
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <Shimmer className="h-3 w-28" />
                <Shimmer className="h-4 w-36" />
              </div>
              <Shimmer className="h-6 w-20 rounded-full" />
            </div>
            <div className="mt-5 flex items-center gap-6">
              <Shimmer className="size-[148px] rounded-full" />
              <div className="flex-1 flex-col gap-3">
                <Shimmer className="h-4 w-32" />
                <Shimmer className="mt-4 h-2.5 w-full rounded-full" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Card key={key}>
            <Shimmer className="h-3 w-20" />
            <Shimmer className="mt-3 h-8 w-28" />
            <Shimmer className="mt-2 h-4 w-20" />
          </Card>
        ))}
      </div>

      <Card>
        <Shimmer className="h-3 w-24" />
        <Shimmer className="mt-5 h-[260px] w-full rounded-xl" />
      </Card>
    </section>
  );
}

export function EmptyState() {
  return (
    <Card className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="relative flex size-14 items-center justify-center rounded-2xl border border-line bg-panel-strong">
        <span className="absolute size-2 rounded-full bg-ok/70 anim-breathe" />
      </div>
      <div className="max-w-md">
        <h2 className="text-lg font-semibold tracking-tight">No data yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Waiting for your Mac to push its first snapshot. The local tracker checks in
          every 2 minutes — this page will pick it up automatically.
        </p>
      </div>
    </Card>
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
    <Card className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-crit/25 bg-crit/8">
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 text-crit" aria-hidden>
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 1.5 0v-4ZM10 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className="max-w-md">
        <h2 className="text-lg font-semibold tracking-tight">Couldn&apos;t load usage</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border border-line-strong bg-panel-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ok/60"
      >
        Try again
      </button>
    </Card>
  );
}
