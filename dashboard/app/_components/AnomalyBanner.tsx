import type { Snapshot } from "@/lib/redis";

type Anomaly = Snapshot["anomaly"];

export function AnomalyBanner({ anomaly }: { anomaly: Anomaly }) {
  if (anomaly.status === "unknown") return null;

  if (anomaly.status === "flag") {
    return (
      <div className="anim-rise flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/8 px-4 py-3">
        <WarningIcon className="mt-0.5 size-4 shrink-0 text-warn" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-warn">Usage anomaly detected</p>
          <p className="mt-0.5 text-sm text-foreground/70">{anomaly.message}</p>
        </div>
      </div>
    );
  }

  if (anomaly.status === "baseline") {
    return (
      <div className="anim-rise flex items-center gap-2.5 rounded-xl border border-line bg-panel px-4 py-2.5">
        <span className="size-1.5 shrink-0 rounded-full bg-muted anim-breathe" />
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground/70">Still calibrating</span>
          <span className="mx-1.5 text-line-strong">·</span>
          {anomaly.message}
        </p>
      </div>
    );
  }

  return (
    <div className="anim-rise flex items-center gap-2.5 px-1">
      <CheckIcon className="size-4 shrink-0 text-ok" />
      <p className="text-sm text-muted">{anomaly.message}</p>
    </div>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
