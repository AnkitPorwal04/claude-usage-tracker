"use client";

import { useCallback, useEffect, useState } from "react";
import type { Snapshot } from "@/lib/redis";
import { MachinePanel } from "./_components/MachinePanel";
import { DashboardSkeleton, EmptyState, ErrorState } from "./_components/States";

type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshots: Snapshot[] };

const REFRESH_INTERVAL_MS = 60_000;
const CLOCK_INTERVAL_MS = 15_000;

function redirectToLogin() {
  window.location.replace("/login");
}

function isSnapshotArray(value: unknown): value is Snapshot[] {
  return Array.isArray(value);
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (showSkeleton: boolean) => {
    if (showSkeleton) setState({ status: "loading" });

    try {
      const res = await fetch("/api/snapshot", { cache: "no-store" });

      if (res.status === 401) {
        redirectToLogin();
        return;
      }

      if (!res.ok) {
        setState({
          status: "error",
          message: `The server responded with ${res.status}. Your snapshot data could not be loaded.`,
        });
        return;
      }

      const body: unknown = await res.json();
      const snapshots =
        typeof body === "object" && body !== null
          ? (body as { snapshots?: unknown }).snapshots
          : undefined;

      if (!isSnapshotArray(snapshots)) {
        setState({
          status: "error",
          message: "The server returned an unexpected response shape.",
        });
        return;
      }

      setState({ status: "ready", snapshots });
      setNow(Date.now());
    } catch {
      setState({
        status: "error",
        message: "Could not reach the server. Check your connection and try again.",
      });
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => void load(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <TopBar onRefresh={() => void load(false)} busy={state.status === "loading"} />

      <div className="mt-8">
        {state.status === "loading" ? <DashboardSkeleton /> : null}

        {state.status === "error" ? (
          <ErrorState message={state.message} onRetry={() => void load(true)} />
        ) : null}

        {state.status === "ready" ? (
          state.snapshots.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-12">
              {state.snapshots.map((snapshot) => (
                <MachinePanel key={snapshot.machine} snapshot={snapshot} now={now} />
              ))}
            </div>
          )
        ) : null}
      </div>
    </main>
  );
}

function TopBar({ onRefresh, busy }: { onRefresh: () => void; busy: boolean }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    redirectToLogin();
  }

  return (
    <header className="anim-rise flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <span className="size-2 rounded-full bg-ok shadow-[0_0_10px_rgba(63,207,142,0.7)]" />
        <span className="text-sm font-semibold tracking-tight">Claude Usage</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={busy}
          aria-label="Refresh data"
          className="flex size-9 items-center justify-center rounded-lg border border-line bg-panel text-muted transition-colors hover:border-line-strong hover:text-foreground disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ok/60"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`size-4 ${busy ? "animate-spin" : ""}`}
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h1.433a.75.75 0 0 0 0-1.5H4.083a.75.75 0 0 0-.75.75v3.149a.75.75 0 0 0 1.5 0v-1.31l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.389Zm-10.624-2.85a5.5 5.5 0 0 1 9.201-2.466l.312.311H12.77a.75.75 0 0 0 0 1.5h3.149a.75.75 0 0 0 .75-.75V4.02a.75.75 0 0 0-1.5 0v1.31l-.31-.31A7 7 0 0 0 3.146 8.157a.75.75 0 1 0 1.449.389Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-foreground disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ok/60"
        >
          {loggingOut ? "Signing out" : "Log out"}
        </button>
      </div>
    </header>
  );
}
