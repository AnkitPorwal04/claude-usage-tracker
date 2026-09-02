import type { ReactNode } from "react";

export function Plate({
  children,
  className = "",
  delay,
  bracket = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  bracket?: boolean;
}) {
  return (
    <div
      className={`plate-in ${bracket ? "bracket" : ""} border border-rule bg-raise ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

export function SectionRule({
  index,
  title,
  tag,
  aside,
}: {
  index: string;
  title: string;
  tag?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="plate-in flex items-center gap-3">
      <span className="tnum shrink-0 text-[10px] font-medium text-ink-3">{index}</span>
      <span className="plate-label plate-label-ink truncate">{title}</span>
      {tag ? (
        <span className="plate-label shrink-0 border border-rule-2 px-1.5 py-0.5 whitespace-nowrap">
          {tag}
        </span>
      ) : null}
      <span className="h-px min-w-3 flex-1 bg-rule" />
      {aside ? <div className="hidden shrink-0 sm:block">{aside}</div> : null}
    </div>
  );
}

export function PlateHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
      <span className="plate-label plate-label-ink truncate">{title}</span>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

export function Readout({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-4">
      <p className="plate-label">{label}</p>
      <p className="tnum mt-2.5 truncate text-[24px] font-medium leading-none text-ink">
        {value}
      </p>
      {sub ? <p className="tnum mt-2 text-[11px] text-ink-3">{sub}</p> : null}
    </div>
  );
}

export function FootNote({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-rule px-4 py-2.5 text-[11px] leading-snug text-ink-3">
      {children}
    </p>
  );
}
