import type { ModelBreakdown, Snapshot } from "@/lib/redis";

export type ProviderId = "claude" | "codex";

export type LimitWindow = {
  key: string;
  title: string;
  scope: string;
  pct: number;
  resetsAt: string | null;
  breakdown: ModelBreakdown[];
};

export type Provider = {
  id: ProviderId;
  name: string;
  surface: string;
  plan: string | null;
  email: string | null;
  windows: LimitWindow[];
  breakdownLabel: string;
  coverage: string;
};

const DAY_SECONDS = 86_400;
const WEEK_SECONDS = 604_800;

function windowTitle(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Rate limit window";
  if (seconds < DAY_SECONDS) return `${Math.round(seconds / 3600)}-hour session`;
  if (seconds === WEEK_SECONDS) return "Weekly allowance";
  return `${Math.round(seconds / DAY_SECONDS)}-day allowance`;
}

function windowScope(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Window length not reported";
  if (seconds < DAY_SECONDS) return `Rolling ${Math.round(seconds / 3600)}h window`;
  return `Rolling ${Math.round(seconds / DAY_SECONDS)}d window`;
}

function describeCoverage(name: string, windows: LimitWindow[], hasShortWindow: boolean): string {
  if (windows.length === 0) return `No rate-limit windows reported by ${name}`;
  const count = `${windows.length} rate-limit ${windows.length === 1 ? "window" : "windows"}`;
  return hasShortWindow
    ? `${count} reported by ${name}`
    : `${count} reported by ${name} · no sub-daily window published on this plan`;
}

function codexPlanLabel(plan: string | null): string | null {
  if (!plan) return null;
  const trimmed = plan.trim();
  if (trimmed.length === 0) return null;
  return `ChatGPT ${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function claudeProvider(snapshot: Snapshot): Provider {
  const windows: LimitWindow[] = [
    {
      key: "claude-5h",
      title: windowTitle(5 * 3600),
      scope: windowScope(5 * 3600),
      pct: snapshot.fiveHour.pct,
      resetsAt: snapshot.fiveHour.resetsAt,
      breakdown: [],
    },
    {
      key: "claude-week",
      title: windowTitle(WEEK_SECONDS),
      scope: windowScope(WEEK_SECONDS),
      pct: snapshot.week.pct,
      resetsAt: snapshot.week.resetsAt,
      breakdown: snapshot.week.byModel ?? [],
    },
  ];

  return {
    id: "claude",
    name: "Claude",
    surface: "Claude Code",
    plan: snapshot.account.plan,
    email: snapshot.account.email,
    windows,
    breakdownLabel: "Per model",
    coverage: describeCoverage("Claude", windows, true),
  };
}

function codexProvider(snapshot: Snapshot): Provider {
  const source = snapshot.codex?.windows ?? [];
  const windows: LimitWindow[] = source.map((entry, index) => ({
    key: `codex-${entry.seconds}-${index}`,
    title: windowTitle(entry.seconds),
    scope: windowScope(entry.seconds),
    pct: entry.pct,
    resetsAt: entry.resetsAt,
    breakdown: entry.byLimit ?? [],
  }));

  const hasShortWindow = source.some(
    (entry) => Number.isFinite(entry.seconds) && entry.seconds > 0 && entry.seconds < DAY_SECONDS
  );

  return {
    id: "codex",
    name: "Codex",
    surface: "OpenAI Codex",
    plan: codexPlanLabel(snapshot.codex?.plan ?? null),
    email: snapshot.codex?.email ?? null,
    windows,
    breakdownLabel: "Per limit",
    coverage: describeCoverage("Codex", windows, hasShortWindow),
  };
}

export function buildProviders(snapshot: Snapshot): Provider[] {
  return [claudeProvider(snapshot), codexProvider(snapshot)];
}

export function isLoneTrailingWindow(index: number, total: number): boolean {
  return total % 2 === 1 && index === total - 1;
}
