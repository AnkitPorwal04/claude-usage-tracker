"use client";

import { useCallback, useEffect, useState } from "react";
import type { Snapshot } from "@/lib/redis";
import { parseStatusReport } from "@/lib/status";
import { MachinePanel } from "./_components/MachinePanel";
import { DashboardSkeleton, EmptyState, ErrorState } from "./_components/States";
import { ServiceStatus, type ServiceStatusState } from "./_components/ServiceStatus";
import { Mark } from "./_components/Mark";

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
  const [serviceStatus, setServiceStatus] = useState<ServiceStatusState>({
    status: "loading",
  });
  const [now, setNow] = useState(() => Date.now());

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) {
        setServiceStatus({ status: "error" });
        return;
      }
      const report = parseStatusReport(await res.json());
      setServiceStatus(report ? { status: "ready", report } : { status: "error" });
    } catch {
      setServiceStatus({ status: "error" });
    }
  }, []);

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
    void loadStatus();
  }, [load, loadStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      void load(false);
      void loadStatus();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load, loadStatus]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void load(false);
        void loadStatus();
      }
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        void load(false);
        void loadStatus();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [load, loadStatus]);

  return (
    <>
      <Masthead
        onRefresh={() => {
          void load(false);
          void loadStatus();
        }}
        busy={state.status === "loading"}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-7 sm:py-10">
        {state.status === "loading" ? <DashboardSkeleton /> : null}

        {state.status === "error" ? (
          <ErrorState message={state.message} onRetry={() => void load(true)} />
        ) : null}

        {state.status === "ready" ? (
          state.snapshots.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-14">
              {state.snapshots.map((snapshot) => (
                <MachinePanel key={snapshot.machine} snapshot={snapshot} now={now} />
              ))}
            </div>
          )
        ) : null}

        <div className="mt-14">
          <ServiceStatus state={serviceStatus} />
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-8 sm:px-7">
        <div className="flex items-center justify-between gap-4 border-t border-rule pt-3">
          <span className="plate-label">Claude Code · Usage Telemetry</span>
          <span className="plate-label tnum">Auto-acquire 60s</span>
        </div>
      </footer>
    </>
  );
}

function Masthead({ onRefresh, busy }: { onRefresh: () => void; busy: boolean }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    redirectToLogin();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-ground">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-7">
        <div className="flex items-center gap-3">
          <Mark className="size-5 text-ink" />
          <span className="stencil text-[12px] text-ink">Claude Usage</span>
          <span className="hidden h-3 w-px bg-rule-2 sm:block" />
          <span className="plate-label hidden sm:block">Instrument Plate</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy}
            aria-label="Re-acquire data"
            className="btn-plate focus-ring flex size-7 items-center justify-center disabled:opacity-40"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className={`size-3.5 ${busy ? "animate-spin" : ""}`}
              aria-hidden
            >
              <path
                d="M16 10a6 6 0 1 1-1.8-4.3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path d="M16 3v3.4h-3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="btn-plate focus-ring stencil px-2.5 py-1.5 text-[10px] disabled:opacity-40"
          >
            {loggingOut ? "Closing" : "Log out"}
          </button>
        </div>
      </div>
    </header>
  );
}
