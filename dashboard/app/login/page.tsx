"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState(0);

  function showError(message: string) {
    setError(message);
    setErrorKey((key) => key + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.replace("/");
        return;
      }

      if (res.status === 401) {
        showError("Incorrect password");
      } else {
        showError("Something went wrong. Please try again.");
      }
      setPassword("");
    } catch {
      showError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="anim-rise w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-line bg-panel-strong shadow-[0_0_40px_-12px_rgba(63,207,142,0.5)]">
            <LockIcon className="size-5 text-ok" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Claude Usage</h1>
          <p className="mt-2 text-sm text-muted">Enter your password to continue</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-line bg-panel p-6 backdrop-blur-sm"
        >
          <label
            htmlFor="password"
            className="mb-2 block text-[11px] font-medium uppercase tracking-[0.13em] text-muted"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error !== null}
            aria-describedby={error ? "password-error" : undefined}
            className={`w-full rounded-lg border bg-black/25 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:bg-black/35 ${
              error
                ? "border-crit/60 focus:border-crit"
                : "border-line-strong focus:border-ok/60"
            }`}
            placeholder="••••••••••••"
          />

          {error ? (
            <p
              key={errorKey}
              id="password-error"
              role="alert"
              className="anim-shake mt-2.5 flex items-center gap-1.5 text-sm text-crit"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 1.5 0v-4ZM10 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || password.length === 0}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ok/60"
          >
            {submitting ? (
              <>
                <Spinner className="size-4" />
                Signing in
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted/70">
          Personal dashboard · access restricted
        </p>
      </div>
    </main>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V8H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 7V5.5a3 3 0 1 0-6 0V8h6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
